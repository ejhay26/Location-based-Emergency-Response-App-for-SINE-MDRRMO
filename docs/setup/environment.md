# Environment Variables Reference

Complete guide for `backend/.env`. Copy `backend/.env.example` to `backend/.env` and configure the values below for local development or production deployment on a Linux Cloud Server.

> **Security Warning:** Never commit a filled `.env` file to version control. Keep `.env.example` populated with placeholder keys only. Real API tokens, database credentials, and private keys belong exclusively in your local and server `.env`.

---

## 1. Application & Core Config

| Variable | Default / Example | Purpose | Notes |
|---|---|---|---|
| `APP_NAME` | `"SINE-MDRRMO"` | Display name of the application | Used in emails and logs |
| `APP_ENV` | `local` / `production` | Environment mode | Set to `production` on live servers |
| `APP_DEBUG` | `true` (dev) / `false` (prod) | Verbose logging & debug mode | **Must be `false` in production** |
| `APP_URL` | `http://localhost:3000` / `http://159.223.42.159:3000` | Base backend URL | Point to your domain or VPS IP |
| `APP_PORT` | `3000` | Port on which the Go micro-daemon listens | Default unified port |

---

## 2. Database Connection (MySQL / MariaDB)

| Variable | Default / Example | Purpose |
|---|---|---|
| `DB_HOST` | `127.0.0.1` (local) / `localhost` | Database host IP or hostname |
| `DB_PORT` | `3306` | MariaDB / MySQL default port |
| `DB_DATABASE` | `emergencydb` | Database name |
| `DB_USERNAME` | `your_db_username` | Database user |
| `DB_PASSWORD` | `your_secure_password` | Database user password |

---

## 3. Real-Time Broadcasting (Embedded WebSocket Engine)

| Variable | Default / Example | Purpose |
|---|---|---|
| `REVERB_APP_ID` | `sine` | WebSocket application ID |
| `REVERB_APP_KEY` | `6bc0e7b80b37c8d8d8f8` | Public WebSocket connection key (mirrored in `frontend/src/environments/environment.ts`) |
| `REVERB_APP_SECRET` | `sine_secret` | Secret key used to sign broadcast packets |
| `REVERB_HOST` | `0.0.0.0` (server) / `localhost` | Host interface for WebSocket server |
| `REVERB_PORT` | `3000` | Port for WebSocket traffic (unified on port 3000) |

---

## 4. Filesystem & Storage

| Variable | Default / Example | Purpose |
|---|---|---|
| `FILESYSTEM_DISK` | `public` | Storage disk mode |
| `STORAGE_PATH` | `/var/www/sine-storage/app/public` | Optional isolated directory path for uploaded media & documents |

---

## 5. SMS Gateway (PhilSMS API v3)

Used for transactional OTP verification during registration, login, and password resets.

| Variable | Default / Example | Purpose |
|---|---|---|
| `PHILSMS_API_TOKEN` | `Bearer token from dashboard.philsms.com` | PhilSMS API v3 authentication token |
| `PHILSMS_SENDER_NAME` | `PhilSMS` | Approved alphanumeric SMS sender ID |

---

## 6. Email Service (Resend API)

| Variable | Default / Example | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxx` | Resend API key for fast, reliable transactional email |
| `MAIL_FROM_ADDRESS` | `"onboarding@resend.dev"` / `"no-reply@sinemdrrmo.gov.ph"` | Sender email address |
| `MAIL_FROM_NAME` | `"MDRRMO SAN ISIDRO NUEVA ECIJA EMERGENCY RESPONSE APP"` | Display name shown to recipients |

---

## 7. Push Notifications (Firebase Cloud Messaging v1)

| Variable | Default / Example | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `mdrrmo-sine-response-app` | Firebase project identifier |
| `FIREBASE_CREDENTIALS` | `storage/app/mdrrmo-sine-response-app-firebase-adminsdk-fbsvc-73bd4e4846.json` | Path to Firebase Admin SDK service account JSON file (**Gitignored**) |

---

## 8. Automated Backups & CORS

| Variable | Default / Example | Purpose |
|---|---|---|
| `BACKUP_AUTO_ENABLED` | `true` | Enables background periodic database snapshots |
| `BACKUP_INTERVAL_HOURS` | `2` | Interval between intraday snapshots |
| `BACKUP_MAX_INTRADAY` | `12` | Maximum retained intraday backups |
| `BACKUP_MAX_DAILY` | `7` | Maximum retained daily backups |
| `CORS_ALLOW_ORIGINS` | `*` | Allowed CORS origins for web & mobile clients |
| `DEV_SUPPORT_EMAIL` | `ejcp2005@gmail.com` | Developer contact for automated alert reports |

