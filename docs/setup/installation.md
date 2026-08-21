# Local Installation & Setup Guide

Step-by-step instructions to set up, configure, and run the SINE MDRRMO Emergency Response System locally on Windows, macOS, or Linux.

> **Related:** [System Requirements](./system-requirements.md) · [Environment Variables](./environment.md) · [Troubleshooting](./troubleshooting.md)

---

## Prerequisites

Before starting, ensure you have the following software installed:

| Tool | Version | Purpose |
|---|---|---|
| **PHP** | 8.4+ | Backend runtime (with `pdo_mysql`, `mbstring`, `curl`, `zip`, `intl`, `xml`, `gd`, `bcmath`, `exif`) |
| **Composer** | 2.x | PHP dependency manager |
| **Node.js** | 20.x or 22.x LTS | JavaScript runtime for Angular/Ionic and Electron |
| **MariaDB / MySQL** | 10.6+ / 8.0+ | Relational database server |
| **Ionic CLI** | 8.x+ | Command-line interface for frontend (`npm install -g @ionic/cli`) |
| **Docker & Compose** | Optional | For containerized local development with Reverb & MinIO |

---

## Method A: Standard Local Setup

### 1. Database Setup
Start your local MariaDB/MySQL service (via XAMPP, Laragon, or native service).

Create a new database named `emergencydb`:
```sql
CREATE DATABASE emergencydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Import the initial database schema and seed data from the project root:
```bash
# Windows (PowerShell/Command Prompt)
mysql -u root -p emergencydb < database/emergencydb.sql

# Linux / macOS
mysql -u root -p emergencydb < database/emergencydb.sql
```

*(Alternatively, import `database/emergencydb.sql` using phpMyAdmin, HeidiSQL, or DBeaver).*

---

### 2. Backend API & WebSockets Setup

Navigate to the `backend/` directory:
```bash
cd backend
```

Copy the environment template:
```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Install Composer dependencies:
```bash
composer install
```

Generate the unique application key:
```bash
php artisan key:generate
```

Configure your `backend/.env` with your database credentials, PhilSMS API token, and Mail password (see [Environment Variables](./environment.md)):
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

BROADCAST_CONNECTION=reverb
FILESYSTEM_DISK=public
```

Create the public storage symlink for uploaded files:
```bash
php artisan storage:link
```

Start the backend API server:
```bash
php artisan serve --port=8000
```

In a **second terminal**, start the **Laravel Reverb WebSocket server**:
```bash
php artisan reverb:start --host=0.0.0.0 --port=6001
```

---

### 3. Frontend Setup (Citizen Mobile & Dispatcher Dashboard)

Open a **third terminal** and navigate to `frontend/`:
```bash
cd frontend
```

Install npm dependencies:
```bash
npm install
```

Verify `frontend/src/environments/environment.ts` points to your local backend and Reverb server:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  reverbKey: 'xlq16kh4sisuz0kwe3sq',
  reverbHost: 'localhost',
  reverbPort: 6001,
  reverbScheme: 'http',
};
```

---

### 4. Running the Applications

#### A. Citizen Mobile App (Web Simulator / Browser Preview)
```bash
ionic serve --port=8100
```
- Opens at: `http://localhost:8100` (Use Browser DevTools Device Mode: iPhone 14 or Pixel 7 for optimal mobile preview).

#### B. Admin & Dispatcher Command Center (Electron Desktop App)
```bash
npm run start:desktop
```
- Launches the native Electron dashboard with borderless titlebar, multi-panel incident map, and desktop notifications.

#### C. Native Android Build (Capacitor)
```bash
npx cap sync android
npx cap open android
```
- Opens the project in **Android Studio** for building APK / running on an Android device/emulator.

---

## Method B: Containerized Docker / Podman Setup

For an instant, fully containerized environment running Nginx, PHP 8.4-FPM, and Laravel Reverb:

```bash
cd backend
docker compose up -d --build
```

- **App & API**: `http://localhost:8080`
- **Reverb WebSocket**: `http://localhost:6001` (proxied via `http://localhost:8080/app/`)
- Run migrations if needed: `docker compose exec app php artisan migrate --force`

---

## Verifying the Setup

| Service | Address | Expected Status |
|---|---|---|
| **Backend Health Check** | `http://localhost:8000/api/health` | `{"status":"ok","timestamp":"..."}` |
| **Reverb WebSocket Server** | `ws://localhost:6001` | Connection accepted |
| **Citizen App (Ionic)** | `http://localhost:8100` | Citizen UI loaded |
| **Admin Dashboard** | Electron App Window | Command Center active |
