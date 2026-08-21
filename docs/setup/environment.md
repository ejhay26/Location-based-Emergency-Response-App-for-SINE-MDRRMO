# Environment Variables Reference

Complete guide for `backend/.env`. Copy `backend/.env.example` to `backend/.env` and configure the values below for local development or production deployment on a Linux Cloud Server.

> **Security Warning:** Never commit a filled `.env` file to version control. Keep `.env.example` populated with placeholder keys only. Real API tokens, database credentials, and private keys belong exclusively in your local and server `.env`.

---

## 1. Application & Core Config

| Variable | Default / Example | Purpose | Notes |
|---|---|---|---|
| `APP_NAME` | `Laravel` | Display name of the application | Used in emails and logs |
| `APP_ENV` | `local` / `production` | Environment mode | Set to `production` on live servers |
| `APP_KEY` | `base64:...` | Application encryption key | Generate via `php artisan key:generate` |
| `APP_DEBUG` | `true` (dev) / `false` (prod) | Stack trace & debug mode | **Must be `false` in production** to avoid leaking environment variables and system paths |
| `APP_URL` | `http://localhost:8000` / `https://api.yourdomain.com` | Base backend URL | Point to your domain, ngrok tunnel, or VPS IP |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost | Standard bcrypt workload |

---

## 2. Database Connection

| Variable | Default / Example | Purpose |
|---|---|---|
| `DB_CONNECTION` | `mysql` | MySQL / MariaDB connection driver |
| `DB_HOST` | `127.0.0.1` (local) / `localhost` | Database host IP or hostname |
| `DB_PORT` | `3306` | MariaDB / MySQL default port |
| `DB_DATABASE` | `emergencydb` | Database name |
| `DB_USERNAME` | `ejhay` (dedicated user) | Database user (**Never use `root` in production**) |
| `DB_PASSWORD` | `your_secure_password` | Database user password |

---

## 3. Real-Time Broadcasting (Laravel Reverb WebSockets)

| Variable | Default / Example | Purpose |
|---|---|---|
| `BROADCAST_CONNECTION` | `reverb` (or `log` in tests) | Broadcast driver for real-time events |
| `REVERB_APP_ID` | `mdrrmo_sine_app` | Reverb application ID |
| `REVERB_APP_KEY` | `xlq16kh4sisuz0kwe3sq` | Public WebSocket connection key (mirrored in `frontend/src/environments/environment.ts`) |
| `REVERB_APP_SECRET` | `your_reverb_secret` | Secret key used by backend to sign broadcast packets |
| `REVERB_HOST` | `0.0.0.0` (server) / `localhost` | Host interface for Reverb server |
| `REVERB_PORT` | `6001` | Dedicated WebSocket port (proxied via Nginx on port 80/443) |
| `REVERB_SCHEME` | `http` (local) / `https` (prod) | Connection protocol scheme |

---

## 4. Filesystem & Object Storage

| Variable | Default / Example | Purpose |
|---|---|---|
| `FILESYSTEM_DISK` | `s3` (prod) / `public` (local disk) | Primary storage disk for uploads (SOS photos/videos, Valid IDs, Avatars) |
| `AWS_ACCESS_KEY_ID` | `your_access_key` | S3 / Cloudflare R2 Access Key |
| `AWS_SECRET_ACCESS_KEY` | `your_secret_key` | S3 / Cloudflare R2 Secret Key |
| `AWS_DEFAULT_REGION` | `auto` / `us-east-1` | Storage bucket region |
| `AWS_BUCKET` | `mdrrmo-sine-storage` | Bucket name |
| `AWS_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` | Custom endpoint for S3-compatible providers (Cloudflare R2, AWS S3, MinIO) |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` | Required for path-style S3-compatible endpoints |

---

## 5. SMS Gateway (PhilSMS API v3)

Used for transactional OTP verification during registration, login, and password resets.

| Variable | Default / Example | Purpose |
|---|---|---|
| `PHILSMS_API_TOKEN` | `Bearer token from dashboard.philsms.com` | PhilSMS API v3 authentication token |
| `PHILSMS_SENDER_NAME` | `PhilSMS` | Approved alphanumeric SMS sender ID |

---

## 6. Email Service (SMTP / OTP Delivery)

| Variable | Default / Example | Purpose |
|---|---|---|
| `MAIL_MAILER` | `smtp` | Mail driver |
| `MAIL_HOST` | `smtp.gmail.com` | SMTP server host |
| `MAIL_PORT` | `465` (SSL) / `587` (TLS) | SMTP server port |
| `MAIL_USERNAME` | `ejcp2005@gmail.com` | Sender email address |
| `MAIL_PASSWORD` | `xxxx xxxx xxxx xxxx` | **Google App Password** (16 characters, not personal password) |
| `MAIL_ENCRYPTION` | `ssl` / `tls` | Encryption protocol |
| `MAIL_FROM_ADDRESS` | `"no-reply@sinemdrrmo.gov.ph"` | Sender email header |
| `MAIL_FROM_NAME` | `"MDRRMO SAN ISIDRO NUEVA ECIJA"` | Display name shown to recipients |

---

## 7. Push Notifications (Firebase Cloud Messaging)

| Variable | Default / Example | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `mdrrmo-sine-response-app` | Firebase project identifier |
| `FIREBASE_CREDENTIALS` | `storage/app/firebase-service-account.json` | Path to Firebase Admin SDK service account JSON file (**Must be gitignored**) |

---

## 8. Session, Cache & Queue

| Variable | Default / Example | Purpose |
|---|---|---|
| `SESSION_DRIVER` | `file` | Session storage driver (API uses Sanctum bearer tokens) |
| `CACHE_STORE` | `file` (local) / `redis` (prod) | Application cache driver |
| `QUEUE_CONNECTION` | `database` / `redis` | Queue driver for asynchronous notifications and emails |
| `REDIS_HOST` | `127.0.0.1` | Redis host (if using Redis cache/queue) |
| `REDIS_PORT` | `6379` | Redis port |
