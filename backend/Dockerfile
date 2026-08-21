FROM php:8.4-fpm-alpine

# ── System dependencies ───────────────────────────────────────────────────
RUN apk add --no-cache \
    nginx \
    supervisor \
    bash \
    curl \
    unzip \
    git \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    oniguruma-dev \
    libxml2-dev \
    libzip-dev \
    icu-dev

# ── PHP extensions ────────────────────────────────────────────────────────
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
 && docker-php-ext-install -j$(nproc) \
        pdo_mysql mbstring exif pcntl bcmath gd zip intl opcache xml

# ── Composer ──────────────────────────────────────────────────────────────
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# ── App source ────────────────────────────────────────────────────────────
WORKDIR /var/www/html
COPY . .
# NOTE: package:discover is intentionally NOT run here. .dockerignore
# excludes .env, so APP_KEY is absent at build time and artisan exits
# before it can rewrite bootstrap/cache/packages.php. The entrypoint.sh
# re-runs package:discover at container startup when all env vars are
# actually present — that is the correct and only reliable fix.
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# ── Storage permissions + public disk symlink ─────────────────────────────
# public/storage lives outside the storage/ volume mount used by
# docker-compose (Podman/Docker local dev), so it's safe to create here at
# build time — it will NOT be wiped when storage/ is bind-mounted at runtime.
RUN mkdir -p storage/logs storage/framework/{cache,sessions,views} storage/app/public bootstrap/cache \
 && ln -sfn ../storage/app/public public/storage \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

# ── Configs ───────────────────────────────────────────────────────────────
COPY docker/nginx/nginx.conf      /etc/nginx/nginx.conf
COPY docker/php/php.ini           /usr/local/etc/php/conf.d/99-app.ini
COPY docker/supervisord.conf      /etc/supervisord.conf
COPY docker/entrypoint.sh         /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://127.0.0.1/up || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
