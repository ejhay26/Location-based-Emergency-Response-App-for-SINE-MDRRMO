# System Requirements

Detailed hardware, operating system, and software specifications required to run the **SINE MDRRMO Emergency Response System** across Citizen Mobile, Admin & Dispatcher Operations Dashboard (Portable Desktop & Mobile Interface), and Backend Cloud Infrastructure.

---

## 1. Citizen Mobile Application (Android & iOS)

The citizen application is built on **Ionic 8 / Angular 20** and compiled natively using **Capacitor 8**.

### Mobile System Specifications

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Operating System** | **Android 10.0+** (API 29, Q) or **iOS 16.0+** | **Android 14–16** (API 34–36) or **iOS 18+** |
| **Processor (SoC)** | 64-bit Octa-Core 2.0 GHz (e.g. Snapdragon 680, MediaTek Helio G88, Apple A12 Bionic) | High-Performance Octa-Core 2.8 GHz+ (Snapdragon 7/8 Series, Dimensity 8000+, Apple A16+) |
| **Memory (RAM)** | **3 GB LPDDR4X** | **6 GB – 8 GB LPDDR5** |
| **Graphics (GPU)** | Adreno 610 / Mali-G52 MC2 / Apple GPU (4-core) with OpenGL ES 3.2 / Vulkan support | Adreno 720+ / Mali-G715 / Apple 5-core+ GPU with hardware video encoding |
| **Storage Space** | **500 MB** free internal storage | **2 GB+** high-speed UFS 3.1 / NVMe storage (for offline queueing & cached proof media) |
| **Camera Module** | 8 MP with Autofocus (1080p @ 30fps capture) | 48 MP+ with Wide Angle, Phase Detection Autofocus (PDAF), and LED Flash |
| **Geospatial / GPS** | Dedicated GPS + A-GPS hardware receiver | Multi-Band Dual-Frequency GNSS (GPS L1+L5, GLONASS, Galileo E1+E5a, BeiDou) |
| **Connectivity** | 4G LTE mobile data (minimum 5 Mbps download / 2 Mbps upload) | 5G Sub-6GHz or Wi-Fi 6 (802.11ax) |
| **Display** | 720 × 1600 (HD+) 60Hz IPS LCD | 1080 × 2400 (FHD+) 90Hz/120Hz OLED / AMOLED with high outdoor sunlight brightness |
| **Sensors & Permissions** | Location (Fine/Coarse), Camera, Microphone, Push Notifications | Location (High Accuracy Always-On), Camera, Microphone, Push Notifications, SMS User Consent |

---

## 2. Admin & Dispatcher Operations Dashboard (Windows Portable .EXE & Mobile View)

The MDRRMO Operations Dashboard runs as a lightweight, standalone portable executable (**Tauri v2 / Rust**) with zero installer overhead, as well as an adaptive **Mobile Web Interface** on smartphones and tablets.

### Desktop & Dispatcher Specifications

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Operating System** | **Windows 10 64-bit** (Build 19045+) or **macOS 12+** / **Ubuntu 22.04 LTS** | **Windows 11 64-bit** (Build 22631+) or **macOS 14+ (Sonoma/Sequoia)** |
| **Processor (CPU)** | Quad-Core 2.5 GHz x64 (Intel Core i3 10th Gen / AMD Ryzen 3 3100 or Apple M1) | 6-Core / 12-Thread 3.5 GHz+ (Intel Core i5 13th/14th Gen / AMD Ryzen 5 7600 or Apple M2/M3) |
| **Memory (RAM)** | **4 GB DDR4** (Tauri runtime uses only ~30–50 MB) | **16 GB DDR4 / DDR5** (for multi-tasking alongside GIS mapping and radio dispatch) |
| **Graphics (GPU)** | Integrated Graphics (Intel UHD 630 / AMD Radeon Vega 6) with DirectX 11 / WebGL 2.0 | Dedicated GPU (NVIDIA GeForce GTX 1650 / RTX 3050 or AMD Radeon RX 6600) with 4 GB+ VRAM |
| **Storage (Drive)** | **1 GB** free disk space on standard SSD | **10 GB** free NVMe M.2 SSD space (for rapid tile caching and exported incident PDF archives) |
| **Display Resolution** | 1366 × 768 pixels (Minimum supported window: 960 × 600) | **1920 × 1080 (Full HD)** or **2560 × 1440 (2K QHD)** multi-monitor setup |
| **Network Interface** | 10 Mbps stable broadband Ethernet or Wi-Fi | 50 Mbps+ Gigabit Fiber Ethernet (for sub-second WebSocket event streaming and video triage) |
| **Audio & Peripherals** | Standard sound card or speakers (for audible emergency SOS sirens) | Dedicated dispatch headset with high-output desktop speakers and dual-monitor workstation |

---

## 3. Backend & Cloud Infrastructure (Linux VPS / Server)

The backend runs containerized on **Podman / Docker** with **Laravel 13 (PHP 8.4-FPM)**, **MariaDB 10.11+**, and **Laravel Reverb (WebSocket Engine)**.

### Server Infrastructure Specifications

| Component | Minimum Specification (Pilot / Staging) | Recommended Specification (Production Municipal Deployment) |
|---|---|---|
| **Server OS** | **Ubuntu Server 22.04 / 24.04 LTS** (64-bit) or **Debian 12** | **Ubuntu Server 24.04 LTS (x86_64 or ARM64)** / **Rocky Linux 9** |
| **Processor (vCPU)** | 2 vCPUs @ 2.4 GHz | **4–8 Dedicated vCPUs @ 3.0 GHz+** (AMD EPYC / Intel Xeon Scalable) |
| **Memory (RAM)** | **2 GB ECC RAM** + 2 GB Swap | **8 GB – 16 GB ECC RAM** (handles concurrent WebSocket channels and database query caches) |
| **Storage (Disk)** | **30 GB SSD** (Minimum 1,000 IOPS) | **100 GB – 250 GB Enterprise NVMe SSD** (Minimum 10,000 IOPS with automated hourly snapshots) |
| **Network Bandwidth** | 100 Mbps uplink with 1 TB monthly bandwidth | **1 Gbps unmetered dedicated uplink** with redundant DDoS mitigation |
| **PHP Runtime** | PHP 8.4-FPM with OPcache & JIT enabled | PHP 8.4-FPM + Redis Cache + Supervisor worker pool |
| **Database Engine** | MariaDB 10.11+ / MySQL 8.0+ (InnoDB UTF8mb4) | MariaDB 11+ Galera Cluster or Primary-Replica High Availability setup |
| **WebSocket Server** | Laravel Reverb (Single instance, port 6001) | Laravel Reverb with Redis horizontal scaling cluster |
| **Object Storage** | Local Storage with Symlink | S3-Compatible Cloud Storage (Cloudflare R2 / AWS S3 / MinIO S3) |
| **External APIs** | PhilSMS API v3 (Transactional SMS) & Firebase Cloud Messaging (FCM v1) | PhilSMS API v3 with automated failover SMS routes & Google FCM v1 |
