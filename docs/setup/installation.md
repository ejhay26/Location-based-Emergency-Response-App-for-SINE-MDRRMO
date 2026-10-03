# Local Installation & Setup Guide

Step-by-step instructions to set up, configure, and run the SINE MDRRMO Emergency Response System locally on Windows, macOS, or Linux.

> **Related:** [System Requirements](./system-requirements.md) · [Environment Variables](./environment.md) · [Troubleshooting](./troubleshooting.md)

---

## Prerequisites

Before starting, ensure you have the following software installed:

| Tool | Version | Purpose |
|---|---|---|
| **Go** | 1.24+ | High-performance backend runtime |
| **Node.js** | 20.x or 22.x LTS | JavaScript runtime for Angular/Ionic |
| **Rust & Cargo** | 1.80+ (Optional) | Required only if compiling Tauri v2 desktop packages (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`) |
| **MariaDB / MySQL** | 10.6+ / 8.0+ | Relational database server |
| **Ionic CLI** | 8.x+ | Command-line interface for frontend (`npm install -g @ionic/cli`) |

---

## Method A: Standard Local Setup

### 1. Database Setup
Start your local MariaDB/MySQL service (via XAMPP, Laragon, or native service).

Create a new database named `emergencydb`:
```sql
CREATE DATABASE emergencydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

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

Configure your `backend/.env` with your database credentials:
```env
APP_PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emergencydb
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

REVERB_APP_KEY=6bc0e7b80b37c8d8d8f8
REVERB_PORT=3000
FILESYSTEM_DISK=public
```

Download Go dependencies:
```bash
go mod tidy
```

Start the unified backend API & WebSocket server:
```bash
go run main.go
```

> **Automated Migrations & Seeders:** On startup, the Go Fiber engine automatically applies schema migrations (`AutoMigrate`) for all 16 core data models and idempotently seeds initial incident types, San Isidro barangays, emergency responders, and response vehicles.

The backend service runs concurrently on `http://localhost:3000` (serving REST endpoints, tile caching, media storage, and real-time WebSockets).

---

### 3. Frontend Setup (Citizen Mobile & Dispatcher Dashboard)

Open a **second terminal** and navigate to `frontend/`:
```bash
cd frontend
npm install
```

Verify `frontend/src/environments/environment.ts` points to your local backend:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  mapTileUrl: 'http://localhost:3000/tiles/osm/{z}/{x}/{y}.png',
  satelliteTileUrl: 'http://localhost:3000/tiles/satellite/{z}/{y}/{x}.jpg',
  reverbKey: '6bc0e7b80b37c8d8d8f8',
  reverbHost: 'localhost',
  reverbPort: 3000,
  reverbScheme: 'http',
};
```

---

### 4. Running the Applications

#### A. Web & Mobile Simulator
```bash
ionic serve --port=8100
```
- Opens at `http://localhost:8100`.
- Use Browser DevTools Device Mode (e.g., iPhone 15 or Pixel 8) to test the Citizen interface and the Mobile Admin Dashboard.

#### B. Native Desktop Application (Tauri v2)
```bash
npm run start:desktop:tauri
```
- Launches the lightweight native desktop application with custom window controls and OS audio alerts.
- To produce a standalone portable executable: `npm run build:tauri:win`

#### C. Native Android Build (Capacitor)
```bash
npx cap sync android
npx cap open android
```
- Opens the project in **Android Studio** for building APK / running on an Android device.

---

## Method B: Containerized Docker Setup

For a containerized backend environment:

```bash
cd backend
docker build -t sine-backend .
docker run -d --name sine_backend -p 3000:3000 --env-file .env sine-backend
```

- **Unified API & WebSocket Server**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
