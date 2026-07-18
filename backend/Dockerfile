FROM php:8.3-fpm-alpine

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
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# ── Storage permissions ───────────────────────────────────────────────────
RUN mkdir -p storage/logs storage/framework/{cache,sessions,views} bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

# ── Configs ───────────────────────────────────────────────────────────────
COPY docker/nginx/nginx.conf      /etc/nginx/nginx.conf
COPY docker/php/php.ini           /usr/local/etc/php/conf.d/99-app.ini
COPY docker/supervisord.conf      /etc/supervisord.conf

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
