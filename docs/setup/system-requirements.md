# System Requirements

Comprehensive hardware and software specifications required to run each component of the SINE MDRRMO Emergency Response System.

---

## 1. Citizen Mobile Application (Android & iOS)

The citizen application is built with **Ionic 8 / Angular 20** and compiled to native mobile packages via **Capacitor 8**.

### Supported Operating Systems
| Platform | Minimum Version | Target / Recommended | Notes |
|---|---|---|---|
| **Android** | **Android 8.0 (API 26, Oreo)** | **Android 14–16 (API 34–36)** | Base compilation runtime maintains `minSdkVersion = 24` (Android 7.0), but **Android 8.0+ (API 26)** is strictly required for 1-Tap Home Screen SOS Widget Pinning (`AppWidgetManager.requestPinAppWidget`) and high-priority FCM notification channels. |
| **iOS** | **iOS 15.0** | **iOS 17+ / 18+** | Compatible with iPhone 6s, iPhone SE (1st gen), and all newer models. |

### Minimum & Recommended Mobile Hardware Specs
| Component | Minimum Specification | Recommended Specification | Reason / Notes |
|---|---|---|---|
| **Processor (SoC)** | Quad-Core 1.5 GHz (ARMv8 64-bit) | Octa-Core 2.0 GHz+ (Snapdragon, MediaTek Dimensity, Apple A-series) | Ensures smooth 60fps UI rendering, fast camera frame capture, and responsive map pinch-to-zoom. |
| **RAM** | 2 GB | 3 GB or higher | Ensures smooth camera photo/video capture, Leaflet vector map rendering, and background service tasks. |
| **Storage** | 100 MB free space | 250 MB free space | App binary is ~30–45 MB; extra space is needed for caching offline reports and proof media in IndexedDB. |
| **Camera** | 5 MP Rear Camera | 12 MP+ with Autofocus & Flash | Required for live anti-prank proof capture (SOS photo/10s video) and Front/Back valid ID scanning. |
| **Location / GPS** | GPS / A-GPS hardware | GPS + GLONASS / Galileo / BeiDou | Required for high-accuracy coordinate capture during emergency reporting. |
| **Network** | 3G / HSPA+ mobile data | 4G LTE / 5G or stable Wi-Fi | Needed for real-time SOS submission and receiving broadcast alerts. |
| **Permissions** | Location, Camera, Notifications | Location, Camera, Notifications, SMS Retriever (Android) | Essential runtime permissions for app operations. |

---

## 2. Admin & Dispatcher Dashboard (Electron Desktop)

The MDRRMO Command Center dashboard is packaged as a **native desktop application (Electron 42 / Chromium)** using `electron-builder`. It connects directly to the backend API and Laravel Reverb WebSocket server without requiring a hosted web frontend.

### Supported Operating Systems
| OS | Supported Versions | Distributed Package Formats |
|---|---|---|
| **Windows** | Windows 10 (64-bit), Windows 11 | NSIS Installer (`.exe`), Portable (`.exe`) |
| **macOS** | macOS 11 (Big Sur) or newer | Apple Disk Image (`.dmg`), ZIP Archive (`.zip`) |
| **Linux** | Ubuntu 20.04+, Debian 11+, Fedora 34+, Arch | AppImage, Debian Package (`.deb`), Tarball (`.tar.gz`) |

### Desktop Hardware Requirements
| Component | Minimum Specification | Recommended Specification | Purpose |
|---|---|---|---|
| **Processor (CPU)** | Dual-Core 2.0 GHz (x64) | Quad-Core 2.5 GHz+ (Intel Core i5 / AMD Ryzen 5 or Apple Silicon) | Fluid UI animations, WebSocket message handling, and real-time mapping. |
| **RAM** | 4 GB | 8 GB or higher | Smooth rendering of multi-marker interactive Leaflet maps, live dispatch feeds, and analytics charts. |
| **Display Resolution** | 1280 × 800 pixels | 1920 × 1080 (Full HD) or higher | Optimized layout for multi-panel dispatcher workflow (minimum supported window size: 960 × 600). |
| **Storage Space** | 500 MB free disk space | 1 GB SSD space | Space for Electron runtime, application bundle, and local log caches. |
| **Network** | 5 Mbps broadband connection | 15 Mbps+ dedicated fiber/broadband | Continuous WebSocket connection for instant pin drops and desktop notifications. |

---

## 3. Backend & Cloud Server (Linux VPS / Server)

The backend is containerized and runs **Laravel 13 on PHP 8.4-FPM**, **Nginx**, and **Laravel Reverb (WebSocket server)**. It supports deployment on **Podman** (recommended for rootless, lightweight execution) as well as **Docker**.

### Recommended Server Specs
| Tier | Server Specifications | Ideal Use Case |
|---|---|---|
| **Minimum / Pilot** | 1 vCPU / 1 GB RAM / 25 GB SSD | Pilot testing, capstone demonstration, development staging. |
| **Production (Recommended)** | 2 vCPU / 2 GB–4 GB RAM / 50 GB SSD | Municipal deployment handling active citizen traffic, background queues, and concurrent WebSocket connections. |

### Software & Stack Requirements
| Requirement | Version / Specification | Notes |
|---|---|---|
| **PHP** | **8.4+** | Required extensions: `pdo_mysql`, `mbstring`, `curl`, `zip`, `intl`, `xml`, `gd`, `bcmath`, `exif`, `opcache`, `pcntl`. |
| **Framework** | **Laravel 13** | Core REST API, Sanctum token authentication, and background queues. |
| **WebSocket Engine** | **Laravel Reverb 1.11+** | Dedicated long-running WebSocket server on port 6001 (proxied over WSS/443 via Nginx). |
| **Database** | **MariaDB 10.6+ / MySQL 8.0+** | UTF8mb4 charset, InnoDB storage engine. |
| **Web Server** | **Nginx 1.25+** | Reverse proxy for PHP-FPM, `/storage` static files, and WebSocket upgrade proxy for `/app/` and `/apps/`. |
| **Container Engine** | **Podman (or Docker)** | Managed via `podman-compose` or `docker compose` (`app`, `reverb`, optional local `minio`). |
| **Object Storage** | S3-Compatible (Cloudflare R2 / AWS S3 / MinIO) | Scalable off-server storage for SOS photos, videos, valid IDs, and profile avatars. |
| **Push Notifications** | **Firebase Cloud Messaging (FCM v1)** | High-priority push alerts to Android and iOS devices. |
| **SMS Gateway** | **PhilSMS API v3** | Transactional OTP delivery via `https://dashboard.philsms.com/api/v3/sms/send`. |

---

## Quick Reference Summary

| User / Role | Supported Environment | Minimum Specs at a Glance |
|---|---|---|
| **Citizen (Mobile)** | Android 8.0+ or iOS 15.0+ | Smartphone with 2 GB RAM, Camera, GPS, and Internet |
| **Dispatcher / Admin** | Windows 10/11, macOS 11+, or Linux | PC/Laptop with 4 GB RAM, 1280×800 Display, Broadband |
| **Server Host** | Linux VPS (Ubuntu 22.04/24.04 LTS) | 1–2 vCPU, 1–2 GB RAM, Podman / Docker, PHP 8.4, MariaDB 10.6+ |
