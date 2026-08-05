# Feature Breakdown

A closer look at each core feature, from a technical/implementation angle. For step-by-step usage instructions instead, see the [Citizen Guide](../guides/citizen-guide.md), [Dispatcher Guide](../guides/dispatcher-guide.md), or [Admin Guide](../guides/admin-guide.md). For endpoints and tables, see [API Reference](../api/auth.md) and [Database Schema](../architecture/database-schema.md).

## Role-Based Dashboards

Three different experiences from one codebase: the **citizen app**, the **dispatcher dashboard**, and the **admin dashboard** (same as the dispatcher view, plus account/verification management). Enforced by [Sanctum token abilities](../architecture/security.md#token-abilities-how-roles-are-enforced) on the backend and route guards on the frontend.

## Registration & ID Verification

Registering takes two steps: account details, then a live photo of a valid ID plus a selfie holding it (`POST /register`). After an email OTP confirms the address (`POST /verify-otp`), the account exists but is marked `unverified` and **can't log in yet** — it lands on a Pending Verification screen instead, which checks in on its status every 20–30 seconds (`POST /check-verification-status`). An admin reviews the submitted ID/selfie from the ID Verifications panel and either approves it (account becomes usable) or rejects it (account and uploaded files are deleted outright, not banned). See [API — Auth](../api/auth.md#no-login-needed) and [Security Model](../architecture/security.md#new-accounts-start-locked-pending-verification) for the full flow.

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

## Barangay-Targeted Broadcast Alerts

The Master Admin can push a broadcast message (`POST /create-broadcast`) either **town-wide** or scoped to specific **barangays** by passing `barangay_ids`. Citizens only see alerts that apply to them (town-wide alerts, plus anything targeted at their own barangay); admins/dispatchers see every active alert regardless of scope. Multiple broadcasts can be active at the same time — e.g. a town-wide weather alert alongside a barangay-specific flood warning — and each is cleared individually (`POST /clear-broadcast` with a `broadcast_id`). See [API — Broadcasts](../api/emergency.md#broadcasts) for the request/response shape.

## Profile & Password Management

- Base64 profile picture uploads
- Password changes gated by OTP even while logged in (see [Security Model](../architecture/security.md#otp-flows))
- Password strength enforced with regex rules

## Analytics Dashboard

`GET /analytics` powers the Chart.js charts — line/bar trends and doughnut charts — filterable by 7/30/90-day windows. Clicking a chart segment filters the emergency list to match, so an admin can go from a trend straight to the incidents behind it.

## OTP-Based Account Recovery

Forgotten passwords are reset through a fully OTP-based flow (`forgot-password` → `reset-password`) that doesn't rely on the server remembering a session — good for a mobile-first app where someone might be resetting their password from a different device than the one they registered on.

## Push Notifications (Firebase)

Device tokens are registered via `POST /save-push-token` when a citizen grants push permission on the Profile page, and removed via `POST /delete-push-token` on logout so a signed-out device stops receiving alerts. Tokens are stored per user (`device_tokens` table — one user can have several, across devices/reinstalls), feeding the notification pipeline (`FirebasePushService`, `NotificationService`). This currently powers broadcast alert delivery; per-dispatch status pushes (e.g. "a responder is on the way") are on the roadmap — see the README's "What's Next" section.

## Search & Filter on Admin Panels

Every admin list — Citizens, Dispatchers, ID Verifications, Log Archive, and Analytics — shares the same two components instead of a bespoke filter UI per panel:

- **`DateRangeFilterComponent`** — a single popover with three modes (one day, several days, or a start/end range), all sharing one calendar so switching modes never leaves stale picks behind.
- **`FilterSummaryBarComponent`** — a small bar showing which filters are currently active, so it's clear at a glance why a list looks the way it does.

The Citizens panel additionally filters by barangay. Because these are shared components, a fix or improvement made in one place (like the calendar-navigation bugs ironed out during development) applies to every panel that uses it.

## Guided Onboarding Tour

A first-run walkthrough (`TourOverlayComponent`, shared across the app) that highlights key parts of the interface for new users — covers the general pattern used for onboarding rather than a page-by-page manual.
