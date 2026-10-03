# Architecture Overview

Comprehensive architectural overview of the SINE MDRRMO Location-Based Emergency Response System.

---

## 1. High-Level System Architecture

The application operates as a decoupled client-server architecture consisting of native mobile (Android/iOS via Capacitor), desktop (Tauri v2), and responsive mobile admin clients interacting with a centralized Go Fiber backend over secure **HTTPS REST APIs** and **WSS WebSockets**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT LAYER                           │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Citizen Mobile App   │  │  Admin & Dispatcher Operations Desk  │  │
│  │  (Android / iOS Mobile)│  │   (Tauri Desktop / Mobile Admin UI)  │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────▲───────────────────────────────▲───────────────────────┘
                 │                               │
        HTTPS    │ (Bearer Tokens)               │ WSS (WebSockets / Echo)
        REST API │                               │ Live Events: emergencies, hazards,
                 │                               │ broadcasts, users
┌────────────────▼───────────────────────────────▼───────────────────────┐
│                       BACKEND & SERVICE LAYER                          │
│                                                                        │
│  ┌────────────────────────┐         ┌───────────────────────────────┐  │
│  │    Go Fiber v2 REST    │         │      Embedded WebSocket       │  │
│  │     (Port 3000)        │         │      Engine (Port 3000)       │  │
│  └───────────┬────────────┘         └───────────────┬───────────────┘  │
│              │                                      │                  │
│              ▼                                      ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            BarangayResolver (Server Geospatial Engine)           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────┬─────────────────────────────────────────────────┬───────────────┘
       │                                                 │
       ▼                                                 ▼
┌──────────────┐                               ┌──────────────────────────┐
│   MariaDB    │                               │    Cloud Services        │
│   Database   │                               │ ├─ Dedicated Host Storage│
│ (emergencydb)│                               │ ├─ PhilSMS (SMS OTP)     │
└──────────────┘                               │ ├─ Resend (Email OTP)    │
                                               │ └─ Firebase (FCM v1)     │
                                               └──────────────────────────┘
```

---

## 2. Real-Time Communication Architecture (Embedded WebSockets & Echo)

Rather than continuous polling, the platform employs a high-performance, Pusher-compatible embedded WebSocket hub in Go Fiber.

### Broadcast Channels & Events
| Channel | Event Name | Trigger | Consumer & Action |
|---|---|---|---|
| `emergencies` | `EmergencyUpdated` | SOS submitted, dispatched, resolved, cancelled, or false alarm marked | Admin/Dispatcher live map instantly adds/updates pins without reload. |
| `hazards` | `HazardUpdated` | Hazard reported or resolved | Dashboard hazard layer updates marker positions and status. |
| `broadcasts` | `BroadcastMessageUpdated` | Admin creates or clears an alert broadcast | Citizen home screen displays or dismisses targeted alert banners immediately. |
| `users` | `UserVerified` | Citizen ID approved, rejected, suspended, or reinstated | Admin verification queue refreshes; Citizen pending verification screen updates. |

> **Resilience & Scaling Workaround:**
> - **Lifecycle-Aware WebSocket Pause:** On native mobile (Capacitor) and background browser tabs, the WebSocket connection pauses after a 4-second grace period. Background notifications are delegated to Firebase Cloud Messaging (FCM). Upon foregrounding, the connection resumes with random jitter (50–400ms) to prevent thundering-herd reconnect spikes.
> - **Resilience Fallback:** Lightweight background polling runs alongside WebSockets to guarantee synchronization during reconnection events.

---

## 3. High-Performance Concurrency & In-Memory State Engine

To support high-concurrency disaster scenarios across San Isidro's population without overloading VPS resources:

1. **Native Go Concurrency & Goroutines:**
   - Resolves Bearer tokens and handles requests concurrently with lightweight goroutines and connection pooling, keeping user-facing HTTP request latencies under 15ms.
   - Throttles token timestamp updates, eliminating high-frequency write storms on MariaDB.
2. **Asynchronous Notification Dispatch:**
   - Background worker goroutines process email notifications (Resend), SMS OTPs (PhilSMS), and FCM pushes without blocking the main event loop.
3. **Dedicated Host Storage & Low Footprint:**
   - Persistent uploads and map tiles are mapped to isolated host storage (`/var/www/sine-storage`) with automated subfolder organization.
   - The compiled Go binary runs with an ultra-low memory footprint (~35–50 MB RAM), leaving the host system stable and responsive even during peak load.

---

## 4. Role-Based Access Control (RBAC)

The system enforces strict multi-tenant role isolation across three tiers: **`citizen`**, **`dispatcher`**, and **`admin`**.

### Enforcement Layers
1. **Backend Token Abilities:**
   - **`admin`**: Granted `['admin', 'dispatcher', 'citizen']` abilities. Full access to ID verifications, citizen moderation, dispatcher management, feedback, and dispatch operations.
   - **`dispatcher`**: Granted `['dispatcher']` ability. Can dispatch responders, resolve emergencies, acknowledge hazards, and issue broadcasts. Forbidden from accessing admin-only routes (returns HTTP 403).
   - **`citizen`**: Granted `['citizen']` ability. Limited to filing personal SOS, submitting hazards, updating personal profile, and viewing scoped active alerts.
2. **Frontend Angular Route Guards:**
   - `auth-guard.ts`: Enforces authenticated sessions and role-specific dashboard routing.
   - `guest-guard.ts`: Redirects authenticated users away from login/registration pages.

---

## 5. Key Design & Technical Decisions

1. **Authoritative Server-Side Geolocation (`BarangayResolver`):**
   - The frontend previews the barangay locally for instant UI feedback, but the backend **always** performs server-side ray-casting against official PSA boundary polygons (`san-isidro-barangays.geojson`) to guarantee authenticity.
2. **Offline-First Emergency Reporting (IndexedDB):**
   - In low-connectivity disaster scenarios, SOS submissions and media proofs are stored locally in IndexedDB and queued for auto-submission the instant connectivity is restored.
3. **Anti-Prank Multi-Point Verification:**
   - SOS reports require live camera capture (preventing gallery uploads) and GPS lock. Confirmed false alarms accumulate strikes (`false_alarm_strikes`), triggering automatic account suspension on the 3rd strike.
4. **Multi-Platform Admin Operations:**
   - The operations dashboard runs as a lightweight **Tauri v2 Desktop App** on Windows, macOS, and Linux with custom frameless window controls and background OS alerts, as well as an adaptive **Mobile Admin UI** with draggable bottom sheets and touch filters for field dispatchers.
5. **Interactive Onboarding & Operations Guided Tours:**
   - Unified tour engine with viewport-responsive step definitions (desktop vs mobile), animated map pin focus (`flyTo`), and triage popup trigger cards with mock demo fallbacks.
