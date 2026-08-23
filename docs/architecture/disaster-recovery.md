# Disaster Recovery (DR) & Database Backup Engine

Comprehensive documentation of the SINE MDRRMO high-level Database Disaster Recovery Engine, automated interval snapshotting, delta gap salvaging, and recovery procedures.

---

## 1. Overview

The SINE MDRRMO Disaster Recovery Engine is a self-contained, high-performance database protection system built natively inside Laravel (`backend/app/Services/DatabaseBackupService.php` and `backend/app/Console/Commands/DatabaseBackupCommand.php`).

### Core Highlights:
- **Zero External Dependencies:** 100% native PHP and MySQL integration. No third-party containers or extra background daemons required.
- **Automated 2-Hour Intraday Snapshots:** Automatically generates lightweight, Gzip-compressed `.sql.gz` archives every 2 hours during operational hours.
- **Smart Retention Manager:** Keeps the last **12 intraday snapshots** and **7 daily archives**, automatically purging older backups to maintain minimal disk footprint.
- **Human-Friendly CLI Commands:** Simple commands (`backup create`, `backup list`, `backup desc`, `backup restore`, `backup salvage`, `backup notify`) with smart typo suggestion.
- **Pre-Restore Safety Shield:** Automatically creates a safety snapshot of the live database *before* executing any restore operation.
- **Delta Gap Salvaging:** Scans storage files (`storage/app/public/`) and audit logs (`storage/logs/laravel.log`) for registrations and proof files created after the snapshot, preventing unbacked citizen data loss.
- **Automated Citizen Re-Notification:** Automatically dispatches polite transactional SMS (PhilSMS) and emails to citizens who signed up during the recovery gap.

---

## 2. CLI Command Suite

Executable wrappers are located in `backend/bin/` for self-contained deployment:
- **Linux / Docker / VPS:** `backend/bin/backup <action>` (or symlinked to `/usr/local/bin/backup`)
- **Windows:** `backend\bin\backup.bat <action>`
- **Artisan direct:** `php artisan backup <action>` (from `backend/`)

| Command | Action | Description |
|---|---|---|
| `backup create` | Snapshot | Generates an instant, gzip-compressed snapshot in `storage/app/backups/`. |
| `backup list` | List | Displays an ASCII table of all available snapshots with file sizes, timestamps, and age. |
| `backup desc [target]` | Describe | Safely parses the archive to display table record counts (`users`, `emergencies`, `hazards`, etc.) without restoring. Supports numeric indexes (`1`, `2`), fuzzy substrings (`185124`), keywords (`latest`), or interactive prompt. |
| `backup restore [target]` | Restore | Shows a live vs. backup record diff preview, creates an automatic safety backup, and restores the database upon confirmation. Supports numeric index, fuzzy matching, or interactive selection. |
| `backup salvage [target]` | Salvage | Scans storage proofs and logs for unbacked registrations or uploads created during the gap between snapshot time and crash time. |
| `backup notify [target]` | Notify | Sends automated, polite recovery emails and SMS via PhilSMS to citizens affected by a restore. |
| `backup status` | Health | Displays automated backup ON/OFF status, configured interval, retention limits, and latest snapshot. |
| `backup watch` | Daemon | Starts the automated background schedule worker on local development machines. |
| `backup prune` | Clean | Manually enforces the retention limits (12 intraday / 7 daily snapshots). |
| `backup help` | Help | Displays interactive command usage and examples. |

### Configuration (`.env`):
```env
BACKUP_AUTO_ENABLED=true        # Toggle automated backup schedule (true/false)
BACKUP_INTERVAL_HOURS=2        # Frequency in hours (e.g. 1, 2, 4, 6)
BACKUP_MAX_INTRADAY=12         # Number of recent intraday snapshots to keep
BACKUP_MAX_DAILY=7             # Number of daily archives to keep
```

### Smart Target Resolution Modes:
- **Paginated Interactive Menu:** Run `backup restore` or `backup desc` with no arguments to navigate pages (`[n] Next`, `[p] Prev`) and safely abort with `[c] ❌ Cancel / Exit`.
- **Numeric Shorthand:** `backup desc 1` (inspects #1 newest), `backup restore 2` (restores snapshot #2).
- **Partial / Fuzzy Matching:** `backup desc 185124` (matches any file containing `185124`), `backup desc safety`.
- **Keywords:** `backup restore latest`, `backup desc recent`.

---

## 3. Command Examples & Output

### 3.1 Creating a Snapshot
```bash
backup create
```
```text
🔄 Creating database snapshot...

 ✅ Snapshot created successfully!
 • File: emergencydb_2026-08-23_020000.sql.gz
 • Size: 11.49 KB
 • Path: backend/storage/app/backups/emergencydb_2026-08-23_020000.sql.gz
```

---

### 3.2 Listing Snapshots
```bash
backup list
```
```text
 📦 SINE MDRRMO Database Snapshots (3 total)
 Directory: backend/storage/app/backups

+---+--------------------------------------+----------+---------------------+------------+-------------------+
| # | Filename                             | Size     | Created At          | Age        | Type              |
+---+--------------------------------------+----------+---------------------+------------+-------------------+
| 1 | emergencydb_2026-08-23_020000.sql.gz | 11.49 KB | 2026-08-23 02:00:00 | 5 mins ago | Intraday Snapshot |
| 2 | emergencydb_2026-08-23_000000.sql.gz | 11.42 KB | 2026-08-23 00:00:00 | 2 hrs ago  | Intraday Snapshot |
| 3 | emergencydb_2026-08-22_000000.sql.gz | 11.20 KB | 2026-08-22 00:00:00 | 1 days ago | Daily Snapshot    |
+---+--------------------------------------+----------+---------------------+------------+-------------------+
 💡 Tip: Run backup desc <filename> to inspect record counts.
```

---

### 3.3 Inspecting Snapshot Record Counts
```bash
backup desc
```
```text
 ℹ️ No filename specified. Using latest snapshot: emergencydb_2026-08-23_020000.sql.gz
 🔍 Inspecting snapshot: emergencydb_2026-08-23_020000.sql.gz

 📋 Snapshot Metadata:
 • Filename:    emergencydb_2026-08-23_020000.sql.gz
 • Created At:  2026-08-23 02:00:00
 • Compressed:  11.49 KB (Raw: 65.74 KB, Savings: 82.5%)

 📊 Core Tables & Record Counts:
+------------------------+--------------------------+
| Table Name             | Record Count in Snapshot |
+------------------------+--------------------------+
| users                  | 6                        |
| emergency_requests     | 13                       |
| dispatches             | 0                        |
| hazards                | 2                        |
| broadcasts             | 18                       |
| barangays              | 9                        |
| responders             | 4                        |
| vehicles               | 4                        |
| user_settings          | 12                       |
| personal_access_tokens | 2                        |
+------------------------+--------------------------+
```

---

### 3.4 Interactive Restoration with Safety Shield
```bash
backup restore
```
```text
 ⚠️  PRE-RESTORE COMPARISON (Live DB vs Snapshot):
+--------------------+--------------+----------------+----------------+
| Table              | Live Records | Backup Records | Net Difference |
+--------------------+--------------+----------------+----------------+
| users              | 6            | 6              | 0              |
| emergency_requests | 13           | 13             | 0              |
| hazards            | 2            | 2              | 0              |
| broadcasts         | 18           | 18             | 0              |
+--------------------+--------------+----------------+----------------+

 ❓ Are you sure you want to RESTORE from "emergencydb_2026-08-23_020000.sql.gz"?
    (An automatic safety snapshot of the live database will be created first) (yes/no) [no]:
 > yes

 🔄 Creating safety snapshot of live database...
 ✅ Database restored successfully from "emergencydb_2026-08-23_020000.sql.gz"!
 🛡️ Safety pre-restore snapshot saved: salvage_safety_2026-08-23_021530.sql.gz
 💡 Next step: Run backup salvage to check for unbacked registrations during the gap.
```

---

### 3.5 Scanning Delta Gap & Sending Re-Notification
```bash
backup salvage
```
```text
 🔍 Scanning storage proofs and logs for unbacked gap data...

 ⏱️ Snapshot Timestamp: 2026-08-23 02:00:00
 📁 New Proof Files in Storage since snapshot: 1
+------------------------------------+---------+---------------------+
| Relative File Path                 | Size    | Created At          |
+------------------------------------+---------+---------------------+
| ids/id_front_639171234567.jpg      | 420 KB  | 2026-08-23 02:10:15 |
+------------------------------------+---------+---------------------+

 👥 Unbacked Registrations / OTP Activity Detected: 1
+------------+-------------------+---------------------+
| Channel    | Target Identifier | Activity Timestamp  |
+------------+-------------------+---------------------+
| SMS / Phone| 639171234567      | 2026-08-23 02:09:40 |
+------------+-------------------+---------------------+

 💡 Run backup notify to send polite recovery notices to these citizens.
```

```bash
backup notify
```
```text
 ❓ Send recovery notice emails and SMS to citizens identified in the gap of "emergencydb_2026-08-23_020000.sql.gz"? (yes/no) [yes]:
 > yes

 📨 Dispatching recovery notifications...
 ✅ Notification dispatch complete!
 • Total Targets: 1
 • Successfully Sent: 1
```

---

### 3.6 Polite Recovery Email Template (Blade Mailable)
When `backup notify` is executed, affected citizens receive a responsive, styled email created via `App\Mail\DisasterRecoveryNoticeMail` and rendered through [disaster-recovery.blade.php](file:///c:/Users/Administrator/Desktop/Capstone%20Project/Location-based-Emergency-Response-App-for-SINE-MDRRMO/backend/resources/views/emails/disaster-recovery.blade.php):
- **Branding:** Official MDRRMO Emergency Red header (`#D32F2F`) and card layout.
- **Tone:** Empathetic apology and transparent explanation of the system synchronization.
- **Call to Action:** Simple steps for citizens to log in or complete verification if their session was unbacked.
- **24/7 Hotlines:** Direct Globe, Smart, and Landline contact numbers for immediate emergency dispatch.

---

## 4. Automated Interval Scheduling

The engine is scheduled via Laravel's task runner in `backend/routes/console.php`:

```php
use Illuminate\Support\Facades\Schedule;

// SINE MDRRMO Automated Disaster Recovery Schedule
// Takes a compressed database snapshot every 2 hours and auto-prunes older snapshots
Schedule::command('backup create')->everyTwoHours();
```

When running in containerized production (via Podman/Docker), Laravel's scheduler worker automatically fires `backup create` every 2 hours in the background with zero performance impact.

---

## 5. Smart Typo Detection

If an administrator mistypes a command, the CLI calculates Levenshtein distance and immediately suggests the intended command:

```bash
$ backup crteate
 ❌ Unknown action: "crteate"
 💡 Did you mean: "create"?

$ backup lst
 ❌ Unknown action: "lst"
 💡 Did you mean: "list"?
```
