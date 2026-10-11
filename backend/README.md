# SINE-MDRRMO Backend (Go Fiber)

High-performance, low-latency municipal emergency response backend service built in **Go (Fiber v2 + GORM)**.

---

## Technical Highlights

| Capability | Specification |
| :--- | :--- |
| **Runtime Architecture** | Single compiled static binary running natively on host (zero container overhead) |
| **Idle Memory (RAM)** | **~15 MB - 35 MB** |
| **Startup Time** | **< 100 milliseconds** |
| **Throughput Capacity** | **10,000 - 45,000 req/s** |
| **WebSocket Engine** | Embedded Pusher / Echo compatible WebSocket hub on port 3000 |
| **Worker Engine** | Native asynchronous Go goroutines and buffered channels |
| **Database ORM** | GORM with connection pooling and automated schema migration |

---

## Architecture & Core Modules

1. **Routing & Endpoints (`internal/handlers/`)**
   - High-throughput REST API endpoints supporting all mobile and desktop dispatch operations.
   - Dual-mounted under both `/` and `/api` to work seamlessly with web, Android, iOS, and Tauri desktop clients.
2. **Authentication & Token Security (`internal/middleware/auth.go`)**
   - SHA-256 hashed Bearer token management in `personal_access_tokens`.
   - Granular role and ability authorization (`admin`, `dispatcher`, `citizen`).
3. **Real-Time WebSockets (`internal/websocket/hub.go`)**
   - Built-in WebSocket protocol server on `/app/:app_key`.
   - Broadcasts real-time events: `.EmergencyUpdated`, `.HazardUpdated`, `.BroadcastMessageUpdated`, and `.UserVerified`.
4. **Authoritative GIS Boundary Resolution (`internal/services/barangay_resolver.go`)**
   - Fast ray-casting point-in-polygon engine parsing San Isidro GeoJSON boundaries.
5. **Media & Storage Processing (`internal/services/media.go`)**
   - Base64 decoder with magic-byte file header validation (PNG, JPEG, MP4, WEBM).
   - Strict size ceilings: Profile (5MB), ID verification (10MB), Proof files (10MB).
   - Serves uploaded media statically on `/storage/...` with external storage path support via `STORAGE_PATH`.
6. **Transactional SMS (`internal/services/philsms.go`)**
   - PhilSMS API v3 integration with automated fallback to email.
7. **Email & Push Notifications (`internal/services/mailer.go`, `internal/services/firebase.go`)**
   - Resend SDK with HTML email templates (OTP, Welcome, Verification Declined, False Alarm Strike, Bug Report).
   - Firebase Cloud Messaging (FCM v1) with platform-specific Android/iOS payloads.
8. **Automated Disaster Recovery & Tile Caching (`internal/cron/cron.go`)**
   - Background cron scheduler for database snapshots and offline map tile cache warming.
9. **Offline Map Tile Proxy (`internal/handlers/tile_proxy.go`)**
   - Local disk-caching proxy for OpenStreetMap (street) and ArcGIS (satellite) tiles.

---

## Quick Start

### 1. Configure `.env`
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your MySQL/MariaDB database credentials in `.env` match your local or cloud database (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`).

### 2. Run Locally
Run directly with Go:
```bash
go run main.go
```

The server will automatically:
- Connect to your database
- Run `AutoMigrate` for all 16 tables
- Seed default accounts (`admin_user@sine.gov.ph` / `Admin123!`, `dis@mail.com` / `Dispatcher123!`), barangays, incident types, responders, and vehicles
- Start the embedded real-time WebSocket server
- Start the background cron scheduler
- Listen on `http://localhost:3000` (or configured `APP_PORT`)

---

## Database Backups & Disaster Recovery CLI Suite

The Go Fiber backend features an advanced, self-contained Disaster Recovery Engine with automated 2-hour intraday snapshots, smart typo detection, pre-restore safety shields, delta gap scanning, and notification dispatching:

| Command | Action | Description |
| :--- | :--- | :--- |
| `backup create` | Snapshot | Immediately creates a gzip-compressed database snapshot in `storage/app/backups/` and auto-prunes |
| `backup list [--all]` | List | Displays a formatted ASCII table of snapshots with sizes, human age, and types (Intraday vs Safety) |
| `backup desc [target]` | Describe | Inspects metadata, raw/compressed size, compression ratio, table counts, and latest SOS without restoring |
| `backup restore [target]` | Restore | Safely restores database with live vs. backup record diff preview, automatic safety snapshot, and confirmation |
| `backup salvage [target]` | Salvage | Scans storage proof folders (`reports`, `ids`, `profiles`) and logs for gap data created since snapshot |
| `backup notify [target]` | Notify | Sends polite recovery SMS (PhilSMS) and HTML email (Resend) notices to citizens identified during gap |
| `backup status` | Health | Displays automated schedule status, backup intervals, retention limits, total archives, and latest snapshot |
| `backup prune` | Clean | Enforces retention limits (12 intraday / 7 daily snapshots) and removes safety snapshots older than 48 hours |
| `backup watch` | Daemon | Runs automated background schedule worker in the foreground |
| `backup help` | Help | Displays interactive command reference, argument flags, and usage examples |

### Smart Target Resolution Modes
- **Numeric Shorthand:** `backup desc 1` (inspects newest snapshot #1), `backup restore 2` (restores snapshot #2)
- **Keywords:** `backup restore latest`, `backup desc recent`
- **Fuzzy / Substring Match:** `backup restore 150506` (matches snapshot timestamp `150506`)
- **Interactive Menu:** Run `backup restore` or `backup desc` with no arguments to browse paginated lists (`[n] Next`, `[p] Prev`, `[c] Cancel`)
- **Non-Interactive Bypass:** Append `--force` to bypass interactive confirmation prompts

### Smart Typo Detection
If an action is mistyped, the CLI calculates Levenshtein distance and immediately suggests the closest valid action:
```text
$ backup restor
 ❌ Unknown action: "restor"
 💡 Did you mean: "restore"?
```

### Storage Location
- **Local:** `backend/storage/app/backups/`
- **VPS Host:** `/var/www/backend/storage/app/backups/` (symlinked to `/var/www/sine-storage/app/backups/`)

