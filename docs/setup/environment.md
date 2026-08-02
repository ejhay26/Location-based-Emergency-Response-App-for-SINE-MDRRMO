# Environment Variables

Reference for `backend/.env`. Copy `backend/.env.example` to `backend/.env` and fill in the values below — see [Installation Guide](./installation.md) for the full setup flow.

> **Security note:** never commit a filled-in `.env` file. `.env.example` should only ever have placeholders — real credentials, API keys, and mail passwords belong in your local/server `.env` only, which is already `.gitignore`d.

## Application

| Variable | Purpose |
|---|---|
| `APP_NAME` | Display name of the app |
| `APP_ENV` | `local`, `staging`, or `production` |
| `APP_KEY` | Laravel's encryption key — generate with `php artisan key:generate`, never set by hand |
| `APP_DEBUG` | **Must be `false` in production** — a debug-enabled Laravel app shows stack traces, `.env` values, and file paths to anyone who triggers an error |
| `APP_URL` | Base URL the backend runs on |
| `BCRYPT_ROUNDS` | Password hashing cost (default `12`) |

## Database

| Variable | Purpose |
|---|---|
| `DB_CONNECTION` | `mysql` (MariaDB-compatible) |
| `DB_HOST` | Database host — `127.0.0.1` locally, `host.docker.internal` if the API is in a Docker container reaching a DB on the host |
| `DB_PORT` | Default `3306` |
| `DB_DATABASE` | `emergencydb` |
| `DB_USERNAME` / `DB_PASSWORD` | Use a **dedicated, limited-access database user** — never `root`. See [Installation Guide](./installation.md#4-set-your-database-credentials) |

## Session, Cache & Queue

| Variable | Purpose |
|---|---|
| `SESSION_DRIVER`, `SESSION_LIFETIME`, `SESSION_ENCRYPT` | Session config (the API mainly uses Sanctum tokens, not sessions) |
| `CACHE_STORE` | `file` locally; consider `redis` in production |
| `QUEUE_CONNECTION` | `database` — used for queued jobs (e.g. sending notifications) |
| `FILESYSTEM_DISK` | `public` — needed for `storage:link` to serve SOS/hazard media and profile pictures |

## Mail (OTP emails)

| Variable | Purpose |
|---|---|
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` / `MAIL_PORT` | SMTP provider (Gmail SMTP by default) |
| `MAIL_USERNAME` | The mailbox address sending the emails |
| `MAIL_PASSWORD` | **An app password**, not your regular login password — for Gmail, generate one under Google Account → Security → App Passwords |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | The sender info citizens see on OTP emails |

Used by the registration, login, password-change, and password-reset OTP flows — see [API — Auth](../api/auth.md).

## SMS (Semaphore)

| Variable | Purpose |
|---|---|
| `SEMAPHORE_API_KEY` | API key for the Semaphore SMS gateway |
| `SEMAPHORE_SENDER_NAME` | Sender name shown on outgoing SMS |

## Push Notifications (Firebase)

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CREDENTIALS` | Path to the Firebase Admin SDK service-account JSON — **keep this file out of version control**, treat it like a secret key |

## AWS (optional — production storage)

| Variable | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials for an S3-compatible bucket, if you move media storage off the app server |
| `AWS_DEFAULT_REGION` | Bucket region |
| `AWS_BUCKET` | Bucket name |
| `AWS_USE_PATH_STYLE_ENDPOINT` | Set `true` for path-style S3-compatible endpoints (e.g. MinIO) |

Only needed if you move off local disk storage — see [Production Deployment](../deployment/production.md).
