package backup

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"sine-mdrrmo-backend/internal/config"
	"sine-mdrrmo-backend/internal/database"
	"sine-mdrrmo-backend/internal/services"

	"github.com/rs/zerolog/log"
)

type BackupInfo struct {
	Filename      string    `json:"filename"`
	Path          string    `json:"path"`
	SizeBytes     int64     `json:"size_bytes"`
	SizeMB        float64   `json:"size_mb"`
	SizeHuman     string    `json:"size_human"`
	CreatedAt     time.Time `json:"created_at"`
	DateFormatted string    `json:"date_formatted"`
	AgeHuman      string    `json:"age_human"`
	Type          string    `json:"type"`
}

type SnapshotDesc struct {
	Filename         string         `json:"filename"`
	Filepath         string         `json:"filepath"`
	SizeCompressed   string         `json:"size_compressed"`
	SizeRaw          string         `json:"size_raw"`
	CompressionRatio string         `json:"compression_ratio"`
	CreatedAt        time.Time      `json:"created_at"`
	DateFormatted    string         `json:"date_formatted"`
	TotalTables      int            `json:"total_tables"`
	TotalRecords     int            `json:"total_records"`
	LatestIncident   string         `json:"latest_incident"`
	TableCounts      map[string]int `json:"table_counts"`
}

type DiffRow struct {
	Live       int `json:"live"`
	Backup     int `json:"backup"`
	Difference int `json:"difference"`
}

type DiffPreview struct {
	Snapshot *SnapshotDesc       `json:"snapshot"`
	Diff     map[string]*DiffRow `json:"diff"`
}

type RestoreResult struct {
	RestoredFile string `json:"restored_file"`
	SafetyBackup string `json:"safety_backup"`
}

type GapFile struct {
	Path      string `json:"path"`
	Size      string `json:"size"`
	CreatedAt string `json:"created_at"`
}

type SalvageResult struct {
	SnapshotTime      string            `json:"snapshot_time"`
	GapFiles          []GapFile         `json:"gap_files"`
	GapFilesCount     int               `json:"gap_files_count"`
	GapEmails         map[string]string `json:"gap_emails"`
	GapPhones         map[string]string `json:"gap_phones"`
	GapCitizensCount  int               `json:"gap_citizens_count"`
}

type NotifyResult struct {
	TotalTargets int `json:"total_targets"`
	Notified     int `json:"notified"`
	Failed       int `json:"failed"`
}

type StatusResult struct {
	AutoEnabled    bool        `json:"auto_enabled"`
	IntervalHours  int         `json:"interval_hours"`
	MaxIntraday    int         `json:"max_intraday"`
	MaxDaily       int         `json:"max_daily"`
	TotalSnapshots int         `json:"total_snapshots"`
	LatestSnapshot *BackupInfo `json:"latest_snapshot"`
}

// GetBackupDir returns the absolute path to storage/app/backups
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

// FormatBytes converts raw bytes into human readable KB / MB
func FormatBytes(bytes int64) string {
	if bytes >= 1048576 {
		return fmt.Sprintf("%.2f MB", float64(bytes)/(1024*1024))
	}
	if bytes >= 1024 {
		return fmt.Sprintf("%.2f KB", float64(bytes)/1024)
	}
	return fmt.Sprintf("%d B", bytes)
}

// FormatAge converts a timestamp into relative human-readable age
func FormatAge(t time.Time) string {
	diff := time.Since(t)
	if diff < time.Minute {
		return "Just now"
	}
	if diff < time.Hour {
		return fmt.Sprintf("%d mins ago", int(diff.Minutes()))
	}
	if diff < 24*time.Hour {
		return fmt.Sprintf("%d hrs ago", int(diff.Hours()))
	}
	return fmt.Sprintf("%d days ago", int(diff.Hours()/24))
}

// CreateSnapshot creates a gzip-compressed mysqldump snapshot and auto-prunes
func CreateSnapshot(prefix string) (*BackupInfo, error) {
	if prefix == "" {
		prefix = "emergencydb"
	}

	backupDir := GetBackupDir()
	timestamp := time.Now().Format("2006-01-02_150405")
	filename := fmt.Sprintf("%s_%s.sql.gz", prefix, timestamp)
	targetPath := filepath.Join(backupDir, filename)

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
		cfg.DBDatabase,
	}

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

	outFile, err := os.Create(targetPath)
	if err != nil {
		_ = cmd.Process.Kill()
		return nil, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer outFile.Close()

	gzWriter := gzip.NewWriter(outFile)
	defer gzWriter.Close()

	if _, err := io.Copy(gzWriter, stdout); err != nil {
		_ = os.Remove(targetPath)
		return nil, fmt.Errorf("failed to compress dump stream: %w", err)
	}

	if err := gzWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to flush gzip stream: %w", err)
	}

	if err := cmd.Wait(); err != nil {
		_ = os.Remove(targetPath)
		return nil, fmt.Errorf("%s failed: %w (stderr: %s)", dumpBin, err, stderr.String())
	}

	info, err := os.Stat(targetPath)
	if err != nil || info.Size() == 0 {
		_ = os.Remove(targetPath)
		return nil, fmt.Errorf("backup file is empty or corrupted")
	}

	// Auto-prune old backups after creation
	PruneOldBackups()

	bType := "Intraday Snapshot"
	if strings.Contains(filename, "salvage_safety") {
		bType = "Safety Pre-Restore"
	}

	bInfo := &BackupInfo{
		Filename:      filename,
		Path:          targetPath,
		SizeBytes:     info.Size(),
		SizeMB:        float64(info.Size()) / (1024 * 1024),
		SizeHuman:     FormatBytes(info.Size()),
		CreatedAt:     info.ModTime(),
		DateFormatted: info.ModTime().Format("2006-01-02 15:04:05"),
		AgeHuman:      FormatAge(info.ModTime()),
		Type:          bType,
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

		bType := "Intraday Snapshot"
		if strings.Contains(entry.Name(), "salvage_safety") {
			bType = "Safety Pre-Restore"
		}

		list = append(list, BackupInfo{
			Filename:      entry.Name(),
			Path:          filepath.Join(backupDir, entry.Name()),
			SizeBytes:     info.Size(),
			SizeMB:        float64(info.Size()) / (1024 * 1024),
			SizeHuman:     FormatBytes(info.Size()),
			CreatedAt:     info.ModTime(),
			DateFormatted: info.ModTime().Format("2006-01-02 15:04:05"),
			AgeHuman:      FormatAge(info.ModTime()),
			Type:          bType,
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})

	return list, nil
}

// ResolveFilepath ensures target has an absolute path
func ResolveFilepath(target string) string {
	if _, err := os.Stat(target); err == nil {
		return target
	}
	return filepath.Join(GetBackupDir(), filepath.Base(target))
}

// ReadGzipSQL decompresses and reads the SQL content of a snapshot
func ReadGzipSQL(filePath string) ([]byte, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	if strings.HasSuffix(filePath, ".gz") {
		gz, err := gzip.NewReader(file)
		if err != nil {
			return nil, err
		}
		defer gz.Close()
		return io.ReadAll(gz)
	}
	return io.ReadAll(file)
}

// DescribeSnapshot parses tables and row counts inside a snapshot without restoring
func DescribeSnapshot(target string) (*SnapshotDesc, error) {
	filePath := ResolveFilepath(target)
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("snapshot file not found: %s", target)
	}

	sqlBytes, err := ReadGzipSQL(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress snapshot: %w", err)
	}

	sqlContent := string(sqlBytes)
	rawSize := int64(len(sqlBytes))
	compSize := fileInfo.Size()

	ratio := "0%"
	if rawSize > 0 {
		ratio = fmt.Sprintf("%.1f%%", (1.0-float64(compSize)/float64(rawSize))*100.0)
	}

	// 1. Discover tables in SQL
	reTable := regexp.MustCompile(`(?i)CREATE TABLE (?:IF NOT EXISTS )?[`+"`"+`"]?([a-zA-Z0-9_]+)[`+"`"+`"]?`)
	matches := reTable.FindAllStringSubmatch(sqlContent, -1)

	tableMap := make(map[string]bool)
	var tablesFound []string
	for _, m := range matches {
		if len(m) > 1 && !tableMap[m[1]] {
			tableMap[m[1]] = true
			tablesFound = append(tablesFound, m[1])
		}
	}

	if len(tablesFound) == 0 {
		tablesFound = []string{
			"users", "emergency_requests", "dispatch", "hazards",
			"broadcasts", "barangays", "incident_types",
			"feedback", "user_settings", "personal_access_tokens",
			"device_tokens",
		}
	}

	tableCounts := make(map[string]int)
	totalRecords := 0

	for _, tbl := range tablesFound {
		pattern := `(?is)INSERT INTO [` + "`" + `"]?` + regexp.QuoteMeta(tbl) + `[` + "`" + `"]?.*?VALUES\s*(.*?);`
		reInsert := regexp.MustCompile(pattern)
		insertMatches := reInsert.FindAllStringSubmatch(sqlContent, -1)

		count := 0
		reTuple := regexp.MustCompile(`\([^()]+\)`)
		for _, im := range insertMatches {
			if len(im) > 1 {
				tuples := reTuple.FindAllString(im[1], -1)
				count += len(tuples)
			}
		}
		tableCounts[tbl] = count
		totalRecords += count
	}

	// 2. Find latest incident timestamp in emergency_requests
	latestIncident := ""
	reDate := regexp.MustCompile(`'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'`)
	reEmergency := regexp.MustCompile(`(?is)INSERT INTO [` + "`" + `"]?emergency_requests[` + "`" + `"]?.*?VALUES\s*(.*?);`)
	emMatches := reEmergency.FindAllStringSubmatch(sqlContent, -1)
	var dates []string
	for _, em := range emMatches {
		if len(em) > 1 {
			dateMatches := reDate.FindAllStringSubmatch(em[1], -1)
			for _, dm := range dateMatches {
				if len(dm) > 1 {
					dates = append(dates, dm[1])
				}
			}
		}
	}
	if len(dates) > 0 {
		sort.Strings(dates)
		latestIncident = dates[len(dates)-1]
	}

	return &SnapshotDesc{
		Filename:         filepath.Base(filePath),
		Filepath:         filePath,
		SizeCompressed:   FormatBytes(compSize),
		SizeRaw:          FormatBytes(rawSize),
		CompressionRatio: ratio,
		CreatedAt:        fileInfo.ModTime(),
		DateFormatted:    fileInfo.ModTime().Format("2006-01-02 15:04:05"),
		TotalTables:      len(tablesFound),
		TotalRecords:     totalRecords,
		LatestIncident:   latestIncident,
		TableCounts:      tableCounts,
	}, nil
}

// GetDiffPreview compares current live database row counts against backup
func GetDiffPreview(target string) (*DiffPreview, error) {
	desc, err := DescribeSnapshot(target)
	if err != nil {
		return nil, err
	}

	diff := make(map[string]*DiffRow)

	for table, backupCount := range desc.TableCounts {
		liveCount := 0
		if database.DB != nil {
			var count int64
			err := database.DB.Table(table).Count(&count).Error
			if err == nil {
				liveCount = int(count)
			}
		}

		diff[table] = &DiffRow{
			Live:       liveCount,
			Backup:     backupCount,
			Difference: backupCount - liveCount,
		}
	}

	return &DiffPreview{
		Snapshot: desc,
		Diff:     diff,
	}, nil
}

// RestoreSnapshot restores target snapshot with automatic pre-restore safety dump
func RestoreSnapshot(target string) (*RestoreResult, error) {
	filePath := ResolveFilepath(target)
	if _, err := os.Stat(filePath); err != nil {
		return nil, fmt.Errorf("snapshot file not found: %s", target)
	}

	// 1. Create automatic pre-restore safety snapshot
	safetyDump, err := CreateSnapshot("salvage_safety")
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create pre-restore safety snapshot, proceeding with caution")
	}

	cfg := config.AppConfig
	if cfg == nil {
		return nil, fmt.Errorf("app config not initialized")
	}

	mysqlBin := "mysql"
	if _, err := exec.LookPath("mariadb"); err == nil {
		mysqlBin = "mariadb"
	}

	args := []string{
		fmt.Sprintf("--host=%s", cfg.DBHost),
		fmt.Sprintf("--port=%s", cfg.DBPort),
		fmt.Sprintf("--user=%s", cfg.DBUsername),
		cfg.DBDatabase,
	}

	cmd := exec.Command(mysqlBin, args...)
	if cfg.DBPassword != "" {
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+cfg.DBPassword)
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open snapshot file: %w", err)
	}
	defer file.Close()

	var reader io.Reader = file
	if strings.HasSuffix(filePath, ".gz") {
		gz, err := gzip.NewReader(file)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress gzip archive: %w", err)
		}
		defer gz.Close()
		reader = gz
	}

	cmd.Stdin = reader
	var stderr strings.Builder
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("database restore failed: %w (stderr: %s)", err, stderr.String())
	}

	safetyFilename := "none"
	if safetyDump != nil {
		safetyFilename = safetyDump.Filename
	}

	return &RestoreResult{
		RestoredFile: filepath.Base(filePath),
		SafetyBackup: safetyFilename,
	}, nil
}

// SalvageGapData scans storage proof folders and logs for records created during the gap
func SalvageGapData(target string) (*SalvageResult, error) {
	filePath := ResolveFilepath(target)
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("snapshot file not found: %s", target)
	}

	snapshotTime := info.ModTime()

	baseDir := "."
	if execPath, err := os.Executable(); err == nil {
		if realPath, err := filepath.EvalSymlinks(execPath); err == nil {
			baseDir = filepath.Dir(realPath)
		} else {
			baseDir = filepath.Dir(execPath)
		}
	}

	// 1. Scan storage proof folders
	var gapFiles []GapFile
	proofDirs := []string{
		filepath.Join(baseDir, "storage", "app", "public", "reports"),
		filepath.Join(baseDir, "storage", "app", "public", "verification_ids"),
		filepath.Join(baseDir, "storage", "app", "public", "ids"),
		filepath.Join(baseDir, "storage", "app", "public", "profiles"),
		filepath.Join(baseDir, "storage", "reports"),
		filepath.Join(baseDir, "storage", "verification_ids"),
		filepath.Join(baseDir, "storage", "profiles"),
	}

	seenPaths := make(map[string]bool)
	for _, dir := range proofDirs {
		_ = filepath.Walk(dir, func(p string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() {
				return nil
			}
			if fi.ModTime().After(snapshotTime) {
				rel, _ := filepath.Rel(baseDir, p)
				if !seenPaths[rel] {
					seenPaths[rel] = true
					gapFiles = append(gapFiles, GapFile{
						Path:      rel,
						Size:      FormatBytes(fi.Size()),
						CreatedAt: fi.ModTime().Format("2006-01-02 15:04:05"),
					})
				}
			}
			return nil
		})
	}

	// 2. Scan log files for OTP, registrations, and citizen contact info
	gapEmails := make(map[string]string)
	gapPhones := make(map[string]string)

	logFiles := []string{
		filepath.Join(baseDir, "storage", "logs", "laravel.log"),
		filepath.Join(baseDir, "storage", "logs", "app.log"),
		filepath.Join(baseDir, "logs", "app.log"),
	}

	reLogOtp := regexp.MustCompile(`\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*?OTP.*?(?:to|for)\s+([^\s]+)`)
	reEmail := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	rePhone := regexp.MustCompile(`^(\+?63|0)?9\d{9}$`)

	for _, lf := range logFiles {
		f, err := os.Open(lf)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if m := reLogOtp.FindStringSubmatch(line); len(m) > 2 {
				logTime, err := time.Parse("2006-01-02 15:04:05", m[1])
				if err == nil && logTime.After(snapshotTime) {
					targetID := strings.Trim(m[2], `:,."' `)
					if reEmail.MatchString(targetID) {
						gapEmails[targetID] = m[1]
					} else if rePhone.MatchString(targetID) {
						gapPhones[targetID] = m[1]
					}
				}
			}
		}
		f.Close()
	}

	return &SalvageResult{
		SnapshotTime:     snapshotTime.Format("2006-01-02 15:04:05"),
		GapFiles:         gapFiles,
		GapFilesCount:    len(gapFiles),
		GapEmails:        gapEmails,
		GapPhones:        gapPhones,
		GapCitizensCount: len(gapEmails) + len(gapPhones),
	}, nil
}

// NotifyGapCitizens sends recovery advisory SMS and emails to affected gap citizens
func NotifyGapCitizens(target string) (*NotifyResult, error) {
	salvage, err := SalvageGapData(target)
	if err != nil {
		return nil, err
	}

	notified := 0
	failed := 0

	msgBody := "MDRRMO Notice: San Isidro MDRRMO completed an automated system synchronization. If your account shows unverified, please sign in or register again at your convenience. Keep safe!"

	smsService := services.GetPhilSmsService()
	for phone := range salvage.GapPhones {
		if smsService.SendDirect(phone, msgBody) {
			notified++
		} else {
			failed++
		}
	}

	mailer := services.GetMailer()
	for email := range salvage.GapEmails {
		err := mailer.SendDisasterRecoveryNotice(email, salvage.SnapshotTime)
		if err == nil {
			notified++
		} else {
			failed++
		}
	}

	return &NotifyResult{
		TotalTargets: len(salvage.GapPhones) + len(salvage.GapEmails),
		Notified:     notified,
		Failed:       failed,
	}, nil
}

// PruneOldBackups removes backups beyond retention limits (12 intraday / 7 daily)
// and cleans safety backups older than 48 hours
func PruneOldBackups() int {
	list, err := ListBackups()
	if err != nil {
		return 0
	}

	cfg := config.AppConfig
	maxIntraday := 12
	maxDaily := 7
	if cfg != nil {
		if cfg.BackupMaxIntraday > 0 {
			maxIntraday = cfg.BackupMaxIntraday
		}
		if cfg.BackupMaxDaily > 0 {
			maxDaily = cfg.BackupMaxDaily
		}
	}

	var intraday []BackupInfo
	var safety []BackupInfo

	for _, b := range list {
		if b.Type == "Safety Pre-Restore" {
			safety = append(safety, b)
		} else {
			intraday = append(intraday, b)
		}
	}

	pruned := 0

	// 1. Enforce intraday retention ceiling
	limit := maxIntraday + maxDaily
	if len(intraday) > limit {
		toDelete := intraday[limit:]
		for _, b := range toDelete {
			if err := os.Remove(b.Path); err == nil {
				pruned++
			}
		}
	}

	// 2. Delete safety snapshots older than 48 hours
	cutoff48h := time.Now().Add(-48 * time.Hour)
	for _, s := range safety {
		if s.CreatedAt.Before(cutoff48h) {
			if err := os.Remove(s.Path); err == nil {
				pruned++
			}
		}
	}

	if pruned > 0 {
		log.Info().Int("pruned_count", pruned).Msg("[Backup] Pruned old backup archives")
	}

	return pruned
}

// GetStatus returns system backup schedule health and snapshot statistics
func GetStatus() (*StatusResult, error) {
	cfg := config.AppConfig
	autoEnabled := true
	interval := 2
	maxIntraday := 12
	maxDaily := 7

	if cfg != nil {
		autoEnabled = cfg.BackupAutoEnabled
		if cfg.BackupIntervalHrs > 0 {
			interval = cfg.BackupIntervalHrs
		}
		if cfg.BackupMaxIntraday > 0 {
			maxIntraday = cfg.BackupMaxIntraday
		}
		if cfg.BackupMaxDaily > 0 {
			maxDaily = cfg.BackupMaxDaily
		}
	}

	list, _ := ListBackups()
	var latest *BackupInfo
	if len(list) > 0 {
		latest = &list[0]
	}

	return &StatusResult{
		AutoEnabled:    autoEnabled,
		IntervalHours:  interval,
		MaxIntraday:    maxIntraday,
		MaxDaily:       maxDaily,
		TotalSnapshots: len(list),
		LatestSnapshot: latest,
	}, nil
}
