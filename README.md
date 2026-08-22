# Location-Based Emergency Response App — SINE MDRRMO

![License](https://img.shields.io/badge/license-Proprietary-red)
![Laravel](https://img.shields.io/badge/backend-Laravel%2013-FF2D20?logo=laravel&logoColor=white)
![PHP](https://img.shields.io/badge/php-8.4-777BB4?logo=php&logoColor=white)
![Angular](https://img.shields.io/badge/frontend-Angular%2020%20%2F%20Ionic%208-DD0031?logo=angular&logoColor=white)
![Database](https://img.shields.io/badge/database-MariaDB-003545?logo=mariadb&logoColor=white)
![Broadcasting](https://img.shields.io/badge/realtime-Laravel%20Reverb-FF2D20?logo=laravel&logoColor=white)
![Containers](https://img.shields.io/badge/containers-Podman%20%2F%20Docker-892CA0?logo=podman&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS%20%7C%20Desktop-3DDC84?logo=android&logoColor=white)

A full-stack, location-based emergency response ecosystem engineered for the **Municipal Disaster Risk Reduction and Management Office (MDRRMO)** of San Isidro, Nueva Ecija. It connects citizens facing crises with local emergency responders through sub-second dispatching, anti-prank verification checks, offline resilient reporting, and live geospatial tracking.

Bachelor of Science in Information Technology Capstone Project — Nueva Ecija University of Science and Technology, San Isidro Campus.

---

## Overview

The platform operates as a cohesive, multi-platform emergency ecosystem:

- **Citizen Mobile Application (Android / iOS)** — Residents sign up with verified dual-sided government ID proof, manage their emergency health profiles, send one-tap SOS alerts with live GPS and camera proof (with offline queueing support), report road hazards, and receive barangay-targeted broadcast alerts.
- **Admin & Dispatcher Command Center (Electron Desktop)** — A native desktop application for Windows, macOS, and Linux. Staff track active emergencies in real-time on a boundary-locked Leaflet map, smart-dispatch responder fleets (BFP, PNP, Rescue, RHU), manage citizen verifications, and analyze incident trends with zero web frontend hosting costs.
- **Backend API & Real-Time Engine (Laravel 13 & Reverb)** — Containerized via Podman / Docker on a cloud Linux VPS, providing REST APIs, Sanctum token authentication, authoritative geospatial point-in-polygon resolution, transactional SMS via PhilSMS, and sub-second WebSocket broadcasting via Laravel Reverb.

---

## Tech Stack

<table>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/ionic/3880FF" width="40" height="40" alt="Ionic" pointer-events="none"/><br/><sub><b>Ionic 8</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/angular/DD0031" width="40" height="40" alt="Angular" pointer-events="none"/><br/><sub><b>Angular 20</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/capacitor/119EFF" width="40" height="40" alt="Capacitor" pointer-events="none"/><br/><sub><b>Capacitor 8</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/electron/47848F" width="40" height="40" alt="Electron" pointer-events="none"/><br/><sub><b>Electron 42</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/android/3DDC84" width="40" height="40" alt="Android" pointer-events="none"/><br/><sub><b>Android</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/apple/000000" width="40" height="40" alt="iOS" pointer-events="none"/><br/><sub><b>iOS</b></sub></td>
</tr>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/laravel/FF2D20" width="40" height="40" alt="Laravel" pointer-events="none"/><br/><sub><b>Laravel 13</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/php/777BB4" width="40" height="40" alt="PHP" pointer-events="none"/><br/><sub><b>PHP 8.4</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/mariadb/003545" width="40" height="40" alt="MariaDB" pointer-events="none"/><br/><sub><b>MariaDB</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/podman/892CA0" width="40" height="40" alt="Podman" pointer-events="none"/><br/><sub><b>Podman / Docker</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/nginx/009639" width="40" height="40" alt="Nginx" pointer-events="none"/><br/><sub><b>Nginx</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/leaflet/199900" width="40" height="40" alt="Leaflet" pointer-events="none"/><br/><sub><b>Leaflet.js</b></sub></td>
</tr>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/chartdotjs/FF6384" width="40" height="40" alt="Chart.js" pointer-events="none"/><br/><sub><b>Chart.js</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/firebase/FFCA28" width="40" height="40" alt="Firebase" pointer-events="none"/><br/><sub><b>Firebase (FCM)</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/gnubash/4EAA25" width="40" height="40" alt="PhilSMS" pointer-events="none"/><br/><sub><b>PhilSMS API</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/socketdotio/010101" width="40" height="40" alt="Reverb" pointer-events="none"/><br/><sub><b>Reverb (WS)</b></sub></td>
<td align="center" width="110"></td>
<td align="center" width="110"></td>
</tr>
</table>

---

## Core Features

- **Real-Time WebSocket Synchronization** — Powered by Laravel Reverb and Laravel Echo; incidents, unit assignments, hazard updates, and broadcast alerts appear instantaneously across devices without manual refresh.
- **Role-Based Access Control (RBAC)** — Granular permission tiers and token abilities for Citizens, Dispatchers, and Master Administrators.
- **Anti-Prank Verification System** — Requires live camera photo or 10-second video evidence (with automatic duration capping and WebM/MP4 magic byte verification) combined with locked GPS coordinates.
- **Granular Media Editor Preferences** — Configurable Photo Cropper and Video Trimmer toggles in User Settings allowing citizens to customize reporting speed with instant in-modal "Disable now" shortcuts.
- **3-Strike False Alarm Moderation** — Dispatchers can flag confirmed false alarms, automatically suspending accounts upon reaching 3 strikes.
- **Dual-Sided Government ID Verification** — Guided registration with clear photo tips, front & back ID capture, selfie with ID, and simplified Terms of Service & Privacy Policy (RA 10173 compliance).
- **Offline-First Emergency Reporting** — Offline queueing via **IndexedDB** guarantees SOS submissions are preserved during cellular outages and automatically dispatched when connectivity returns.
- **Home Screen Emergency Widget & Deep Links** — 1-Tap SOS widget pinned to the Android home screen connecting directly via `sinemdrrmo://report` with full-viewport map support.
- **Authoritative Server Geolocation (`BarangayResolver`)** — Ray-casting point-in-polygon math against official PSA boundaries locks incidents and camera views to San Isidro's municipal territory.
- **Interactive Admin Incident Map** — Live incident sidebar cards with animated pin focusing (`flyTo`), boundary dimming, and animated confirmation loaders on incident resolution.
- **Electron Desktop Client with Custom Controls** — Frameless native desktop command center with custom theme-aware window controls (minimize, maximize, close) and desktop sound/push alerts.
- **Smart Fleet & Unit Dispatching** — Linked responder and vehicle dropdowns prevent assigning mismatched equipment (e.g. fire trucks to medical calls).
- **"Golden Minute" Medical Profile** — Blood type, allergies, conditions, and PWD status are automatically attached to outgoing SOS alerts.
- **Public Road Hazard Reporting** — Residents report floods, fallen trees, and downed power lines with photo proof to assist emergency route planning.
- **Barangay-Targeted Rich Media Broadcasts** — Municipal safety banners can be broadcast town-wide or targeted to specific barangays, supporting titles and attached media files.
- **Multi-Channel OTP Authentication** — Secure verification via Email OTP or SMS OTP (PhilSMS) with native Android SMS User Consent auto-retrieval.
- **Interactive Analytics Dashboard** — Rolling 7/30/90-day incident trends, categorical breakdowns, and geographic volume distribution powered by Chart.js.
- **Unified Date-Range Search & Filters** — Standardized calendar filters and active filter chips shared across all admin tables.

---

## User Guides

| Guide | Target Audience | Key Contents |
|---|---|---|
| [Citizen Guide](./docs/guides/citizen-guide.md) | San Isidro Residents | Registration, Front/Back ID check, SOS filing, offline sync, widget setup, medical profile |
| [Dispatcher Guide](./docs/guides/dispatcher-guide.md) | Municipal Dispatchers | Incident Map, fleet dispatching, hazard clearance, log archive, alert broadcasts |
| [Admin Guide](./docs/guides/admin-guide.md) | Master Administrators | ID verification review, citizen moderation, dispatcher staff CRUD, feedback, settings |

---

## Documentation Suite

| Section | Document | Summary |
|---|---|---|
| **Setup & Requirements** | [System Requirements](./docs/setup/system-requirements.md) | Hardware & software minimum specs for Mobile, Desktop, and Server |
| | [Installation Guide](./docs/setup/installation.md) | Complete local development setup for Backend, WebSockets, and Frontend |
| | [Environment Variables](./docs/setup/environment.md) | `.env` reference for database, Reverb, PhilSMS, mail, and storage |
| | [Troubleshooting](./docs/setup/troubleshooting.md) | Solutions for WebSockets, PhilSMS, Leaflet, Android, and Electron |
| **Architecture** | [Architecture Overview](./docs/architecture/overview.md) | System topology, Reverb WebSocket channels, and directory layouts |
| | [Database Schema](./docs/architecture/database-schema.md) | Entity-Relationship (ER) diagram, table schemas, and constraints |
| | [Security Model](./docs/architecture/security.md) | Sanctum token abilities, anti-enumeration, OTP security, and rate limits |
| | [Disaster Recovery & Backups](./docs/architecture/disaster-recovery.md) | Automated 2-hour snapshots, high-level CLI (`backup list/desc/restore`), delta salvage |
| **API Reference** | [API — Authentication](./docs/api/auth.md) | Registration, login, OTP channels, and account lifecycle endpoints |
| | [API — Emergency](./docs/api/emergency.md) | SOS, fleet dispatch, road hazards, broadcasts, and WebSocket events |
| | [API — Admin](./docs/api/admin.md) | ID verifications, citizen moderation, staff CRUD, and feedback |
| **Features & Deployment** | [Feature Breakdown](./docs/features/overview.md) | In-depth technical explanation of all system capabilities |
| | [Production Deployment](./docs/deployment/production.md) | Containerized deployment on a Linux Cloud Server / VPS with SSL |

---

## Future Roadmap

1. **Multi-Language Support (I18N)** — Localized interface support for Tagalog / Filipino and Kapampangan dialects.
2. **Direct Two-Way Responders Messaging** — Secure real-time chat channel between active field responders and reporting citizens during dispatch.
3. **Automated Drone Dispatch Feeds** — Integration with municipal aerial survey feeds during typhoon and flood evacuations.

---

## License

This project is proprietary and **not open source**. It is developed for academic evaluation and municipal disaster response operations — copying, modifying, redistributing, or commercial deployment without prior written authorization from the Author is prohibited. Full terms: [LICENSE](./LICENSE).

© 2026 Emmanuel John C. Perez. All rights reserved.
