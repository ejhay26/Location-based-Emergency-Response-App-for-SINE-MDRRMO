package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/config"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect initializes the GORM database connection (SQLite for local offline or MySQL for remote)
func Connect() {
	cfg := config.AppConfig

	logLevel := logger.Silent
	if cfg.AppDebug {
		logLevel = logger.Info
	}

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logLevel,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var dialector gorm.Dialector
	if cfg.DBDriver == "sqlite" {
		dbName := cfg.DBDatabase
		if dbName == "" || dbName == "emergencydb" {
			dbName = "emergency.db"
		}
		if !strings.HasSuffix(dbName, ".db") {
			dbName += ".db"
		}
		dbPath := dbName
		if !filepath.IsAbs(dbName) {
			exeDir := "."
			if exePath, err := os.Executable(); err == nil {
				if realPath, err := filepath.EvalSymlinks(exePath); err == nil {
					exeDir = filepath.Dir(realPath)
				} else {
					exeDir = filepath.Dir(exePath)
				}
			}
			// Prefer <exeDir>/backend/<dbName> if backend dir exists (e.g. launched from repo root)
			backendCandidate := filepath.Join(exeDir, "backend", dbName)
			exeCandidate := filepath.Join(exeDir, dbName)
			if _, err := os.Stat(filepath.Join(exeDir, "backend")); err == nil {
				dbPath = backendCandidate
			} else {
				dbPath = exeCandidate
			}
		}
		dialector = sqlite.Open(dbPath)
	} else {
		dialector = mysql.Open(cfg.DSN())
	}

	var err error
	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger:                 newLogger,
		SkipDefaultTransaction: true, // Performance: skip wrapping single operations in transactions
	})
	if err != nil {
		log.Fatalf("Failed to connect to database (%s): %v", cfg.DBDriver, err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	fmt.Printf("✅ Database connected successfully (%s)\n", cfg.DBDriver)
}
