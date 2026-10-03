package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from .env
type Config struct {
	// App
	AppName  string
	AppEnv   string
	AppDebug bool
	AppURL   string
	AppPort  string

	// Database
	DBHost     string
	DBPort     string
	DBDatabase string
	DBUsername string
	DBPassword string

	// Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string

	// Mail (Resend)
	ResendAPIKey    string
	MailFromAddress string
	MailFromName    string

	// PhilSMS
	PhilSMSToken  string
	PhilSMSSender string

	// Firebase
	FirebaseProjectID  string
	FirebaseCredentials string

	// Reverb / WebSocket
	ReverbAppID     string
	ReverbAppKey    string
	ReverbAppSecret string
	ReverbHost      string
	ReverbPort      string

	// Bcrypt
	BcryptRounds int

	// Backup
	BackupAutoEnabled  bool
	BackupIntervalHrs  int
	BackupMaxIntraday  int
	BackupMaxDaily     int

	// Filesystem
	FilesystemDisk string

	// Dev Support
	DevSupportEmail string

	// CORS
	CORSAllowOrigins string
}

var AppConfig *Config

// Load reads .env and populates the global AppConfig
func Load() {
	_ = godotenv.Load() // .env is optional in production

	AppConfig = &Config{
		AppName:  getEnv("APP_NAME", "SINE-MDRRMO"),
		AppEnv:   getEnv("APP_ENV", "local"),
		AppDebug: getEnv("APP_DEBUG", "false") == "true",
		AppURL:   getEnv("APP_URL", "http://localhost:3000"),
		AppPort:  getEnv("APP_PORT", "3000"),

		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBDatabase: getEnv("DB_DATABASE", "emergencydb"),
		DBUsername: getEnv("DB_USERNAME", "root"),
		DBPassword: getEnv("DB_PASSWORD", ""),

		RedisHost:     getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),

		ResendAPIKey:    getEnv("RESEND_API_KEY", ""),
		MailFromAddress: getEnv("MAIL_FROM_ADDRESS", "onboarding@resend.dev"),
		MailFromName:    getEnv("MAIL_FROM_NAME", "MDRRMO SAN ISIDRO"),

		PhilSMSToken:  getEnv("PHILSMS_API_TOKEN", ""),
		PhilSMSSender: getEnv("PHILSMS_SENDER_NAME", "PhilSMS"),

		FirebaseProjectID:   getEnv("FIREBASE_PROJECT_ID", ""),
		FirebaseCredentials: getEnv("FIREBASE_CREDENTIALS", ""),

		ReverbAppID:     getEnv("REVERB_APP_ID", ""),
		ReverbAppKey:    getEnv("REVERB_APP_KEY", ""),
		ReverbAppSecret: getEnv("REVERB_APP_SECRET", ""),
		ReverbHost:      getEnv("REVERB_HOST", "0.0.0.0"),
		ReverbPort:      getEnv("REVERB_PORT", "6001"),

		BcryptRounds: getEnvInt("BCRYPT_ROUNDS", 12),

		BackupAutoEnabled: getEnv("BACKUP_AUTO_ENABLED", "true") == "true",
		BackupIntervalHrs: getEnvInt("BACKUP_INTERVAL_HOURS", 2),
		BackupMaxIntraday: getEnvInt("BACKUP_MAX_INTRADAY", 12),
		BackupMaxDaily:    getEnvInt("BACKUP_MAX_DAILY", 7),

		FilesystemDisk: getEnv("FILESYSTEM_DISK", "public"),

		DevSupportEmail: getEnv("DEV_SUPPORT_EMAIL", "ejcp2005@gmail.com"),

		CORSAllowOrigins: getEnv("CORS_ALLOW_ORIGINS", "*"),
	}
}

// DSN returns the MySQL connection string
func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.DBUsername, c.DBPassword, c.DBHost, c.DBPort, c.DBDatabase)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
