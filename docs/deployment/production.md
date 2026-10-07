# Production Deployment Guide — Linux Server / Cloud VPS (Ubuntu LTS)

Comprehensive, step-by-step guide for deploying the high-performance native Go Fiber backend API and embedded WebSocket server to a **Linux Server / Cloud VPS (Ubuntu LTS / DigitalOcean Droplet)**.

---

## 1. Architecture Overview

The production backend runs as a high-performance native Go micro-daemon managed via **systemd** on the Linux server:

```
┌────────────────────────────────────────────────────────────────────────┐
│               Linux Server / Cloud VPS (Ubuntu LTS)                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               Go Fiber Backend (Port 3000 Unified)               │  │
│  │  ├─ /api/*       ──▶ REST API Endpoints                          │  │
│  │  ├─ /storage/*   ──▶ Direct Static File & Evidence Serving       │  │
│  │  ├─ /tiles/*     ──▶ Geospatial Map & Satellite Tile Proxy Cache │  │
│  │  └─ /app/*       ──▶ Embedded Real-Time WebSocket Hub (Echo)     │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│             ┌───────────────────┴───────────────────┐                  │
│             ▼                                       ▼                  │
│      ┌──────────────┐                       ┌──────────────┐           │
│      │ MariaDB 10+  │                       │ Isolated Host│           │
│      │ (Port 3306)  │                       │ Storage Path │           │
│      │ emergencydb  │                       │/var/www/sine-│           │
│      └──────────────┘                       │  storage     │           │
│                                             └──────────────┘           │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │ External Cloud Gateways     │
                  │ ├─ PhilSMS (Transactional)  │
                  │ ├─ Resend (Transactional)   │
                  │ └─ Firebase (Push FCM v1)   │
                  └─────────────────────────────┘
```

---

## 2. Initial Server Setup & Prerequisites

SSH into your droplet/VPS:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install **Go**, **MariaDB**, **Git**, and **UFW**:
```bash
# 1. Update system packages
apt update && apt upgrade -y

# 2. Install database, utilities, and build tools
apt install -y mariadb-server git curl ufw fail2ban golang-go
```

---

## 3. Storage & Firewall Configuration

### 3.1 Setup Dedicated Isolated Storage
Create the dedicated persistent storage directory outside the code repository:
```bash
mkdir -p /var/www/sine-storage/app/public
chown -R root:www-data /var/www/sine-storage
chmod -R 775 /var/www/sine-storage
```

### 3.2 Configure UFW Firewall
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

ufw --force enable
ufw status
```

---

## 4. Setting Up MariaDB Database

```bash
# 1. Start and enable MariaDB
systemctl enable mariadb
systemctl start mariadb

# 2. Create database and dedicated application user
mysql -u root -e "
CREATE DATABASE IF NOT EXISTS emergencydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mdrrmo_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON emergencydb.* TO 'mdrrmo_user'@'localhost';
FLUSH PRIVILEGES;
"
```

---

## 5. Deploying the Backend Stack

### 5.1 Directory & Storage Setup
```bash
mkdir -p /var/www/backend
cd /var/www/backend
# Link isolated storage into app directory
ln -sfn /var/www/sine-storage /var/www/backend/storage
```

### 5.2 Configure Environment (`.env`)
```bash
cp .env.example .env
nano .env
```

Ensure these production keys are set:
```env
APP_NAME="SINE-MDRRMO"
APP_ENV=production
APP_DEBUG=false
APP_URL=http://YOUR_SERVER_IP:3000
APP_PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

REVERB_APP_ID=sine
REVERB_APP_KEY=6bc0e7b80b37c8d8d8f8
REVERB_APP_SECRET=sine_secret
REVERB_HOST=0.0.0.0
REVERB_PORT=3000

STORAGE_PATH=/var/www/sine-storage/app/public
FIREBASE_PROJECT_ID=mdrrmo-sine-response-app
FIREBASE_CREDENTIALS=/var/www/sine-storage/app/mdrrmo-sine-response-app-firebase-adminsdk-fbsvc-73bd4e4846.json

BACKUP_AUTO_ENABLED=true
BACKUP_INTERVAL_HOURS=2
BACKUP_MAX_INTRADAY=12
BACKUP_MAX_DAILY=7

DEFAULT_ADMIN_PASSWORD=your_initial_admin_password
DEFAULT_DISPATCHER_PASSWORD=your_initial_dispatcher_password
```

### 5.3 Build Application Binary
```bash
go build -ldflags="-s -w" -o server main.go
chmod +x server
chown -R www-data:www-data /var/www/backend
```

---

## 6. Systemd Service Configuration

Create `/etc/systemd/system/backend.service`:
```ini
[Unit]
Description=SINE MDRRMO Go Fiber Backend Service
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/backend
ExecStart=/var/www/backend/server
Restart=always
RestartSec=3s
LimitNOFILE=65536
EnvironmentFile=/var/www/backend/.env

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
systemctl daemon-reload
systemctl enable backend.service
systemctl start backend.service
systemctl status backend.service
```

---

## 7. Administrative Initial Accounts

The database seeder configures the initial administrative accounts using the passwords defined in your `.env`:

* **Super Admin Account:**
  * **Email / Username:** `admin_user@sine.gov.ph` / `admin`
  * **Configured Via:** `DEFAULT_ADMIN_PASSWORD` in `.env`
  * **Role:** `admin`
* **Dispatcher Account:**
  * **Email / Username:** `dis@mail.com` / `dispatcher1`
  * **Configured Via:** `DEFAULT_DISPATCHER_PASSWORD` in `.env`
  * **Role:** `dispatcher`

> [!IMPORTANT]
> Change all initial administrative and dispatcher passwords immediately after initial deployment. Never commit production passwords to version control.

---

## 8. Verification & Health Checks

1. **Local Health Check on Server:**
   ```bash
   curl -I http://127.0.0.1:3000/health
   # Returns: HTTP/1.1 200 OK
   ```
2. **External Browser Health Check:**
   Open `http://YOUR_SERVER_IP:3000/health` in your browser.
3. **Inspect Real-Time Logs:**
   ```bash
   journalctl -u backend.service -f
   ```
4. **Trigger Email Test:**
   ```bash
   /var/www/backend/server test-mail test@example.com
   ```
