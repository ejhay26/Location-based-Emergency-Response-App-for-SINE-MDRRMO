# Feature Breakdown

A closer look at each core feature. For endpoints and tables, see [API Reference](../api/auth.md) and [Database Schema](../architecture/database-schema.md).

## Role-Based Dashboards

Three different experiences from one codebase: the **citizen app**, the **dispatcher dashboard**, and the **admin dashboard** (same as the dispatcher view, plus account/verification management). Enforced by [Sanctum token abilities](../architecture/security.md#token-abilities-how-roles-are-enforced) on the backend and route guards on the frontend.

## One-Tap SOS + Anti-Prank Check

A citizen sends an SOS with a single tap. The app grabs GPS coordinates and forces a **live camera photo/video** (not a gallery pick) as proof, before the request even reaches the backend (`POST /submit-sos`, throttled to 5/min). That makes it a lot harder to file a fake emergency than just filling out a form.

## Live Map with Boundary Lock

The admin/dispatcher dashboard map (Leaflet.js) uses **real boundary shapes** (GeoJSON, checked with a ray-casting method) to keep the camera view and pin placement inside San Isidro's actual town borders — not just a rough rectangle. So a pin can't land outside the area MDRRMO actually covers.

## Real-Time Dispatch Updates

The dashboard checks `GET /active-emergencies`, `/active-hazards`, and `/active-broadcast` in the background and drops pins the moment a new emergency or hazard shows up — no manual refresh needed.

## Smart Unit Assignment

`GET /dispatch-assets` returns available responders with their assigned vehicles as linked dropdowns, so picking "Fire Department" only shows fire vehicles, "RHU" only shows ambulances, and so on. See the `responders` ↔ `vehicles` relationship in [Database Schema](../architecture/database-schema.md).

## "Golden Minute" Medical Profile

Citizens can optionally save blood type, allergies, medical conditions, and PWD status to their profile (`POST /update-medical-profile`). This gets attached to their SOS automatically, so responders can bring the right gear (allergy-aware meds, mobility equipment, etc.) before they even arrive — the "golden minute" being that critical early window in an emergency.

## Hazard Reporting

Residents report road hazards (floods, fallen trees, broken roads) with photo proof and GPS (`POST /submit-hazard`). These show up as warning pins on the dashboard map, so dispatchers can route responder vehicles around them instead of into them.

## Public Broadcast Alerts

The Master Admin can push a broadcast message (`POST /create-broadcast`) that shows up as an alert banner on every citizen's dashboard — used for things like severe weather warnings or other town-wide notices.

## Profile & Password Management

- Base64 profile picture uploads
- Password changes gated by OTP even while logged in (see [Security Model](../architecture/security.md#otp-flows))
- Password strength enforced with regex rules

## Analytics Dashboard

`GET /analytics` powers the Chart.js charts — line/bar trends and doughnut charts — filterable by 7/30/90-day windows. Clicking a chart segment filters the emergency list to match, so an admin can go from a trend straight to the incidents behind it.

## OTP-Based Account Recovery

Forgotten passwords are reset through a fully OTP-based flow (`forgot-password` → `reset-password`) that doesn't rely on the server remembering a session — good for a mobile-first app where someone might be resetting their password from a different device than the one they registered on.

## Push Notifications (Firebase)

Device tokens are registered via `POST /save-push-token` and stored per user (`device_tokens` table — one user can have several, across devices/reinstalls), feeding the notification pipeline (`FirebasePushService`, `NotificationService`).
