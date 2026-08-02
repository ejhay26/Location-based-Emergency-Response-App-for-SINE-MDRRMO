# Production Deployment

## Setup

The backend ships as a **single Docker image** running nginx + php-fpm together via `supervisord`, based on `php:8.3-fpm-alpine`. Target hosting: AWS free tier.

```
backend/
├── Dockerfile              → nginx + php-fpm + supervisord, single container
├── docker-compose.yml      → starts/manages the container
└── docker/
    ├── nginx/nginx.conf
    ├── php/php.ini
    └── supervisord.conf
```

The database runs **outside** the container (on the host or a managed DB service) — the container reaches it via `host.docker.internal`, there's no bundled DB container.

## Building & Running

```bash
cd backend
docker compose up -d --build
```

This builds the image (installs PHP extensions, runs `composer install --no-dev --optimize-autoloader`, sets up `storage`/`bootstrap/cache` permissions for `www-data`) and starts the container on port `80`.

## Environment Overrides for Production

Set these no matter how the container gets launched — full reference in [Environment Variables](../setup/environment.md):

| Variable | Production value |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` — **important**; leaving this `true` in production shows stack traces and config to anyone who hits an error |
| `DB_HOST` | `host.docker.internal` (or your managed DB endpoint) |
| `DB_USERNAME` / `DB_PASSWORD` | A dedicated, limited DB user — never `root` |

`docker-compose.yml` already sets `APP_ENV`/`APP_DEBUG`/`DB_HOST`/`DB_PORT` — everything else (mail, Firebase, Semaphore, DB credentials) still needs to come from a production `.env` file, mounted or added in through your deploy process — **never committed to the image or the repo**.

## Keeping Uploaded Files Around

`storage/` and `bootstrap/cache/` are mounted as volumes in `docker-compose.yml` so uploaded SOS/hazard media and profile pictures survive container rebuilds. Without this, every redeploy would wipe out any evidence citizens submitted.

```yaml
volumes:
  - ./storage:/var/www/html/storage
  - ./bootstrap/cache:/var/www/html/bootstrap/cache
```

After the first deploy, run this once inside the container:
```bash
php artisan storage:link
```

## Notes on AWS Free Tier

- A `t2.micro`/`t3.micro` instance is enough to run this one container comfortably at capstone/pilot scale — it's not built for heavy production traffic.
- Keep the database off the same instance if you can (or watch memory closely if MariaDB and the app share one free-tier box).
- If you move media storage to S3 later, the `AWS_*` variables in `.env` are already there for it — see [Environment Variables — AWS](../setup/environment.md#aws-optional-production-storage).

## Frontend Deployment

There's no hosted web frontend — this avoids paying for frontend hosting entirely. The Ionic/Angular build output is packaged into native installs instead of being served from a URL:
- A signed APK/AAB via Capacitor for Android, and an IPA for iOS (citizen app)
- A native desktop install via Electron for Windows/macOS/Linux (admin/dispatcher app) — see [System Requirements](../setup/system-requirements.md)

Either way, point the app's API base URL at the deployed backend's real domain before building for release — not `localhost`. The backend API itself still needs to be hosted somewhere reachable (see above); it's only the frontend that skips hosting.

## Before You Deploy

- [ ] `APP_DEBUG=false`
- [ ] Production `.env` filled in (not the `.env.example` placeholders)
- [ ] Database seeded/migrated with a **schema-only or cleaned-up** dataset — see [Database Schema — Seed Data](../architecture/database-schema.md#seed-data)
- [ ] `storage:link` run inside the deployed container
- [ ] `storage/` volume mounted so uploads survive redeploys
- [ ] Firebase credentials JSON present but **not committed to version control**
- [ ] Frontend API base URL points at the production backend domain
