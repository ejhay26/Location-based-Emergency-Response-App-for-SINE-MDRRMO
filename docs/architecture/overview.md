# Architecture Overview

Comprehensive architectural overview of the SINE MDRRMO Location-Based Emergency Response System.

---

## 1. High-Level System Architecture

The application operates as a decoupled client-server architecture consisting of native mobile and desktop clients interacting with a centralized Laravel 13 backend over secure **HTTPS REST APIs** and **WSS WebSockets**.

```
┌────────────────────────────────────────────────────────┐
│               FRONTEND CLIENT LAYER                   │
│                                                        │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │   Citizen Mobile App   │  │ Dispatcher Dashboard │  │
│  │  (Android / iOS Mobile)│  │  (Electron Desktop)  │  │
│  └────────────────────────┘  └──────────────────────┘  │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       HTTPS    │ (Sanctum Tokens)       │ WSS (Laravel Echo / Reverb)
       REST API │                        │ Live Events: emergencies, hazards,
                │                        │ broadcasts, users
┌───────────────▼────────────────────────▼───────────────┐
│               BACKEND & SERVICE LAYER                 │
│                                                        │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │   Laravel 13 REST API  │  │ Laravel Reverb (WS)  │  │
│  │  (PHP 8.4-FPM + Sanctum│  │ (Port 6001 / Nginx)  │  │
│  └───────────┬────────────┘  └──────────┬───────────┘  │
│              │                          │              │
│              ▼                          ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    BarangayResolver (Server Geospatial Engine)   │  │
│  └──────────────────────────────────────────────────┘  │
└──────┬───────────────┬─────────────────┬───────────────┘
       │               │                 │
       ▼               ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│   MariaDB    │ │ S3 / Cloud   │ │  Third-Party Cloud   │
│   Database   │ │ Storage (R2) │ │ ├─ PhilSMS (SMS OTP) │
│ (emergencydb)│ │ (Media Proof)│ │ └─ Firebase (FCM v1) │
└──────────────┘ └──────────────┘ └──────────────────────┘
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

> **Resilience Fallback:** Lightweight background polling (e.g., in Electron's `DesktopNotificationsService` or `NetworkService.recheck()`) runs alongside WebSockets to guarantee synchronization during reconnection events.

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

## 4. Backend Directory Structure (`backend/app/`)

```
backend/app/
├── Events/
│   ├── BroadcastMessageUpdated.php   → Real-time broadcast channel events
│   ├── EmergencyUpdated.php          → SOS lifecycle broadcast events
│   ├── HazardUpdated.php             → Hazard state broadcast events
│   └── UserVerified.php              → Citizen verification lifecycle events
├── Http/
│   └── Controllers/
│       ├── Admin/
│       │   ├── CitizenController.php      → Verification approval/denial, citizen moderation
│       │   └── DispatcherController.php   → Staff account CRUD & deactivation
│       ├── Auth/
│       │   ├── AuthController.php         → Registration, multi-channel login & OTPs
│       │   └── PasswordController.php     → Authenticated password change with OTP
│       ├── Emergency/
│       │   ├── AnalyticsController.php    → Trend analytics & barangay breakdown
│       │   ├── BroadcastController.php    → Targeted multi-media alert broadcast
│       │   ├── DispatchController.php     → Unit assignment, resolve, false alarm strikes
│       │   ├── HazardController.php       → Road hazard reporting & clearance
│       │   └── SosController.php          → One-tap SOS submission & history
│       ├── FeedbackController.php         → Citizen feedback storage & JSON export
│       ├── ProfileController.php          → Avatars, "Golden Minute" medical profile, push tokens
│       └── UserSettingsController.php     → Key-value persistent preferences
├── Models/
│   ├── Barangay.php, Broadcast.php, DeviceToken.php, Dispatch.php,
│   ├── EmergencyRequest.php, Hazard.php, IncidentType.php,
│   └── Responder.php, User.php, Vehicle.php
├── Services/
│   ├── BarangayResolver.php          → Geospatial ray-casting against PSA GeoJSON
│   ├── FirebasePushService.php       → Platform-specific FCM v1 push payload delivery
│   ├── NotificationService.php       → Push notification fan-out manager
│   ├── OtpService.php                → Rate-limited OTP generation, caching & verification
│   └── PhilSmsService.php            → PhilSMS API v3 transactional SMS gateway
├── Support/
│   └── PhoneNumber.php               → Philippine mobile number standardizer (+63/09 -> 63)
└── Traits/
    └── MediaHandling.php             → Base64 decode, MIME validation, storage handling
```

---

## 5. Frontend Architecture (`frontend/src/app/`)

The frontend is implemented entirely using **Angular 20 Standalone Components** (no `NgModule` dependencies), ensuring compatibility across Capacitor mobile builds and Electron desktop targets.

```
frontend/src/app/
├── core/
│   ├── guards/          → auth-guard, guest-guard
│   └── services/
│       ├── api.ts                    → Centralized REST HTTP client & Sanctum interceptor
│       ├── echo.service.ts           → Laravel Echo (Reverb) WebSocket manager
│       ├── offline-queue.ts          → IndexedDB offline report persistence & auto-flush
│       ├── otp-autofill.ts           → Native Android SMS User Consent retriever
│       ├── widget-pin.ts             → Native Android 8+ Home Screen Widget pin requester
│       ├── deep-link.ts              → sinemdrrmo:// custom scheme URL handler
│       ├── desktop-notifications.ts  → Electron native OS notification broadcaster
│       ├── push-notifications.ts     → Capacitor FCM push registration
│       ├── network.ts                → Network reachability prober
│       └── user-settings.ts          → App-wide reactive user settings
├── features/
│   ├── auth/            → login, register (Front & Back ID), pending-verification, account-setup
│   ├── citizen/         → home, report (SOS + Hazard), status, profile, settings, help, tabs
│   └── admin/           → admin-dashboard (Incident Map, Hazards, Archive, Analytics,
│                           Broadcast, Verifications, Citizens, Dispatchers, Feedback, Settings)
└── shared/
    └── components/      → date-range-filter, filter-summary-bar, floating-sos-card,
                           otp-box-input, tour-overlay, video-trimmer, app-dialogs
```

---

## 6. Key Design & Technical Decisions

1. **Authoritative Server-Side Geolocation (`BarangayResolver`):**
   - The frontend previews the barangay locally for instant UI feedback, but the backend **always** performs server-side ray-casting against official PSA boundary polygons (`san-isidro-barangays.geojson`) to guarantee authenticity.
2. **Offline-First Emergency Reporting (IndexedDB):**
   - In low-connectivity disaster scenarios, SOS submissions and media proofs are stored locally in IndexedDB and queued for auto-submission the instant connectivity is restored.
3. **Anti-Prank Multi-Point Verification:**
   - SOS reports require live camera capture (preventing gallery uploads) and GPS lock. Confirmed false alarms accumulate strikes (`false_alarm_strikes`), triggering automatic account suspension on the 3rd strike.
4. **Desktop Native Admin Experience:**
   - The command center runs as an Electron application with zero web hosting costs, featuring native OS desktop notifications and borderless multi-window controls.
