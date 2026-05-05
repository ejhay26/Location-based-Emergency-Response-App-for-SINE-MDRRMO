# /backend/Dockerfile
FROM php:8.2-cli

# Install system dependencies for Laravel and MariaDB
RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip git default-mysql-client \
    && docker-php-ext-install pdo_mysql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Run the Laravel development server
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]