# Architecture Overview

Comprehensive architectural overview of the SINE MDRRMO Location-Based Emergency Response System (Version 0.73.0).

---

## 1. High-Level System Architecture

The application operates as a decoupled client-server architecture consisting of native mobile (Android/iOS via Capacitor), desktop (Tauri v2), and responsive mobile admin clients interacting with a centralized Laravel 13 backend over secure **HTTPS REST APIs** and **WSS WebSockets**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT LAYER                           │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   Citizen Mobile App   │  │   Admin & Dispatcher Command Center  │  │
│  │  (Android / iOS Mobile)│  │   (Tauri Desktop / Mobile Admin UI)  │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└────────────────▲───────────────────────────────▲───────────────────────┘
                 │                               │
        HTTPS    │ (Sanctum Tokens)              │ WSS (Laravel Echo / Reverb)
        REST API │                               │ Live Events: emergencies, hazards,
                 │                               │ broadcasts, users
┌────────────────▼───────────────────────────────▼───────────────────────┐
│                       BACKEND & SERVICE LAYER                          │
│                                                                        │
│  ┌────────────────────────┐         ┌───────────────────────────────┐  │
│  │   Laravel 13 REST API  │         │      Laravel Reverb (WS)      │  │
│  │  (PHP 8.4-FPM + Sanctum│         │      (Port 6001 / Nginx)      │  │
│  └───────────┬────────────┘         └───────────────┬───────────────┘  │
│              │                                      │                  │
│              ▼                                      ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            BarangayResolver (Server Geospatial Engine)           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────┬─────────────────────────┬───────────────┘
       │                       │                         │
       ▼                       ▼                         ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────────────────┐
│   MariaDB    │       │ S3 / Cloud   │       │    Third-Party Cloud     │
│   Database   │       │ Storage (R2) │       │ ├─ PhilSMS (SMS OTP)     │
│ (emergencydb)│       │ (Media Proof)│       │ └─ Firebase (FCM v1)     │
└──────────────┘       └──────────────┘       └──────────────────────────┘
```

---

## 2. Real-Time Communication Architecture (Laravel Reverb & Echo)

Rather than continuous polling, the platform employs **Laravel Reverb**, a high-performance, Pusher-compatible WebSocket engine built natively for Laravel.

### Broadcast Channels & Events
| Channel | Event Name | Trigger | Consumer & Action |
|---|---|---|---|
| `emergencies` | `EmergencyUpdated` | SOS submitted, dispatched, resolved, cancelled, or false alarm marked | Admin/Dispatcher live map instantly adds/updates pins without reload. |
| `hazards` | `HazardUpdated` | Hazard reported or resolved | Dashboard hazard layer updates marker positions and status. |
| `broadcasts` | `BroadcastMessageUpdated` | Admin creates or clears an alert broadcast | Citizen home screen displays or dismisses targeted alert banners immediately. |
| `users` | `UserVerified` | Citizen ID approved, rejected, suspended, or reinstated | Admin verification queue refreshes; Citizen pending verification screen updates. |

> **Resilience Fallback:** Lightweight background polling runs alongside WebSockets to guarantee synchronization during reconnection events.

---

## 3. Role-Based Access Control (RBAC)

The system enforces strict multi-tenant role isolation across three tiers: **`citizen`**, **`dispatcher`**, and **`admin`**.

### Enforcement Layers
1. **Backend Token Abilities (Laravel Sanctum):**
   - **`admin`**: Granted `['admin', 'dispatcher', 'citizen']` abilities. Full access to ID verifications, citizen moderation, dispatcher management, feedback, and dispatch operations.
   - **`dispatcher`**: Granted `['dispatcher']` ability. Can dispatch responders, resolve emergencies, acknowledge hazards, and issue broadcasts. Forbidden from accessing admin-only routes (returns HTTP 403).
   - **`citizen`**: Granted `['citizen']` ability. Limited to filing personal SOS, submitting hazards, updating personal profile, and viewing scoped active alerts.
2. **Frontend Angular Route Guards:**
   - `auth-guard.ts`: Enforces authenticated sessions and role-specific dashboard routing.
   - `guest-guard.ts`: Redirects authenticated users away from login/registration pages.

---

## 4. Key Design & Technical Decisions

1. **Authoritative Server-Side Geolocation (`BarangayResolver`):**
   - The frontend previews the barangay locally for instant UI feedback, but the backend **always** performs server-side ray-casting against official PSA boundary polygons (`san-isidro-barangays.geojson`) to guarantee authenticity.
2. **Offline-First Emergency Reporting (IndexedDB):**
   - In low-connectivity disaster scenarios, SOS submissions and media proofs are stored locally in IndexedDB and queued for auto-submission the instant connectivity is restored.
3. **Anti-Prank Multi-Point Verification:**
   - SOS reports require live camera capture (preventing gallery uploads) and GPS lock. Confirmed false alarms accumulate strikes (`false_alarm_strikes`), triggering automatic account suspension on the 3rd strike.
4. **Multi-Platform Admin Operations:**
   - The command center runs as a lightweight **Tauri v2 Desktop App** on Windows, macOS, and Linux with custom frameless window controls and background OS alerts, as well as an adaptive **Mobile Admin UI** with draggable bottom sheets and touch filters for field dispatchers.
5. **Interactive Onboarding & Operations Guided Tours:**
   - Unified tour engine with viewport-responsive step definitions (desktop vs mobile), animated map pin focus (`flyTo`), and triage popup trigger cards with mock demo fallbacks.
