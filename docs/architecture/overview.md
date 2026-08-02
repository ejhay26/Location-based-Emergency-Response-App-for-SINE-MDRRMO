# Architecture Overview

## How It's Put Together

The app is a client-server setup: a mobile/web/desktop client talking to a JSON API.

```
┌─────────────────────────────┐        HTTPS / JSON        ┌──────────────────────────┐
│  Ionic + Angular App          │ ──────────────────────────▶ │  Laravel API (Sanctum)   │
│  (Capacitor: Android/iOS,     │ ◀────────────────────────── │                          │
│   Electron: Desktop for admin)│                             └──────────────────────────┘
└─────────────────────────────┘                                          │
                                                                          ▼
                                                              ┌──────────────────────────┐
                                                              │   MariaDB / MySQL         │
                                                              └──────────────────────────┘
```

The frontend never talks to the database directly — everything goes through the Laravel API, using a Sanctum bearer token for auth.

## Roles & Permissions (RBAC)

Three roles: **citizen**, **dispatcher**, **admin** (the `role` column on `users` — see [Database Schema](./database-schema.md)).

This is enforced in two places:

1. **Backend — Sanctum token abilities.** When someone logs in, they get a token with abilities matching their role. Admin tokens carry `['admin', 'dispatcher', 'citizen']`; dispatcher tokens carry `['dispatcher', 'citizen']`; citizen tokens carry `['citizen']`. Routes in `routes/api.php` are locked behind `->middleware('ability:admin')` or `->middleware('ability:dispatcher')`, so an admin can still reach dispatcher routes, but a dispatcher can't reach admin-only ones. Full details in [Security Model](./security.md).
2. **Frontend — route guards.** `core/guards/auth-guard.ts` and `core/guards/guest-guard.ts` block navigation based on login state and role, so someone without access never even sees a restricted page. This is just for a smoother experience though — the backend checks above are what actually keeps things secure.

<details>
<summary><b>Backend folder layout (<code>backend/app</code>)</b></summary>

```
Http/Controllers/
├── Auth/            → AuthController, PasswordController (register, login, OTP, reset)
├── Admin/           → CitizenController, DispatcherController (accounts & verification)
├── Emergency/        → SosController, DispatchController, HazardController,
│                       BroadcastController, AnalyticsController
├── ProfileController.php
├── UserSettingsController.php
└── FeedbackController.php

Models/              → User, EmergencyRequest, Dispatch, Hazard, Broadcast,
                        Responder, Vehicle, IncidentType, DeviceToken

Services/            → FirebasePushService, NotificationService, OtpService, SemaphoreService
Traits/              → MediaHandling (shared file upload logic)
Rules/               → custom validation rules
```

Controllers are grouped by what they do, so emergency/dispatch logic (the core of the app) is kept apart from account and admin management.

</details>

<details>
<summary><b>Frontend folder layout (<code>frontend/src/app</code>)</b></summary>

```
core/
├── guards/          → auth-guard, guest-guard, permission-init
└── services/         → shared app-wide services (API client, auth state, etc.)

features/
├── auth/            → login, registration, OTP verification
├── citizen/         → home, report (SOS + hazard), status, profile, settings, help, tabs
└── admin/           → admin-dashboard (with map, citizens, dispatchers, analytics, feedback panels)

shared/              → reusable components used across features
```

Angular 20 **standalone components** are used throughout — no `NgModule` declarations. This migration fixed a bunch of cross-platform issues between the web build, Android/iOS (Capacitor), and the desktop build (Electron).

</details>

## A Few Design Choices Worth Knowing

- **Sanctum tokens instead of sessions** — since the frontend runs as a mobile app, a web app, and a desktop app, a bearer token fits better across all three than cookie-based sessions.
- **Real boundary shapes, not a bounding box** — the map uses actual GeoJSON polygons of San Isidro's borders (checked with a ray-casting method) to keep pins and the camera view inside the town, instead of a rough rectangle.
- **Polling instead of WebSockets** — the dashboard checks the API for new emergencies/hazards/broadcasts on a timer instead of keeping a live socket open. A little slower, but much simpler to run — which matters given the AWS free-tier deployment target (see [Production Deployment](../deployment/production.md)).
- **`[hidden]` instead of `*ngIf` for the Leaflet map** — avoids a Leaflet bug where the map goes blank if its container gets destroyed and rebuilt by Angular when switching tabs.

## Related Docs

- [Database Schema](./database-schema.md)
- [Security Model](./security.md)
- [API — Auth](../api/auth.md) · [Emergency](../api/emergency.md) · [Admin](../api/admin.md)
