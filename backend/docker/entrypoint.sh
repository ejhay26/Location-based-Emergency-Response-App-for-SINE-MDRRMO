#!/bin/sh
# ── Container entrypoint ─────────────────────────────────────────────────
# Runs once per container start, BEFORE supervisord takes over (php-fpm +
# nginx). Env vars (DB_*, AWS_*, APP_KEY, ...) are injected at runtime by
# the platform (Northflank/Render/etc. dashboard, or docker-compose's
# env_file), never baked into the image — .env is excluded via
# .dockerignore. That means config caching MUST happen here, not in the
# Dockerfile build step, or it would cache empty/missing values.
set -e

cd /var/www/html

# ── 0. Fail fast on missing critical config ─────────────────────────────
if [ -z "$APP_KEY" ]; then
    echo "FATAL: APP_KEY is not set in the environment. Refusing to start." >&2
    echo "       Generate one locally with 'php artisan key:generate --show'" >&2
    echo "       and set it as a secret/env var on your host platform." >&2
    exit 1
fi

# ── 1. Ensure writable dirs exist (volumes can reset perms on mount) ────
mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# ── 2. Always clear any stale cached config from a previous image/build ─
php artisan config:clear >/dev/null 2>&1 || true

# ── 3. Re-cache for production performance (skip when APP_ENV=local so
#       local podman-compose dev still picks up .env edits without a
#       rebuild/restart) ───────────────────────────────────────────────
if [ "$APP_ENV" != "local" ]; then
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

# ── 4. Opt-in migrations — never run automatically/silently against a
#       live emergency-response database. Set RUN_MIGRATIONS=true only
#       when you intend a deploy to migrate. ───────────────────────────
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "RUN_MIGRATIONS=true — running: php artisan migrate --force"
    php artisan migrate --force
fi

# ── 5. Recreate the public/storage symlink if the volume-mounted
#       storage/ wiped it (defensive; Dockerfile also creates it) ──────
if [ ! -L public/storage ]; then
    php artisan storage:link >/dev/null 2>&1 || true
fi

# Hand off to CMD (supervisord -c /etc/supervisord.conf)
exec "$@"
