<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\DatabaseBackupService;
use App\Services\PhilSmsService;

class DatabaseBackupCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'backup
                            {action=help : create|list|desc|restore|salvage|notify|prune|help}
                            {target? : Snapshot filename or index (#1, latest, partial name)}
                            {--force : Force execution without interactive confirmation}';

    /**
     * The console command description.
     */
    protected $description = 'SINE MDRRMO Disaster Recovery Engine: Automated & manual database backup, inspection, restoration, delta salvaging, and notification.';

    protected array $validActions = [
        'create'  => 'Create an instant gzip-compressed database snapshot',
        'run'     => 'Alias for create',
        'list'    => 'List all available backup snapshots with sizes and ages',
        'desc'    => 'Inspect and count table records inside a snapshot without restoring',
        'describe'=> 'Alias for desc',
        'restore' => 'Safely restore the database from a snapshot with diff preview',
        'salvage' => 'Scan storage files and logs for unbacked records in the snapshot gap',
        'notify'  => 'Send polite recovery notification emails/SMS to citizens affected by a restore',
        'prune'   => 'Clean up old backups beyond the retention limits (12 intraday, 7 daily)',
        'status'  => 'Check automated backup schedule status and system health',
        'watch'   => 'Run the automated background backup schedule worker',
        'daemon'  => 'Alias for watch',
        'help'    => 'Display available disaster recovery commands and examples',
    ];

    public function handle(DatabaseBackupService $service, PhilSmsService $smsService): int
    {
        $action = strtolower($this->argument('action') ?: 'help');
        $target = $this->argument('target');

        // Check for typos and suggest closest action
        if (!array_key_exists($action, $this->validActions)) {
            $suggested = $this->findClosestAction($action);
            $this->newLine();
            $this->error(" ❌ Unknown action: \"{$action}\"");
            if ($suggested) {
                $this->warn(" 💡 Did you mean: \"{$suggested}\"?");
            }
            $this->newLine();
            $this->displayHelp();
            return 1;
        }

        switch ($action) {
            case 'create':
            case 'run':
                return $this->handleCreate($service);

            case 'list':
                return $this->handleList($service);

            case 'desc':
            case 'describe':
                return $this->handleDesc($service, $target);

            case 'restore':
                return $this->handleRestore($service, $target);

            case 'salvage':
                return $this->handleSalvage($service, $target);

            case 'notify':
                return $this->handleNotify($service, $smsService, $target);

            case 'prune':
                return $this->handlePrune($service);

            case 'status':
                return $this->handleStatus($service);

            case 'watch':
            case 'daemon':
                return $this->handleWatch();

            case 'help':
            default:
                $this->displayHelp();
                return 0;
        }
    }

    protected function handleCreate(DatabaseBackupService $service): int
    {
        $this->info('🔄 Creating database snapshot...');
        $result = $service->createSnapshot();

        if ($result['success']) {
            $this->newLine();
            $this->info(" ✅ Snapshot created successfully!");
            $this->line(" • File: <fg=cyan>{$result['filename']}</>");
            $this->line(" • Size: <fg=yellow>{$result['size_human']}</>");
            $this->line(" • Path: <fg=gray>{$result['filepath']}</>");
            $this->newLine();
            return 0;
        }

        $this->error(' ❌ Failed to create database snapshot.');
        return 1;
    }

    protected function handleList(DatabaseBackupService $service): int
    {
        $backups = $service->getBackupsList();

        $this->newLine();
        $this->info(" 📦 SINE MDRRMO Database Snapshots (" . count($backups) . " total)");
        $this->line(" Directory: <fg=gray>" . $service->getBackupDir() . "</>");
        $this->newLine();

        if (empty($backups)) {
            $this->warn(' No snapshots found. Run "backup create" to generate your first backup.');
            $this->newLine();
            return 0;
        }

        $tableData = [];
        foreach ($backups as $index => $b) {
            $tableData[] = [
                $index + 1,
                $b['filename'],
                $b['size_human'],
                $b['date_formatted'],
                $b['age_human'],
                $b['type'],
            ];
        }

        $this->table(['#', 'Filename', 'Size', 'Created At', 'Age', 'Type'], $tableData);
        $this->line(" 💡 Tip: Run <fg=cyan>backup desc <filename></> to inspect record counts.");
        $this->newLine();
        return 0;
    }

    protected function handleDesc(DatabaseBackupService $service, ?string $target): int
    {
        $target = $this->resolveTarget($service, $target);
        if (!$target) return 0;

        $this->info(" 🔍 Inspecting snapshot: <fg=cyan>{$target}</>");

        try {
            $desc = $service->describeSnapshot($target);
        } catch (\Throwable $e) {
            $this->error(" ❌ Failed to inspect snapshot: " . $e->getMessage());
            return 1;
        }

        $this->newLine();
        $this->line(" <fg=white;options=bold>📋 Snapshot Metadata & Compression:</>");
        $this->line(" • Filename:        <fg=cyan>{$desc['filename']}</>");
        $this->line(" • Snapshot Date:   <fg=yellow>{$desc['date_formatted']}</>");
        $this->line(" • Storage Size:    <fg=green>{$desc['size_compressed']}</> (Raw SQL: {$desc['size_raw']}, Savings: <fg=green>{$desc['compression_ratio']}</>)");
        $this->line(" • Total Tables:    <fg=cyan>{$desc['total_tables']}</>");
        $this->line(" • Grand Total Rows:<fg=yellow>{$desc['total_records']}</> records");

        if (!empty($desc['latest_incident_timestamp'])) {
            $this->line(" • Latest SOS In Archive: <fg=red;options=bold>{$desc['latest_incident_timestamp']}</>");
        }

        $this->newLine();
        $this->line(" <fg=white;options=bold>📊 Complete Database Tables Breakdown (" . count($desc['table_counts']) . " tables):</>");
        $tableData = [];
        foreach ($desc['table_counts'] as $tbl => $cnt) {
            $tableData[] = [$tbl, $cnt];
        }
        $this->table(['Table Name', 'Rows in Snapshot'], $tableData);
        $this->newLine();
        return 0;
    }

    protected function handleRestore(DatabaseBackupService $service, ?string $target): int
    {
        $target = $this->resolveTarget($service, $target);
        if (!$target) return 0;

        $this->warn(" ⚠️  PRE-RESTORE COMPARISON (Live DB vs Snapshot):");

        try {
            $preview = $service->getDiffPreview($target);
        } catch (\Throwable $e) {
            $this->error(" ❌ Failed to generate diff preview: " . $e->getMessage());
            return 1;
        }

        $tableData = [];
        foreach ($preview['diff'] as $table => $d) {
            $diffStr = $d['difference'] >= 0 ? "+{$d['difference']}" : "{$d['difference']}";
            $color = $d['difference'] === 0 ? 'white' : ($d['difference'] < 0 ? 'red' : 'green');
            $tableData[] = [
                $table,
                $d['live'],
                $d['backup'],
                "<fg={$color}>{$diffStr}</>",
            ];
        }

        $this->table(['Table', 'Live Records', 'Backup Records', 'Net Difference'], $tableData);

        if (!$this->option('force')) {
            $confirmed = $this->confirm(" ❓ Are you sure you want to RESTORE from \"{$target}\"?\n    (An automatic safety snapshot of the live database will be created first)", false);
            if (!$confirmed) {
                $this->info(" ⏹️ Restoration cancelled by user.");
                return 0;
            }
        }

        $this->info(" 🔄 Creating safety snapshot of live database...");
        try {
            $res = $service->restoreSnapshot($target);
        } catch (\Throwable $e) {
            $this->error(" ❌ Restoration failed: " . $e->getMessage());
            return 1;
        }

        $this->newLine();
        $this->info(" ✅ Database restored successfully from \"{$res['restored_file']}\"!");
        $this->line(" 🛡️ Safety pre-restore snapshot saved: <fg=cyan>{$res['safety_backup']}</>");
        $this->line(" 💡 Next step: Run <fg=yellow>backup salvage {$target}</> to check for unbacked registrations during the gap.");
        $this->newLine();
        return 0;
    }

    protected function handleSalvage(DatabaseBackupService $service, ?string $target): int
    {
        $target = $this->resolveTarget($service, $target);
        if (!$target) return 0;

        $this->info(" 🔍 Scanning storage proofs and logs for unbacked gap data...");

        try {
            $salvage = $service->salvageGapData($target);
        } catch (\Throwable $e) {
            $this->error(" ❌ Salvage scan failed: " . $e->getMessage());
            return 1;
        }

        $this->newLine();
        $this->line(" <fg=white;options=bold>⏱️ Snapshot Timestamp:</> {$salvage['snapshot_time']}");
        $this->line(" <fg=white;options=bold>📁 New Proof Files in Storage since snapshot:</> {$salvage['gap_files_count']}");

        if ($salvage['gap_files_count'] > 0) {
            $fileData = [];
            foreach ($salvage['gap_files'] as $f) {
                $fileData[] = [$f['path'], $f['size'], $f['created_at']];
            }
            $this->table(['Relative File Path', 'Size', 'Created At'], $fileData);
        }

        $this->newLine();
        $this->line(" <fg=white;options=bold>👥 Unbacked Registrations / OTP Activity Detected:</> {$salvage['gap_citizens_count']}");

        if ($salvage['gap_citizens_count'] > 0) {
            $citizenData = [];
            foreach ($salvage['gap_phones'] as $ph => $time) {
                $citizenData[] = ['SMS / Phone', $ph, $time];
            }
            foreach ($salvage['gap_emails'] as $em => $time) {
                $citizenData[] = ['Email', $em, $time];
            }
            $this->table(['Channel', 'Target Identifier', 'Activity Timestamp'], $citizenData);

            $this->newLine();
            $this->line(" 💡 Run <fg=cyan>backup notify {$target}</> to send polite recovery notices to these citizens.");
        } else {
            $this->info(" ✅ Zero gap data detected. The database was 100% synchronized with the snapshot!");
        }

        $this->newLine();
        return 0;
    }

    protected function handleNotify(DatabaseBackupService $service, PhilSmsService $smsService, ?string $target): int
    {
        $target = $this->resolveTarget($service, $target);
        if (!$target) return 0;

        if (!$this->option('force')) {
            $confirmed = $this->confirm(" ❓ Send recovery notice emails and SMS to citizens identified in the gap of \"{$target}\"?", true);
            if (!$confirmed) {
                $this->info(" ⏹️ Notification dispatch cancelled.");
                return 0;
            }
        }

        $this->info(" 📨 Dispatching recovery notifications...");
        $res = $service->notifyGapCitizens($target, $smsService);

        $this->newLine();
        $this->info(" ✅ Notification dispatch complete!");
        $this->line(" • Total Targets: {$res['total_targets']}");
        $this->line(" • Successfully Sent: <fg=green>{$res['notified']}</>");
        if ($res['failed'] > 0) {
            $this->line(" • Failed: <fg=red>{$res['failed']}</>");
        }
        $this->newLine();
        return 0;
    }

    protected function handlePrune(DatabaseBackupService $service): int
    {
        $this->info(" 🧹 Enforcing backup retention limits (12 intraday / 7 daily)...");
        $pruned = $service->pruneOldBackups();
        $this->info(" ✅ Pruning complete. {$pruned} old snapshot(s) deleted.");
        return 0;
    }

    protected function handleStatus(DatabaseBackupService $service): int
    {
        $autoEnabled = filter_var(env('BACKUP_AUTO_ENABLED', true), FILTER_VALIDATE_BOOLEAN);
        $intervalHours = (int) env('BACKUP_INTERVAL_HOURS', 2);
        $maxIntraday = (int) env('BACKUP_MAX_INTRADAY', 12);
        $maxDaily = (int) env('BACKUP_MAX_DAILY', 7);
        $backups = $service->getBackupsList();

        $this->newLine();
        $this->line(" <fg=white;options=bold>📊 SINE MDRRMO Disaster Recovery Status & Health:</>");
        $this->newLine();

        $statusStr = $autoEnabled ? "<fg=green;options=bold>● ON (Active in .env)</>" : "<fg=red;options=bold>○ OFF (Disabled in .env)</>";
        $this->line(" • Automated Backup:   {$statusStr}");
        $this->line(" • Backup Interval:    <fg=yellow>Every {$intervalHours} Hours</>");
        $this->line(" • Retention Limits:   <fg=cyan>{$maxIntraday} Intraday / {$maxDaily} Daily Snapshots</>");
        $this->line(" • Total Snapshots:    <fg=white>" . count($backups) . " archives</>");

        if (!empty($backups)) {
            $latest = $backups[0];
            $this->line(" • Latest Snapshot:    <fg=cyan>{$latest['filename']}</> ({$latest['size_human']}, <fg=yellow>{$latest['age_human']}</>)");
        } else {
            $this->line(" • Latest Snapshot:    <fg=gray>None yet (run 'backup create')</>");
        }

        $this->newLine();
        $this->line(" <fg=white;options=bold>💡 How to run the automated daemon:</>");
        $this->line(" • On Windows (local):   Run <fg=yellow>backend\\bin\\backup.bat watch</> in a background terminal");
        $this->line(" • In Docker / VPS:      Automatically managed 24/7 by <fg=cyan>supervisord</>");
        $this->newLine();
        return 0;
    }

    protected function handleWatch(): int
    {
        $this->info(" 🔄 Starting SINE MDRRMO automated backup schedule daemon...");
        $this->line(" Press <fg=yellow>Ctrl+C</> to stop.");
        $this->newLine();
        return $this->call('schedule:work');
    }

    protected function resolveTarget(DatabaseBackupService $service, ?string $target): ?string
    {
        $backups = $service->getBackupsList();
        if (empty($backups)) {
            $this->error(" ❌ No backup files found in " . $service->getBackupDir());
            return null;
        }

        // 1. If target was provided, try exact, numeric index, keyword, or smart partial matching
        if (!empty($target)) {
            $cleanTarget = trim($target);

            // Numeric index support (e.g. "1" or "#1" selects 1st backup from list)
            if (preg_match('/^#?(\d+)$/', $cleanTarget, $m)) {
                $idx = ((int)$m[1]) - 1;
                if (isset($backups[$idx])) {
                    $selected = $backups[$idx]['filename'];
                    $this->line(" 🎯 Selected #{$m[1]}: <fg=cyan>{$selected}</>");
                    return $selected;
                }
            }

            // Keyword "latest" or "newest"
            if (in_array(strtolower($cleanTarget), ['latest', 'newest', 'recent', 'last'])) {
                $selected = $backups[0]['filename'];
                $this->line(" 🎯 Selected latest snapshot: <fg=cyan>{$selected}</>");
                return $selected;
            }

            // Exact file match
            foreach ($backups as $b) {
                if ($b['filename'] === $cleanTarget) {
                    return $b['filename'];
                }
            }

            // Partial/fuzzy substring match (e.g. "185124" or "08-22" or "safety")
            $matches = array_values(array_filter($backups, function ($b) use ($cleanTarget) {
                return stripos($b['filename'], $cleanTarget) !== false;
            }));

            if (count($matches) === 1) {
                $selected = $matches[0]['filename'];
                $this->line(" 🎯 Matched snapshot: <fg=cyan>{$selected}</>");
                return $selected;
            }

            if (count($matches) > 1) {
                $this->line(" 🔍 Multiple snapshots matched \"{$cleanTarget}\":");
                $choices = [];
                foreach ($matches as $i => $m) {
                    $choices[(string)$i] = "{$m['filename']} ({$m['size_human']}, {$m['age_human']})";
                }
                $choices['c'] = "❌ Cancel / Exit";
                $selected = $this->choice(" Select a snapshot", $choices, '0');
                if ($selected === 'c' || $selected === '❌ Cancel / Exit') {
                    $this->info(" ⏹️ Operation cancelled.");
                    return null;
                }
                return $matches[(int)$selected]['filename'] ?? $selected;
            }

            $this->error(" ❌ No snapshot found matching \"{$cleanTarget}\".");
            $this->newLine();
        }

        // 2. If no target provided and running non-interactively (--force), default to latest
        if ($this->option('force')) {
            return $backups[0]['filename'];
        }

        // 3. Paginated interactive selection menu with Cancel/Exit
        $page = 0;
        $perPage = 5;
        $total = count($backups);
        $totalPages = max(1, (int)ceil($total / $perPage));

        while (true) {
            $slice = array_slice($backups, $page * $perPage, $perPage);
            $pageNumber = $page + 1;

            $this->newLine();
            $this->info(" 📦 Available Snapshots (Page {$pageNumber} of {$totalPages}):");

            $choices = [];
            $choiceMap = [];

            foreach ($slice as $i => $b) {
                $globalIdx = ($page * $perPage) + $i + 1;
                $label = ($globalIdx === 1) ? "[Latest] " : "";
                $key = (string)($i);
                $choices[$key] = "{$label}{$b['filename']}  ({$b['size_human']}, {$b['age_human']})";
                $choiceMap[$key] = $b['filename'];
            }

            if ($pageNumber < $totalPages) {
                $choices['n'] = "➡️  Next Page (Page " . ($pageNumber + 1) . ")";
            }

            if ($page > 0) {
                $choices['p'] = "⬅️  Previous Page (Page " . ($pageNumber - 1) . ")";
            }

            $choices['c'] = "❌ Cancel / Exit";

            $selected = $this->choice(" Select a snapshot to proceed", $choices, '0');

            if ($selected === 'c' || $selected === '❌ Cancel / Exit') {
                $this->info(" ⏹️ Operation cancelled.");
                return null;
            }

            if ($selected === 'n' || str_starts_with($selected, '➡️')) {
                $page++;
                continue;
            }

            if ($selected === 'p' || str_starts_with($selected, '⬅️')) {
                $page--;
                continue;
            }

            if (isset($choiceMap[$selected])) {
                $this->newLine();
                return $choiceMap[$selected];
            }

            foreach ($choiceMap as $k => $filename) {
                if ($selected === $choices[$k] || $selected === $filename) {
                    $this->newLine();
                    return $filename;
                }
            }
        }
    }

    protected function findClosestAction(string $input): ?string
    {
        $closest = null;
        $shortest = -1;

        foreach (array_keys($this->validActions) as $action) {
            $lev = levenshtein($input, $action);
            if ($lev <= 3 && ($lev < $shortest || $shortest < 0)) {
                $closest = $action;
                $shortest = $lev;
            }
        }

        return $closest;
    }

    protected function displayHelp(): void
    {
        $this->newLine();
        $this->line(" <fg=red;options=bold>SINE MDRRMO Disaster Recovery Engine</> — High-Level Backup & Recovery CLI");
        $this->line(" <fg=gray>Usage:</> <fg=yellow>backup <action> [target_file] [--force]</>");
        $this->newLine();
        $this->line(" <fg=white;options=bold>Available Actions:</>");

        $rows = [];
        foreach ($this->validActions as $act => $desc) {
            if ($act !== 'run' && $act !== 'describe') {
                $rows[] = ["<fg=cyan>{$act}</>", $desc];
            }
        }
        $this->table(['Action', 'Description'], $rows);

        $this->newLine();
        $this->line(" <fg=white;options=bold>Examples:</>");
        $this->line(" • <fg=yellow>backup create</>                     Take an instant compressed database snapshot");
        $this->line(" • <fg=yellow>backup list</>                       Show all available snapshots and sizes");
        $this->line(" • <fg=yellow>backup desc</>                       Inspect table record counts (interactive select)");
        $this->line(" • <fg=yellow>backup desc 1</>                     Inspect snapshot #1");
        $this->line(" • <fg=yellow>backup desc 185124</>                Inspect snapshot matching timestamp fragment");
        $this->line(" • <fg=yellow>backup restore</>                    Safe interactive restore with diff preview");
        $this->line(" • <fg=yellow>backup salvage</>                    Scan storage and logs for unbacked gap data");
        $this->line(" • <fg=yellow>backup notify</>                     Send recovery notice SMS/emails to gap citizens");
        $this->newLine();
    }
}
