# Production Deployment Guide — Linux Server / Cloud VPS

Step-by-step guide for deploying the containerized SINE MDRRMO backend API and Laravel Reverb WebSocket server to a **Linux Server / Cloud VPS (Ubuntu LTS)** using **Podman** (or **Docker**).

---

## 1. Architecture Overview

The production backend runs as a multi-container stack managed via `podman-compose` or `docker compose` on a Linux server:

```
┌────────────────────────────────────────────────────────┐
│             Linux Server / Cloud VPS (Ubuntu LTS)      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                Nginx (Port 80 / 443 SSL)         │  │
│  │  ├─ /api/*       ──▶ FastCGI (PHP 8.4-FPM)       │  │
│  │  ├─ /storage/*   ──▶ Static Storage Symlinks     │  │
│  │  └─ /app/, /apps ──▶ WebSocket Proxy (Reverb)    │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│         ┌───────────────────┴───────────────────┐      │
│         ▼                                       ▼      │
│  ┌──────────────┐                       ┌──────────────┐
│  │ mdrrmo_app   │                       │mdrrmo_reverb │
│  │ (PHP 8.4-FPM)│                       │ (Reverb WS)  │
│  └──────┬───────┘                       └──────┬───────┘
│         │                                      │       │
│         └──────────────────┬───────────────────┘       │
│                            ▼                           │
│                 ┌─────────────────────┐                │
│                 │  MariaDB / MySQL    │                │
│                 │ (Port 3306 / Local) │                │
│                 └─────────────────────┘                │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │ S3 / Cloud Storage (R2/S3)  │
              │  (Media & Proof Storage)    │
              └─────────────────────────────┘
```

---

## 2. Server Requirements & Initialization

### Hardware Specs
- **Minimum:** 1 vCPU / 1 GB RAM / 25 GB SSD (suitable for pilot/testing)
- **Recommended:** 2 vCPU / 2–4 GB RAM / 50 GB SSD (suitable for municipal live operations)

### Initial Server Setup
SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install essential utilities:
```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban
```

---

## 3. Container Engine Setup (Podman or Docker)

You can run the stack with either **Podman** (recommended for rootless, daemonless, and lightweight operation) or standard **Docker**.

### Option A: Podman (Recommended & Lightweight)
```bash
apt install -y podman podman-compose
```

### Option B: Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Configure the UFW Firewall:
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 4. Deploying the Backend Stack

### 4.1 Clone Repository & Prepare Environment
```bash
cd /var/www
git clone https://github.com/ejhay26/Location-based-Emergency-Response-App-for-SINE-MDRRMO.git
cd Location-based-Emergency-Response-App-for-SINE-MDRRMO/backend

cp .env.example .env
nano .env
```

### 4.2 Production `.env` Settings
Ensure these critical values are set for production:
```env
APP_NAME="MDRRMO San Isidro Emergency App"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=mdrrmo_user
DB_PASSWORD=your_super_secret_db_password

BROADCAST_CONNECTION=reverb
REVERB_APP_ID=mdrrmo_sine_app
REVERB_APP_KEY=your_production_reverb_key
REVERB_APP_SECRET=your_production_reverb_secret
REVERB_HOST=0.0.0.0
REVERB_PORT=6001
REVERB_SCHEME=https

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your_storage_access_key
AWS_SECRET_ACCESS_KEY=your_storage_secret_key
AWS_DEFAULT_REGION=auto
AWS_BUCKET=mdrrmo-sine-media
AWS_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
AWS_USE_PATH_STYLE_ENDPOINT=false

PHILSMS_API_TOKEN=your_philsms_api_token
PHILSMS_SENDER_NAME="PhilSMS"

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_16_char_app_password
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS="no-reply@sinemdrrmo.gov.ph"
MAIL_FROM_NAME="MDRRMO SINE Emergency Response"

FIREBASE_PROJECT_ID=mdrrmo-sine-response-app
FIREBASE_CREDENTIALS=storage/app/firebase-credentials.json
```

---

### 4.3 Build & Start Containers

Using **Podman**:
```bash
podman-compose up -d --build
```

*(Or using **Docker**: `docker compose up -d --build`)*

---

### 4.4 Run Database Migrations & Cache Optimization

Using **Podman**:
```bash
# Run migrations
podman exec -it mdrrmo_backend php artisan migrate --force

# Optimize configurations
podman exec -it mdrrmo_backend php artisan config:cache
podman exec -it mdrrmo_backend php artisan route:cache
podman exec -it mdrrmo_backend php artisan view:cache
```

*(Or with Docker: `docker compose exec app php artisan migrate --force`)*

---

## 5. SSL & Domain Configuration (Let's Encrypt Certbot)

Install Certbot to provision free SSL certificates for your domain:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.yourdomain.com
```

### Nginx WebSocket Proxy Configuration
Ensure your Nginx configuration includes proxy parameters for Laravel Reverb WebSocket connections:
```nginx
# WebSocket reverse proxy for Laravel Reverb
location /app/ {
    proxy_pass http://127.0.0.1:6001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

---

## 6. Pre-Flight Production Checklist

- [ ] `APP_DEBUG` is explicitly set to `false`.
- [ ] `APP_ENV` is set to `production`.
- [ ] Database credentials use a dedicated non-root user with strong password.
- [ ] MariaDB binds securely to `127.0.0.1` and is not exposed to the public internet.
- [ ] `storage/` directory is mounted as a persistent container volume.
- [ ] S3-compatible bucket (Cloudflare R2 / AWS S3) has valid write credentials.
- [ ] Firebase credentials JSON exists in `storage/app/` and is omitted from Git.
- [ ] UFW firewall is active, allowing only ports 22, 80, and 443.
- [ ] Frontend `environment.prod.ts` points to the production domain and Reverb WSS endpoint.
