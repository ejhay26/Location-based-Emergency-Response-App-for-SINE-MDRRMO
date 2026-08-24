# Production Deployment Guide — Linux Server / Cloud VPS (Ubuntu LTS)

Comprehensive, step-by-step guide for deploying the containerized SINE MDRRMO backend API and Laravel Reverb WebSocket server to a **Linux Server / Cloud VPS (Ubuntu LTS / DigitalOcean Droplet)** using **Podman** (or **Docker**).

---

## 1. Architecture Overview

The production backend runs as a multi-container stack managed via `podman-compose` on a Linux server:

```
┌────────────────────────────────────────────────────────────────────────┐
│               Linux Server / Cloud VPS (Ubuntu LTS)                    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Nginx (Port 80 / 443 SSL)                     │  │
│  │  ├─ /api/*       ──▶ FastCGI (PHP 8.4-FPM on 127.0.0.1:9000)     │  │
│  │  ├─ /storage/*   ──▶ Static Storage Symlinks                     │  │
│  │  └─ /app/, /apps ──▶ WebSocket Proxy (host.containers.internal)  │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│             ┌───────────────────┴───────────────────┐                  │
│             ▼                                       ▼                  │
│      ┌──────────────┐                       ┌──────────────┐           │
│      │ mdrrmo_app   │                       │mdrrmo_reverb │           │
│      │ (PHP 8.4-FPM)│                       │ (Reverb WS)  │           │
│      └──────┬───────┘                       └──────┬───────┘           │
│             │                                      │                   │
│             └──────────────────┬───────────────────┘                   │
│                                ▼                                       │
│                     ┌─────────────────────┐                            │
│                     │  MariaDB / MySQL    │                            │
│                     │ (Port 3306 / Host)  │                            │
│                     └─────────────────────┘                            │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │ S3 / Cloud Storage / Public │
                  │  (Media & Proof Storage)    │
                  └─────────────────────────────┘
```

---

## 2. Initial Server Setup & Prerequisites

SSH into your droplet/VPS:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install **Podman**, **Podman-Compose**, **MariaDB**, **Git**, and **UFW**:
```bash
# 1. Update system packages
apt update && apt upgrade -y

# 2. Install container tools, database, and utilities
apt install -y podman podman-compose mariadb-server git curl ufw fail2ban
```

---

## 3. Essential Ubuntu & Podman System Fixes

When deploying on Ubuntu LTS with Podman, apply these 3 essential configurations:

### 3.1 Fix Container DNS Resolution (Alpine Mirror Downloads)
Ubuntu's default `systemd-resolved` stub (`127.0.0.53`) is unreachable inside container build namespaces. Add public nameservers to `/etc/resolv.conf`:
```bash
echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 1.1.1.1" >> /etc/resolv.conf
```

### 3.2 Enable UFW Container Packet Forwarding
By default, UFW drops routed packets (`deny (routed)`), causing incoming traffic on port 80 to time out. Enable forwarding:
```bash
# Allow UFW to forward incoming traffic to Podman containers
sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

# Configure firewall rules
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3306/tcp
ufw --force enable
ufw reload
```

---

## 4. Setting Up MariaDB Database

Configure MariaDB to listen on container gateway interfaces and create the application database:

```bash
# 1. Allow MariaDB to listen on all interfaces
sed -i 's/bind-address\s*=\s*127.0.0.1/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf 2>/dev/null || true
systemctl enable mariadb
systemctl restart mariadb

# 2. Create database and dedicated user
mysql -u root -e "
CREATE DATABASE IF NOT EXISTS emergencydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mdrrmosineapp'@'%' IDENTIFIED BY 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON emergencydb.* TO 'mdrrmosineapp'@'%';
FLUSH PRIVILEGES;
"
```

---

## 5. Deploying the Backend Stack

### 5.1 Clone Repository (Backend Only via Sparse Checkout)
```bash
mkdir -p /var/www/mdrrmo-backend && cd /var/www/mdrrmo-backend
git init
git remote add origin https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO.git
git config core.sparseCheckout true
echo "backend/*" >> .git/info/sparse-checkout
echo "database/*" >> .git/info/sparse-checkout
git pull --depth=1 origin main
cd backend
```

### 5.2 Configure Environment (`.env`)
```bash
cp .env.example .env
nano .env
```

Ensure these production keys are set:
```env
APP_NAME="MDRRMO SINE EMERGENCY RESPONSE APP"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_APP_KEY
APP_DEBUG=false
APP_URL=http://YOUR_DROPLET_IP

DB_CONNECTION=mysql
DB_HOST=host.containers.internal
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=mdrrmosineapp
DB_PASSWORD=YourStrongPassword123!

BROADCAST_CONNECTION=reverb
REVERB_APP_ID=100996
REVERB_APP_KEY=your_reverb_key
REVERB_APP_SECRET=your_reverb_secret
REVERB_HOST=YOUR_DROPLET_IP
REVERB_PORT=80
REVERB_SCHEME=http

# ── Disaster Recovery & 2-Hour Automated Backups ──
BACKUP_AUTO_ENABLED=true
BACKUP_INTERVAL_HOURS=2
BACKUP_MAX_INTRADAY=12
BACKUP_MAX_DAILY=7
```

### 5.3 Copy Firebase Credentials JSON
```bash
# Upload or paste your firebase credentials JSON into:
nano storage/app/mdrrmo-sine-response-app-firebase-adminsdk-fbsvc-73bd4e4846.json
```

---

## 6. Build & Launch Container Stack

```bash
# 1. Pre-pull multi-stage dependencies
podman pull docker.io/library/composer:2

# 2. Build the shared image using host network (for fast DNS)
podman build --network=host --dns=8.8.8.8 -t backend_app .

# 3. Launch both app & reverb containers in background
podman-compose up -d

# 4. Run database migrations and seed default system data
podman exec -it mdrrmo_backend php artisan migrate --force
podman exec -it mdrrmo_backend php artisan db:seed --force

# 5. Create storage symlink
podman exec -it mdrrmo_backend php artisan storage:link

# 6. Verify automated 2-hour backup daemon status
podman exec -it mdrrmo_backend php artisan backup status
```

---

## 7. Default Seeded Accounts

Running `db:seed` automatically creates the initial administration accounts:

* 👑 **Super Admin Account:**
  * **Username:** `admin` (or `admin_user@sine.gov.ph`)
  * **Password:** `Admin123!`
  * **Role:** `admin`
* 🎧 **Dispatcher Account:**
  * **Username:** `dispatcher1` (or `dis@mail.com`)
  * **Password:** `Dispatcher123!`
  * **Role:** `dispatcher`

---

## 8. Verification & Health Checks

1. **Local Health Check on Server:**
   ```bash
   curl -I http://127.0.0.1/api/health
   # Returns: HTTP/1.1 200 OK
   ```
2. **External Browser Health Check:**
   Open `http://YOUR_DROPLET_IP/api/health` in your browser.
3. **Trigger Manual Database Snapshot:**
   ```bash
   podman exec -it mdrrmo_backend php artisan backup take
   ```
