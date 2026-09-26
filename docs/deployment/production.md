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
│             ┌───────────────────┼───────────────────┐                  │
│             ▼                   ▼                   ▼                  │
│      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│      │ mdrrmo_app   │    │mdrrmo_reverb │    │ mdrrmo_redis │          │
│      │ (PHP 8.4-FPM)│    │ (Reverb WS)  │    │(Redis Alpine)│          │
│      └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│             │                   │                   │                  │
│             │                   │                   ▼                  │
│             │                   │         ┌───────────────────┐        │
│             │                   │         │ Host Persistent   │        │
│             │                   │         │ Volume (AOF/Disk) │        │
│             │                   │         │./docker/data/redis│        │
│             │                   │         └───────────────────┘        │
│             └───────────────────┼───────────────────┘                  │
│                                 ▼                                      │
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

# 2. Install container tools, database, and utilities (Redis runs containerized in Podman)
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

### 3.2 Enable UFW Container Packet Forwarding & Internal Bridge DNS
By default, UFW drops routed packets (`deny (routed)`), causing incoming traffic on port 80 to time out. Enable forwarding and allow container internal DNS resolution:
```bash
# Allow UFW to forward incoming traffic to Podman containers
sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

# Configure firewall rules
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3306/tcp

# Allow Podman bridge aardvark-dns queries for container hostname resolution
ufw allow in on podman1 to 10.89.0.1 port 53 proto udp
ufw allow in on podman1 to 10.89.0.1 port 53 proto tcp

ufw --force enable
ufw reload
```

### 3.3 Configure 2GB Swap Space (OOM Prevention) & Memory Overcommit
On 2GB RAM droplets, concurrent traffic bursts can trigger Linux OOM kills. Create a 2GB swap file and enable memory overcommit for Redis background persistence:
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
echo 'vm.overcommit_memory=1' > /etc/sysctl.d/99-redis.conf
sysctl -p /etc/sysctl.d/99-swappiness.conf
sysctl -p /etc/sysctl.d/99-redis.conf
```

### 3.4 Containerized Redis with Persistent Disk Sync (`mdrrmo_redis`)
Redis runs inside the Podman bridge network (`mdrrmo_net`) as an Alpine container with AOF (Append-Only File) real-storage persistence mounted to the host filesystem:
- **Image:** `docker.io/library/redis:alpine`
- **Persistent Storage Mount:** `./docker/data/redis:/data:Z` (ensures memory cache & queues persist on VPS reboots)
- **Memory Ceiling:** `--maxmemory 256mb --maxmemory-policy allkeys-lru`
- **Authentication:** `--requirepass YourRedisPassword123!`
- **Internal Hostname:** `redis:6379` (isolated inside container network, never exposed to the public internet)

### 3.5 Configure High-Concurrency File Descriptors (`ulimit 65536`)
Linux defaults to 1,024 open file descriptors per process, which throttles concurrent WebSocket connections and Nginx worker sockets during emergency events. Increase system-wide limits to 65,536:
```bash
# 1. Update PAM security limits
cat <<EOF >> /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF

# 2. Update systemd global defaults
echo "DefaultLimitNOFILE=65536" >> /etc/systemd/system.conf
echo "DefaultLimitNOFILE=65536" >> /etc/systemd/user.conf

# 3. Increase kernel file ceiling
echo "fs.file-max = 2097152" > /etc/sysctl.d/99-limits.conf
sysctl -p /etc/sysctl.d/99-limits.conf
systemctl daemon-reexec
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

# ── In-Memory Caching & Queues (Redis) ──
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=YourRedisPassword123!
REDIS_PORT=6379

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
