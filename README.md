# Location-Based Emergency Response App — SINE MDRRMO

![License](https://img.shields.io/badge/license-Proprietary-red)
![Frontend](https://img.shields.io/badge/frontend-Ionic%208%20%2F%20Angular%2017-3880FF?logo=ionic&logoColor=white)
![Backend](https://img.shields.io/badge/backend-Laravel%2011-FF2D20?logo=laravel&logoColor=white)
![Database](https://img.shields.io/badge/database-MariaDB%20%2F%20MySQL-003545?logo=mariadb&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-3DDC84?logo=android&logoColor=white)
![Status](https://img.shields.io/badge/status-Capstone%20Project-blueviolet)

A full-stack, location-based emergency response system built for the **Municipal Disaster Risk Reduction and Management Office (MDRRMO)** of San Isidro, Nueva Ecija. It bridges citizens experiencing emergencies with local response teams — providing rapid dispatch, anti-prank verification, and live location tracking.

Bachelor of Science in Information Technology Capstone Project — Nueva Ecija University of Science and Technology, San Isidro Campus.

---

## Overview

The platform is split into two role-based interfaces:

- **Citizen App** — residents register, manage their profile, trigger one-tap SOS alerts with live GPS + photo/video evidence, and report road hazards.
- **Command Center (Admin/Dispatcher Dashboard)** — a real-time, auto-polling map for MDRRMO staff to triage incoming emergencies, dispatch specific responder units, and manage citizen accounts.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Ionic 8, Angular 17 (standalone components) |
| Native Plugins | Capacitor (Geolocation, Camera) |
| Backend API | Laravel 11 (PHP), Sanctum token auth |
| Database | MariaDB / MySQL |
| Mapping | Leaflet.js + custom GeoJSON boundary masking |
| Data Visualization | Chart.js |
| Deployment Target | Docker (nginx + php-fpm), AWS |

## Core Features

- **Role-Based Access Control** — distinct dashboards and route guards for Citizens, Dispatchers, and Master Admins, enforced by Sanctum token abilities.
- **One-Tap SOS with Anti-Prank Verification** — native GPS extraction combined with a forced live-camera capture to deter fake emergency spam.
- **Geofenced Live Map** — Leaflet map using ray-casting + GeoJSON masks to lock the SOS pins and camera view within San Isidro's municipal borders.
- **Real-Time Dispatch Polling** — the command center polls the API in the background and drops interactive pins the moment an emergency is filed.
- **Dynamic Asset Dispatching** — cascading dropdowns linking responder units (Fire, Police, Rescue, RHU) to their assigned vehicles.
- **"Golden Minute" Medical Profile** — citizens can optionally attach blood type, allergies, and PWD status to their SOS so responders arrive prepared.
- **Crowdsourced Hazard Mapping** — residents report road hazards with photo evidence, helping dispatchers route responders safely.
- **Public Broadcast System** — Master Admin can push real-time alert banners to every citizen dashboard.
- **OTP-Based Account Recovery & Password Changes** — stateless, email-verified OTP flow for password resets and changes.
- **Analytics Dashboard** — filterable emergency trends (7/30/90 days) with interactive line, bar, and doughnut charts.

## Documentation

| Section | Description |
|---|---|
| [Installation Guide](./docs/setup/installation.md) | Local environment setup — database, backend, frontend |
| [Environment Variables](./docs/setup/environment.md) | `.env` reference for backend configuration |
| [Troubleshooting](./docs/setup/troubleshooting.md) | Fixes for common setup issues |
| [Architecture Overview](./docs/architecture/overview.md) | System design, RBAC, project structure |
| [Database Schema](./docs/architecture/database-schema.md) | Tables, relationships, and constraints |
| [Security Model](./docs/architecture/security.md) | Auth flow, token abilities, rate limiting |
| [API — Auth](./docs/api/auth.md) | Registration, login, OTP, password endpoints |
| [API — Emergency](./docs/api/emergency.md) | SOS, dispatch, and hazard endpoints |
| [API — Admin](./docs/api/admin.md) | Citizen/dispatcher management, feedback, analytics |
| [Feature Breakdown](./docs/features/overview.md) | Detailed walkthrough of every feature |
| [Production Deployment](./docs/deployment/production.md) | Docker + nginx/php-fpm + AWS deployment plan |

## Future Scope

1. **Offline Resiliency** — queue SOS requests locally during outages and auto-fire them once connectivity returns.
2. **Push Notifications** — Firebase Cloud Messaging integration to alert citizens when responders are en route.

## License

This project is proprietary and **not open source**. Viewing and academic reference are permitted with attribution; copying, modification, redistribution, and deployment are not, without the Author's written permission. See [LICENSE](./LICENSE) for full terms.

© 2025 Emmanuel John C. Perez. All rights reserved.
