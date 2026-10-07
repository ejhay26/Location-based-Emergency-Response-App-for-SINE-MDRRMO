package backup

import (
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/config"

	"github.com/rs/zerolog/log"
)

type BackupInfo struct {
	Filename  string    `json:"filename"`
	Path      string    `json:"path"`
	SizeBytes int64     `json:"size_bytes"`
	SizeMB    float64   `json:"size_mb"`
	CreatedAt time.Time `json:"created_at"`
}

func GetBackupDir() string {
	baseDir := "."
	if execPath, err := os.Executable(); err == nil {
		realPath, err := filepath.EvalSymlinks(execPath)
		if err == nil {
			baseDir = filepath.Dir(realPath)
		} else {
			baseDir = filepath.Dir(execPath)
		}
	}
	dir := filepath.Join(baseDir, "storage", "app", "backups")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

// CreateSnapshot creates a gzip-compressed mysqldump snapshot and prunes backups older than 7 days
func CreateSnapshot(prefix string) (*BackupInfo, error) {
	if prefix == "" {
		prefix = "emergencydb"
	}

	backupDir := GetBackupDir()
	timestamp := time.Now().Format("2006-01-02_150405")
	filename := fmt.Sprintf("%s_%s.sql.gz", prefix, timestamp)
	filepath := filepath.Join(backupDir, filename)

	cfg := config.AppConfig
	if cfg == nil {
		return nil, fmt.Errorf("app config not initialized")
	}

	dumpBin := "mysqldump"
	if _, err := exec.LookPath("mariadb-dump"); err == nil {
		dumpBin = "mariadb-dump"
	}

	args := []string{
		fmt.Sprintf("--host=%s", cfg.DBHost),
		fmt.Sprintf("--port=%s", cfg.DBPort),
		fmt.Sprintf("--user=%s", cfg.DBUsername),
		"--single-transaction",
		"--quick",
		"--routines",
		"--triggers",
	}

	args = append(args, cfg.DBDatabase)

	cmd := exec.Command(dumpBin, args...)
	if cfg.DBPassword != "" {
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.DBPassword)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to open dump stdout: %w", err)
	}

	var stderr strings.Builder
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start %s: %w", dumpBin, err)
	}

	outFile, err := os.Create(filepath)
	if err != nil {
		_ = cmd.Process.Kill()
		return nil, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer outFile.Close()

	gzWriter := gzip.NewWriter(outFile)
	defer gzWriter.Close()

	if _, err := io.Copy(gzWriter, stdout); err != nil {
		_ = os.Remove(filepath)
		return nil, fmt.Errorf("failed to compress dump stream: %w", err)
	}

	if err := gzWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to flush gzip stream: %w", err)
	}

	if err := cmd.Wait(); err != nil {
		_ = os.Remove(filepath)
		return nil, fmt.Errorf("%s failed: %w (stderr: %s)", dumpBin, err, stderr.String())
	}

	info, err := os.Stat(filepath)
	if err != nil || info.Size() == 0 {
		_ = os.Remove(filepath)
		return nil, fmt.Errorf("backup file is empty or corrupted")
	}

	// Auto-prune backups older than 7 days
	pruned := PruneOldBackups(7)
	if pruned > 0 {
		log.Info().Int("pruned_count", pruned).Msg("[Backup] Pruned old backup archives")
	}

	bInfo := &BackupInfo{
		Filename:  filename,
		Path:      filepath,
		SizeBytes: info.Size(),
		SizeMB:    float64(info.Size()) / (1024 * 1024),
		CreatedAt: info.ModTime(),
	}

	log.Info().
		Str("filename", filename).
		Float64("size_mb", bInfo.SizeMB).
		Msg("✅ Database backup snapshot created successfully")

	return bInfo, nil
}

// ListBackups returns all snapshots ordered newest first
func ListBackups() ([]BackupInfo, error) {
	backupDir := GetBackupDir()
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, err
	}

	var list []BackupInfo
	for _, entry := range entries {
		if entry.IsDir() || (!strings.HasSuffix(entry.Name(), ".sql.gz") && !strings.HasSuffix(entry.Name(), ".sql")) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		list = append(list, BackupInfo{
			Filename:  entry.Name(),
			Path:      filepath.Join(backupDir, entry.Name()),
			SizeBytes: info.Size(),
			SizeMB:    float64(info.Size()) / (1024 * 1024),
			CreatedAt: info.ModTime(),
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})

	return list, nil
}

// PruneOldBackups deletes backups older than retentionDays (default 7 days)
func PruneOldBackups(retentionDays int) int {
	if retentionDays <= 0 {
		retentionDays = 7
	}
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	list, err := ListBackups()
	if err != nil {
		return 0
	}

	deleted := 0
	for _, b := range list {
		if b.CreatedAt.Before(cutoff) {
			if err := os.Remove(b.Path); err == nil {
				deleted++
			}
		}
	}
	return deleted
}
