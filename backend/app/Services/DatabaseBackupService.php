<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Services\PhilSmsService;

class DatabaseBackupService
{
    protected string $backupDir;
    protected int $maxIntraday = 12;
    protected int $maxDaily = 7;

    public function __construct()
    {
        $this->backupDir = storage_path('app/backups');
        if (!File::exists($this->backupDir)) {
            File::makeDirectory($this->backupDir, 0755, true);
        }
    }

    /**
     * Get the absolute path to the backup storage directory.
     */
    public function getBackupDir(): string
    {
        return $this->backupDir;
    }

    /**
     * Create an instant, gzip-compressed snapshot of the database.
     */
    public function createSnapshot(string $prefix = 'emergencydb'): array
    {
        $timestamp = date('Y-m-d_His');
        $filename = "{$prefix}_{$timestamp}.sql.gz";
        $filepath = "{$this->backupDir}/{$filename}";

        $dbHost = config('database.connections.mysql.host', '127.0.0.1');
        $dbPort = config('database.connections.mysql.port', '3306');
        $dbName = config('database.connections.mysql.database', 'emergencydb');
        $dbUser = config('database.connections.mysql.username', 'root');
        $dbPass = config('database.connections.mysql.password', '');

        // Try mysqldump command first
        $dumpSuccess = false;
        $mysqldumpPath = $this->findBinary('mysqldump');

        if ($mysqldumpPath) {
            $passParam = $dbPass !== '' ? "-p" . escapeshellarg($dbPass) : '';
            $cmd = sprintf(
                '%s --host=%s --port=%s --user=%s %s --single-transaction --quick --routines --triggers %s',
                escapeshellarg($mysqldumpPath),
                escapeshellarg($dbHost),
                escapeshellarg($dbPort),
                escapeshellarg($dbUser),
                $passParam,
                escapeshellarg($dbName)
            );

            $process = proc_open($cmd, [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes);

            if (is_resource($process)) {
                fclose($pipes[0]);
                $sqlContent = stream_get_contents($pipes[1]);
                $errors = stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $exitCode = proc_close($process);

                if ($exitCode === 0 && !empty($sqlContent)) {
                    $gz = gzopen($filepath, 'w9');
                    if ($gz) {
                        gzwrite($gz, $sqlContent);
                        gzclose($gz);
                        $dumpSuccess = true;
                    }
                }
            }
        }

        // Fallback: Pure PHP SQL Dumper (100% portable, works without mysqldump binary)
        if (!$dumpSuccess) {
            $sqlContent = $this->generatePhpSqlDump();
            $gz = gzopen($filepath, 'w9');
            if ($gz) {
                gzwrite($gz, $sqlContent);
                gzclose($gz);
                $dumpSuccess = true;
            }
        }

        // Auto-prune old backups after creation
        $this->pruneOldBackups();

        $sizeBytes = File::exists($filepath) ? File::size($filepath) : 0;

        return [
            'success' => $dumpSuccess,
            'filename' => $filename,
            'filepath' => $filepath,
            'timestamp' => $timestamp,
            'size_bytes' => $sizeBytes,
            'size_human' => $this->formatBytes($sizeBytes),
        ];
    }

    /**
     * List all available backup snapshots with metadata.
     */
    public function getBackupsList(): array
    {
        if (!File::exists($this->backupDir)) {
            return [];
        }

        $files = File::files($this->backupDir);
        $backups = [];

        foreach ($files as $file) {
            if ($file->getExtension() === 'gz' || str_ends_with($file->getFilename(), '.sql.gz')) {
                $filename = $file->getFilename();
                $size = $file->getSize();
                $modifiedTime = $file->getMTime();

                // Extract timestamp from filename (e.g. emergencydb_2026-08-23_020000.sql.gz)
                $type = str_contains($filename, 'salvage_safety') ? 'Safety Pre-Restore' : 'Intraday Snapshot';

                $backups[] = [
                    'filename' => $filename,
                    'filepath' => $file->getPathname(),
                    'size_bytes' => $size,
                    'size_human' => $this->formatBytes($size),
                    'timestamp' => $modifiedTime,
                    'date_formatted' => date('Y-m-d H:i:s', $modifiedTime),
                    'age_human' => $this->formatAge($modifiedTime),
                    'type' => $type,
                ];
            }
        }

        // Sort newest first
        usort($backups, fn($a, $b) => $b['timestamp'] <=> $a['timestamp']);

        return $backups;
    }

    /**
     * Inspect and summarize table record counts inside a backup archive without restoring.
     * Dynamically discovers all tables, computes grand totals, and extracts latest incident info.
     */
    public function describeSnapshot(string $filename): array
    {
        $filepath = $this->resolveFilepath($filename);

        if (!File::exists($filepath)) {
            throw new \RuntimeException("Backup file not found: {$filename}");
        }

        $sql = $this->readGzipFile($filepath);
        if (empty($sql)) {
            throw new \RuntimeException("Unable to decompress or empty backup file: {$filename}");
        }

        // 1. Dynamically discover all tables created in the SQL dump
        $tablesFound = [];
        if (preg_match_all('/CREATE TABLE (?:IF NOT EXISTS )?[`"]?([a-zA-Z0-9_]+)[`"]?/i', $sql, $createMatches)) {
            $tablesFound = array_unique($createMatches[1]);
        }

        // Fallback default list if no CREATE TABLE statements found
        if (empty($tablesFound)) {
            $tablesFound = [
                'users', 'emergency_requests', 'dispatches', 'hazards',
                'broadcasts', 'barangays', 'incident_types', 'responders',
                'vehicles', 'feedback', 'user_settings', 'personal_access_tokens',
                'device_tokens', 'migrations'
            ];
        }

        $tableCounts = [];
        $totalRecords = 0;

        foreach ($tablesFound as $table) {
            $pattern = '/INSERT INTO [`"]?' . preg_quote($table, '/') . '[`"]?.*?VALUES\s*(.*?);/is';
            if (preg_match_all($pattern, $sql, $matches)) {
                $count = 0;
                foreach ($matches[1] as $valuesBlock) {
                    $count += preg_match_all('/\((?:[^)(]+|(?R))*+\)/', $valuesBlock);
                }
                $count = $count > 0 ? $count : count($matches[0]);
                $tableCounts[$table] = $count;
                $totalRecords += $count;
            } else {
                $tableCounts[$table] = 0;
            }
        }

        // 2. Extract latest emergency request activity from dump
        $latestIncident = null;
        if (preg_match_all('/INSERT INTO [`"]?emergency_requests[`"]?.*?VALUES\s*(.*?);/is', $sql, $emMatches)) {
            $allValues = implode(' ', $emMatches[1]);
            // Search for dates inside the values block: '2026-XX-XX XX:XX:XX'
            if (preg_match_all('/\'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\'/', $allValues, $dateMatches)) {
                $dates = $dateMatches[1];
                rsort($dates);
                $latestIncident = $dates[0] ?? null;
            }
        }

        $fileSize = File::size($filepath);
        $rawSize = strlen($sql);

        return [
            'filename' => basename($filepath),
            'size_compressed' => $this->formatBytes($fileSize),
            'size_raw' => $this->formatBytes($rawSize),
            'compression_ratio' => $rawSize > 0 ? round((1 - ($fileSize / $rawSize)) * 100, 1) . '%' : 'N/A',
            'timestamp' => File::lastModified($filepath),
            'date_formatted' => date('Y-m-d H:i:s', File::lastModified($filepath)),
            'total_tables' => count($tablesFound),
            'total_records' => $totalRecords,
            'latest_incident_timestamp' => $latestIncident,
            'table_counts' => $tableCounts,
        ];
    }

    /**
     * Compare current live database records against the backup before restoring.
     */
    public function getDiffPreview(string $filename): array
    {
        $desc = $this->describeSnapshot($filename);
        $diff = [];

        foreach ($desc['table_counts'] as $table => $backupCount) {
            try {
                $liveCount = DB::table($table)->count();
            } catch (\Throwable $e) {
                $liveCount = 0;
            }

            $diff[$table] = [
                'live' => $liveCount,
                'backup' => $backupCount,
                'difference' => $backupCount - $liveCount,
            ];
        }

        return [
            'snapshot' => $desc,
            'diff' => $diff,
        ];
    }

    /**
     * Safely restore database from snapshot with pre-restore safety dump.
     */
    public function restoreSnapshot(string $filename): array
    {
        $filepath = $this->resolveFilepath($filename);

        if (!File::exists($filepath)) {
            throw new \RuntimeException("Backup file not found: {$filename}");
        }

        // 1. Create automatic pre-restore safety snapshot
        $safetyDump = $this->createSnapshot('salvage_safety');

        $sql = $this->readGzipFile($filepath);
        if (empty($sql)) {
            throw new \RuntimeException("Backup file is empty or corrupted: {$filename}");
        }

        $dbHost = config('database.connections.mysql.host', '127.0.0.1');
        $dbPort = config('database.connections.mysql.port', '3306');
        $dbName = config('database.connections.mysql.database', 'emergencydb');
        $dbUser = config('database.connections.mysql.username', 'root');
        $dbPass = config('database.connections.mysql.password', '');

        $restored = false;
        $mysqlPath = $this->findBinary('mysql');

        if ($mysqlPath) {
            $passParam = $dbPass !== '' ? "-p" . escapeshellarg($dbPass) : '';
            $cmd = sprintf(
                '%s --host=%s --port=%s --user=%s %s %s',
                escapeshellarg($mysqlPath),
                escapeshellarg($dbHost),
                escapeshellarg($dbPort),
                escapeshellarg($dbUser),
                $passParam,
                escapeshellarg($dbName)
            );

            $process = proc_open($cmd, [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes);

            if (is_resource($process)) {
                fwrite($pipes[0], $sql);
                fclose($pipes[0]);
                fclose($pipes[1]);
                $errors = stream_get_contents($pipes[2]);
                fclose($pipes[2]);
                $exitCode = proc_close($process);

                if ($exitCode === 0) {
                    $restored = true;
                }
            }
        }

        // Fallback: Pure PDO execution
        if (!$restored) {
            DB::unprepared('SET FOREIGN_KEY_CHECKS=0;');
            DB::unprepared($sql);
            DB::unprepared('SET FOREIGN_KEY_CHECKS=1;');
            $restored = true;
        }

        return [
            'success' => $restored,
            'restored_file' => basename($filepath),
            'safety_backup' => $safetyDump['filename'],
        ];
    }

    /**
     * Scan storage proofs and logs for unbacked records created during the snapshot gap.
     */
    public function salvageGapData(string $filename): array
    {
        $filepath = $this->resolveFilepath($filename);
        $snapshotTime = File::lastModified($filepath);

        $gapFiles = [];
        $proofDirs = [
            storage_path('app/public/reports'),
            storage_path('app/public/ids'),
            storage_path('app/public/profiles'),
        ];

        foreach ($proofDirs as $dir) {
            if (File::exists($dir)) {
                foreach (File::allFiles($dir) as $f) {
                    if ($f->getMTime() > $snapshotTime) {
                        $gapFiles[] = [
                            'path' => $f->getRelativePathname(),
                            'size' => $this->formatBytes($f->getSize()),
                            'created_at' => date('Y-m-d H:i:s', $f->getMTime()),
                        ];
                    }
                }
            }
        }

        // Parse log for OTP transmissions & user activity in the gap
        $gapEmails = [];
        $gapPhones = [];
        $logFile = storage_path('logs/laravel.log');

        if (File::exists($logFile)) {
            $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $recentLines = array_slice($lines, -500); // Check last 500 lines

            foreach ($recentLines as $line) {
                // Check for PhilSMS or OTP records
                if (preg_match('/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*?OTP.*?(?:to|for)\s+([^\s]+)/i', $line, $m)) {
                    $logTime = strtotime($m[1]);
                    if ($logTime > $snapshotTime) {
                        $target = trim($m[2], ':,."\'');
                        if (filter_var($target, FILTER_VALIDATE_EMAIL)) {
                            $gapEmails[$target] = $m[1];
                        } elseif (preg_match('/^(\+?63|0)?9\d{9}$/', $target)) {
                            $gapPhones[$target] = $m[1];
                        }
                    }
                }
            }
        }

        return [
            'snapshot_time' => date('Y-m-d H:i:s', $snapshotTime),
            'gap_files' => $gapFiles,
            'gap_files_count' => count($gapFiles),
            'gap_emails' => $gapEmails,
            'gap_phones' => $gapPhones,
            'gap_citizens_count' => count($gapEmails) + count($gapPhones),
        ];
    }

    /**
     * Send polite recovery notifications to citizens identified during the gap.
     */
    public function notifyGapCitizens(string $filename, PhilSmsService $smsService): array
    {
        $salvage = $this->salvageGapData($filename);
        $notifiedCount = 0;
        $failedCount = 0;

        $msgBody = "MDRRMO Notice: San Isidro MDRRMO underwent a scheduled system database sync. If your account shows unverified, please sign in or register again at your convenience. Keep safe!";

        // Send SMS to affected phone numbers
        foreach ($salvage['gap_phones'] as $phone => $timestamp) {
            try {
                $smsService->sendSms($phone, $msgBody);
                $notifiedCount++;
            } catch (\Throwable $e) {
                $failedCount++;
                Log::warning("Failed to send DR notification SMS to {$phone}: " . $e->getMessage());
            }
        }

        // Send Styled HTML Blade Emails
        foreach ($salvage['gap_emails'] as $email => $timestamp) {
            try {
                Mail::to($email)->send(new \App\Mail\DisasterRecoveryNoticeMail($email, $salvage['snapshot_time']));
                $notifiedCount++;
            } catch (\Throwable $e) {
                $failedCount++;
                Log::warning("Failed to send DR notification Email to {$email}: " . $e->getMessage());
            }
        }

        return [
            'total_targets' => count($salvage['gap_phones']) + count($salvage['gap_emails']),
            'notified' => $notifiedCount,
            'failed' => $failedCount,
        ];
    }

    /**
     * Retention manager: auto-purge snapshots beyond the 12 intraday / 7 daily limits.
     */
    public function pruneOldBackups(): int
    {
        $backups = $this->getBackupsList();
        $prunedCount = 0;

        // Separate intraday from safety snapshots
        $intraday = array_filter($backups, fn($b) => $b['type'] === 'Intraday Snapshot');

        if (count($intraday) > ($this->maxIntraday + $this->maxDaily)) {
            $toDelete = array_slice($intraday, $this->maxIntraday + $this->maxDaily);
            foreach ($toDelete as $b) {
                if (File::exists($b['filepath'])) {
                    File::delete($b['filepath']);
                    $prunedCount++;
                }
            }
        }

        // Clean safety backups older than 48 hours
        $safety = array_filter($backups, fn($b) => $b['type'] === 'Safety Pre-Restore');
        foreach ($safety as $s) {
            if ((time() - $s['timestamp']) > (48 * 3600)) {
                if (File::exists($s['filepath'])) {
                    File::delete($s['filepath']);
                    $prunedCount++;
                }
            }
        }

        return $prunedCount;
    }

    /**
     * Pure PHP SQL dump generator as a 100% portable fallback.
     */
    protected function generatePhpSqlDump(): string
    {
        $tables = DB::select('SHOW TABLES');
        $dbProp = 'Tables_in_' . config('database.connections.mysql.database', 'emergencydb');
        $out = "-- SINE MDRRMO Native Database Backup\n";
        $out .= "-- Generated: " . date('Y-m-d H:i:s') . "\n\n";
        $out .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ($tables as $tableObj) {
            $table = $tableObj->$dbProp ?? array_values((array)$tableObj)[0];

            $createRow = DB::selectOne("SHOW CREATE TABLE `{$table}`");
            $createSql = $createRow->{'Create Table'} ?? null;
            if ($createSql) {
                $out .= "DROP TABLE IF EXISTS `{$table}`;\n";
                $out .= $createSql . ";\n\n";
            }

            $rows = DB::table($table)->get();
            if ($rows->count() > 0) {
                $out .= "INSERT INTO `{$table}` VALUES \n";
                $rowStrings = [];
                foreach ($rows as $row) {
                    $values = array_map(function ($val) {
                        if (is_null($val)) return 'NULL';
                        return "'" . addslashes((string)$val) . "'";
                    }, (array)$row);
                    $rowStrings[] = "(" . implode(", ", $values) . ")";
                }
                $out .= implode(",\n", $rowStrings) . ";\n\n";
            }
        }

        $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
        return $out;
    }

    protected function findBinary(string $binary): ?string
    {
        $commonPaths = [
            $binary,
            '/usr/bin/' . $binary,
            '/usr/local/bin/' . $binary,
            'C:\\xampp\\mysql\\bin\\' . $binary . '.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\' . $binary . '.exe',
            'C:\\Program Files\\MariaDB 10.6\\bin\\' . $binary . '.exe',
        ];

        foreach ($commonPaths as $path) {
            if (File::exists($path) || @exec("where {$binary} 2>nul") || @exec("which {$binary} 2>/dev/null")) {
                return $binary;
            }
        }

        return null;
    }

    protected function resolveFilepath(string $filename): string
    {
        if (File::exists($filename)) {
            return $filename;
        }

        return $this->backupDir . '/' . ltrim($filename, '/\\');
    }

    protected function readGzipFile(string $filepath): string
    {
        $gz = gzopen($filepath, 'rb');
        if (!$gz) return '';

        $content = '';
        while (!gzeof($gz)) {
            $content .= gzread($gz, 65536);
        }
        gzclose($gz);
        return $content;
    }

    protected function formatBytes(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }

    protected function formatAge(int $timestamp): string
    {
        $diff = time() - $timestamp;
        if ($diff < 60) return 'Just now';
        if ($diff < 3600) return floor($diff / 60) . ' mins ago';
        if ($diff < 86400) return floor($diff / 3600) . ' hrs ago';
        return floor($diff / 86400) . ' days ago';
    }
}
