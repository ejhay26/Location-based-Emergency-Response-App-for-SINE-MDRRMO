# Location-Based Emergency Response App — SINE MDRRMO

[![License](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE)
[![Laravel](https://img.shields.io/badge/backend-Laravel%2013-FF2D20?logo=laravel&logoColor=white)](https://laravel.com)
[![Angular](https://img.shields.io/badge/frontend-Angular%2020%20%2F%20Ionic%208-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![Database](https://img.shields.io/badge/database-MariaDB-003545?logo=mariadb&logoColor=white)](https://mariadb.org)
[![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS%20%7C%20Desktop-3DDC84?logo=android&logoColor=white)](https://capacitorjs.com)

A full-stack, location-based emergency response app built for the **Municipal Disaster Risk Reduction and Management Office (MDRRMO)** of San Isidro, Nueva Ecija. It connects citizens who need help with local responders — with fast dispatch, anti-prank checks, and live location tracking.

Bachelor of Science in Information Technology Capstone Project — Nueva Ecija University of Science and Technology, San Isidro Campus.

---

## Overview

The app has two sides:

- **Citizen App** — residents sign up, manage their profile, send a one-tap SOS with live GPS + photo/video proof, and report road hazards.
- **Admin/Dispatcher Dashboard** — a real-time, auto-updating map where MDRRMO staff can see incoming emergencies, send out the right responder unit, and manage citizen accounts. Runs as a web dashboard for staff, and also as a desktop app (Electron) for admins.

## Tech Stack

<table>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/ionic/3880FF" width="40" height="40" alt="Ionic"/><br/><sub><b>Ionic 8</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/angular/DD0031" width="40" height="40" alt="Angular"/><br/><sub><b>Angular 20</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/capacitor/119EFF" width="40" height="40" alt="Capacitor"/><br/><sub><b>Capacitor 8</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/electron/47848F" width="40" height="40" alt="Electron"/><br/><sub><b>Electron</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/android/3DDC84" width="40" height="40" alt="Android"/><br/><sub><b>Android</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/apple/000000" width="40" height="40" alt="iOS"/><br/><sub><b>iOS</b></sub></td>
</tr>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/laravel/FF2D20" width="40" height="40" alt="Laravel"/><br/><sub><b>Laravel 13</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/php/777BB4" width="40" height="40" alt="PHP"/><br/><sub><b>PHP 8.3</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/mariadb/003545" width="40" height="40" alt="MariaDB"/><br/><sub><b>MariaDB / MySQL</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/docker/2496ED" width="40" height="40" alt="Docker"/><br/><sub><b>Docker</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/nginx/009639" width="40" height="40" alt="nginx"/><br/><sub><b>nginx</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/leaflet/199900" width="40" height="40" alt="Leaflet"/><br/><sub><b>Leaflet.js</b></sub></td>
</tr>
<tr>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/chartdotjs/FF6384" width="40" height="40" alt="Chart.js"/><br/><sub><b>Chart.js</b></sub></td>
<td align="center" width="110"><img src="https://cdn.simpleicons.org/firebase/FFCA28" width="40" height="40" alt="Firebase"/><br/><sub><b>Firebase (push)</b></sub></td>
<!-- <td align="center" width="110"><img src="https://cdn.simpleicons.org/amazonaws/232F3E" width="40" height="40" alt="AWS"/><br/><sub><b>AWS</b></sub></td> -->
<td align="center" width="110"></td>
<td align="center" width="110"></td>
<td align="center" width="110"></td>
</tr>
</table>

## Core Features

- **Role-Based Access** — separate dashboards and permissions for Citizens, Dispatchers, and Master Admins.
- **One-Tap SOS with Anti-Prank Check** — grabs GPS location and forces a live camera photo (not a gallery pick) so people can't easily spam fake emergencies.
- **Live Map with Boundary Lock** — the map keeps SOS pins and the camera view inside San Isidro's actual town borders, using real boundary shapes instead of a rough box.
- **Real-Time Dispatch Updates** — the dashboard checks for new emergencies in the background and drops pins on the map the moment one comes in.
- **Smart Unit Assignment** — dropdowns that link each responder (Fire, Police, Rescue, RHU) to their assigned vehicle, so dispatchers can't pick a mismatched pair.
- **"Golden Minute" Medical Profile** — citizens can save blood type, allergies, and PWD status ahead of time, so it's attached automatically when they send an SOS.
- **Hazard Reporting** — residents can report road hazards (floods, fallen trees, etc.) with photo proof, so dispatchers can route around them.
- **Public Broadcast Alerts** — the Master Admin can push an alert banner to every citizen's dashboard, e.g. for severe weather.
- **OTP-Based Password Recovery & Changes** — a one-time-code flow over email, required even for changing your password while already logged in.
- **Analytics Dashboard** — filterable emergency trends (7/30/90 days) with charts you can click into for details.

## Documentation

| Section | Description |
|---|---|
| [Installation Guide](./docs/setup/installation.md) | Local setup — database, backend, frontend |
| [Environment Variables](./docs/setup/environment.md) | `.env` reference for the backend |
| [Troubleshooting](./docs/setup/troubleshooting.md) | Fixes for common setup issues |
| [Architecture Overview](./docs/architecture/overview.md) | How the system's put together |
| [Database Schema](./docs/architecture/database-schema.md) | Tables, relationships, and an ER diagram |
| [Security Model](./docs/architecture/security.md) | Login, tokens, rate limits |
| [API — Auth](./docs/api/auth.md) | Registration, login, OTP, password endpoints |
| [API — Emergency](./docs/api/emergency.md) | SOS, dispatch, and hazard endpoints |
| [API — Admin](./docs/api/admin.md) | Citizen/dispatcher management, feedback, analytics |
| [Feature Breakdown](./docs/features/overview.md) | Closer look at every feature |
| [Production Deployment](./docs/deployment/production.md) | Docker + nginx/php-fpm + AWS |

## What's Next

1. **Offline Support** — queue SOS requests on the device during an outage and send them automatically once back online.
2. **Push Notifications** — Firebase Cloud Messaging alerts when a responder is on the way.

## License

This project is proprietary and **not open source**. You're welcome to view it and reference it academically with credit — copying, modifying, redistributing, or deploying it isn't allowed without the Author's written permission. Full terms: [LICENSE](./LICENSE).

© 2025 Emmanuel John C. Perez. All rights reserved.
