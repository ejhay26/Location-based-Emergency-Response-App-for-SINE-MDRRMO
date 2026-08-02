# Installation Guide

Step-by-step guide to run the SINE MDRRMO Emergency Response App on your own machine.

> Related: [Environment Variables](./environment.md) · [Troubleshooting](./troubleshooting.md)
>
> Every code block below has a copy button in the top-right corner when you hover over it on GitHub — no need to type these out by hand.

## Prerequisites

- Composer
- Node.js
- PHP (with the extensions listed below)
- MariaDB / MySQL

Works on both Windows and Linux.

- **Windows:** Installing XAMPP gives you PHP and MariaDB out of the box. Install XAMPP *before* Composer, so the Composer installer can auto-detect the XAMPP PHP folder.
- **Linux:** Install MariaDB/MySQL server and PHP separately.

<details>
<summary><b>Required PHP extensions — Linux</b></summary>

Install via your distro's package manager:
- `php-mysql`
- `php-mbstring`
- `php-curl`
- `php-zip`
- `php-intl`
- `php-xml`

</details>

<details>
<summary><b>Required PHP extensions — Windows (XAMPP)</b></summary>

Open `php/php.ini`, find the *Dynamic Extensions* section, and uncomment (remove the leading `;` from) these lines:
```ini
extension=mbstring
extension=curl
extension=zip
extension=intl
```

</details>

---

## Setup Steps

### 1. Start your database server
Turn on MariaDB/MySQL locally (via XAMPP, Laragon, or a native install).

### 2. Import the database
Create an empty database named `emergencydb`, then from the project root:
```bash
cd database
mysql -u your_username -p emergencydb < emergencydb.sql
```
(Or use the `source` command inside the MySQL/MariaDB CLI, or import via phpMyAdmin.)

> The bundled dump has sample/demo rows for local testing — see the note in [Database Schema](../architecture/database-schema.md#seed-data) before reusing it anywhere beyond your own machine.

### 3. Set up the backend environment
From the project root:
```bash
cd backend

# Linux/macOS
cp .env.example .env

# Windows
copy .env.example .env
```

Install Composer dependencies:
```bash
composer install
```
If you hit version errors, try: `composer install --ignore-platform-reqs`

### 4. Set your database credentials
Open `backend/.env` and fill in the database section — see [Environment Variables](./environment.md) for the full reference:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=your_username_here
DB_PASSWORD=your_password_here
```

Also set `MAIL_PASSWORD` — needed for the OTP email flow (see [Environment Variables](./environment.md#mail-otp-delivery)).

**Recommended:** use a dedicated database user instead of `root`:
```sql
CREATE USER 'new_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON emergencydb.* TO 'new_user'@'localhost';
FLUSH PRIVILEGES;
```

### 5. Generate the app key
```bash
php artisan key:generate
```

### 6. Link local storage (needed for images)
Creates the symlink that serves SOS camera uploads and profile pictures:
```bash
php artisan storage:link
```

### 7. Start the API backend
```bash
php artisan serve
```

### 8. Install frontend dependencies
In a new terminal, from the project root:
```bash
cd frontend
```
If a `node_modules` folder already exists, delete it first, then:
```bash
npm install
```

### 9. Install the Ionic CLI
```bash
npm install -g @ionic/cli
```

### 10. Start the frontend
```bash
ionic serve
```

## Check It's Working

| Service | URL |
|---|---|
| Laravel Backend API | http://localhost:8000 |
| Ionic Frontend UI | http://localhost:8100 |

If either one doesn't come up, check [Troubleshooting](./troubleshooting.md).
