# System Requirements

Hardware, operating system, and network specifications required to run the **SINE MDRRMO Emergency Response System** across Citizen Mobile, Admin & Dispatcher Operations Dashboard (Portable Desktop & Mobile Interface), and Backend Cloud Infrastructure.

---

## 1. Citizen Mobile Application (Android & iOS)

The citizen application is built on **Ionic 8 / Angular 20** and compiled natively via **Capacitor 8**.

### Mobile Requirements

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Operating System** | **Android 10.0+** (API 29) or **iOS 16.0+** | **Android 13.0+** or **iOS 17.0+** |
| **Processor** | 64-bit Quad-Core 2.0 GHz | 64-bit Octa-Core 2.4 GHz+ |
| **Memory (RAM)** | **3 GB** | **6 GB – 8 GB** |
| **Storage Space** | **500 MB** free internal storage | **2 GB** free internal storage (for offline queueing & cached proof media) |
| **Camera & Sensors** | Working rear camera (photo/video evidence) & dedicated GPS receiver | High-resolution camera with autofocus & multi-constellation GPS (A-GPS / GLONASS) |
| **Network Connection** | 3G / 4G LTE mobile data (minimum 2 Mbps) | 4G LTE / 5G or stable Wi-Fi (10 Mbps+) |

---

## 2. Admin & Dispatcher Operations Dashboard (Windows Desktop & Mobile Interface)

The MDRRMO Operations Dashboard runs as a lightweight, standalone portable executable (**Tauri v2 / Rust**) with zero installer overhead, as well as an adaptive **Mobile Web Interface** on smartphones and tablets.

### Desktop & Dispatcher Requirements

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Operating System** | **Windows 10 64-bit** (Build 19045+) / **macOS 12+** / **Ubuntu 22.04 LTS** | **Windows 11 64-bit** / **macOS 14+** |
| **Processor (CPU)** | Dual-Core 2.0 GHz x64 | Quad-Core 3.0 GHz+ x64 |
| **Memory (RAM)** | **4 GB** (Tauri runtime uses ~30–50 MB RAM) | **8 GB – 16 GB** (for comfortable multi-tasking with GIS mapping & office apps) |
| **Storage Space** | **500 MB** free disk space | **2 GB** free disk space |
| **Network Connection** | 5 Mbps broadband or stable Wi-Fi | 25 Mbps+ fiber broadband (for sub-second WebSocket event streaming) |
| **Audio Output** | Standard speakers or 3.5mm audio jack (for audible SOS sirens) | Dedicated dispatch headset or desktop speakers |

---

## 3. Backend & Cloud Infrastructure (Linux VPS / Municipal Server)

The backend runs as a high-performance native Go micro-daemon on **Go Fiber v2**, backed by **MariaDB 10.11+**, and an embedded high-throughput **WebSocket Engine**.

### Server Requirements

| Component | Minimum Specification (Pilot / Staging) | Recommended Specification (Production Municipal Deployment) |
|---|---|---|
| **Operating System** | **Ubuntu Server 22.04 / 24.04 LTS** (64-bit) or **Debian 12** | **Ubuntu Server 24.04 LTS** (64-bit) |
| **Processor (vCPU)** | 1-2 vCPUs @ 2.0 GHz | **2-4 Dedicated vCPUs @ 2.8 GHz+** |
| **Memory (RAM)** | **1 GB RAM** (Go micro-daemon uses ~30–60 MB RAM) | **4 GB – 8 GB ECC RAM** |
| **Storage (Disk)** | **20 GB SSD** | **80 GB – 150 GB Enterprise SSD** (for media & tile storage) |
| **Network Uplink** | 50 Mbps bandwidth | **500 Mbps – 1 Gbps unmetered uplink** |
| **Software Stack** | Go 1.24, MariaDB 10.11+, Systemd | Go 1.24+, MariaDB 11+, Systemd, Resend API, PhilSMS Gateway |
