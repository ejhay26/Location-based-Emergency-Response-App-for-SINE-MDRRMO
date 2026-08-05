# Security Model

## Logging In

Auth uses **Laravel Sanctum** with tokens — no server-side session/cookie auth for the API. Every protected request needs a bearer token, sent after login.

Endpoints that don't need a token: registration, login, OTP checks, username/email availability checks, forgot/reset password, and the verification-status check described below. Everything else needs `auth:sanctum`.

## New Accounts Start Locked (Pending Verification)

A new citizen registration doesn't get a token or a working login right away. `AuthController::register()` creates the account with `account_status = 'unverified'`, and `login()` / `loginSendOtp()` both reject unverified accounts with a **403** until an admin approves the citizen's submitted ID from the ID Verifications panel (`approveUser` → `active`). Rejecting an ID (`rejectUser`) doesn't ban the account — it **permanently deletes** it, ID/selfie files included, so there's no "rejected but recoverable" state.

Since a pending account has no token, checking on approval status can't go through an authenticated route. `POST /check-verification-status` (public, throttled) exists for exactly this — it takes just an email and returns a bare `{ "status": "unverified" | "active" | "banned" | "not_found" }`, nothing else about the account. The app's Pending Verification screen polls this every 20–30 seconds after registration (or after a login attempt on a still-pending account) rather than opening a WebSocket connection for it — the screen isn't time-critical enough to justify running a broadcast server just for this, unlike the live emergency map.

## Token Abilities (how roles are enforced)

When someone logs in, their Sanctum token comes with abilities matching their role:

| Role | Token abilities |
|---|---|
| Citizen | `['citizen']` |
| Dispatcher | `['dispatcher']` |
| Admin | `['admin', 'dispatcher', 'citizen']` |

Routes in `routes/api.php` are grouped and locked accordingly:

```php
Route::middleware('ability:admin')->group(function () {
    // citizen/dispatcher account management, feedback moderation, etc.
});

Route::middleware('ability:dispatcher')->group(function () {
    // dispatch-emergency, resolve-emergency, resolve-hazard, broadcasts, etc.
});
```

Since admin tokens also carry `dispatcher` and `citizen`, an admin can still hit dispatcher-only routes. But a dispatcher token doesn't have `admin`, so it gets a **403** on admin-only routes instead of slipping through. That was a deliberate fix — earlier, dispatcher/citizen tokens could reach some admin-only routes by mistake.

Worth noting: none of the citizen-facing routes (`submit-sos`, `active-broadcast`, `update-medical-profile`, etc.) are actually gated by an `ability:citizen` middleware today — they only require `auth:sanctum`. So a dispatcher's `['dispatcher']`-only token can technically still call them, since nothing currently checks for the `citizen` ability specifically. This hasn't caused a problem in practice (dispatchers have no reason to call citizen routes), but it's worth knowing if you're auditing what a given token can actually reach.

## OTP Flows

An OTP (one-time code, emailed via `OtpService`) is required for a few sensitive actions:

- Login (optional step: `login-send-otp` → `login-verify-otp`)
- Registration (`verify-otp`)
- Password reset (`forgot-password` → `reset-password`)
- **Password change while already logged in** (`send-password-change-otp` → `verify-password-change-otp` → `update-password`) — even a logged-in user has to re-verify by email before changing their password, so a stolen or hijacked session can't just take over the account.

## Rate Limits

A few endpoints that are easy to abuse are throttled:

| Endpoint | Limit |
|---|---|
| `login-send-otp` | 3 requests / minute |
| `login-verify-otp` | 5 requests / minute |
| `forgot-password` | 3 requests / minute |
| `submit-sos` | 5 requests / minute |
| `submit-hazard` | 5 requests / minute |

The SOS/hazard limits are there specifically to slow down spam or prank floods, on top of the photo-verification requirement itself.

## Anti-Prank Verification

SOS submissions need a live camera photo/video taken right at submission (not something picked from the gallery), plus device GPS. That makes it a lot harder to fake an emergency compared to just filling out a form. Confirmed false alarms bump up `users.false_alarm_strikes`, which can feed into account moderation (`suspend-citizen` / `reactivate-citizen`).

## Read-Only Feed Endpoints

`active-emergencies`, `active-hazards`, `active-broadcast`, `dispatch-assets`, `analytics`, and `archived-emergencies` all still need `auth:sanctum` — none of them are public. There's no offline/pre-login screen that calls them, so the client always has a valid token by the time it needs them.

## Notes for Contributors

- Never loosen an `ability:` requirement just to make something work faster — if a dispatcher-only action also needs to be reachable by admins, that's already handled since admin tokens include `dispatcher`.
- Any new endpoint that accepts user-submitted media (photos/videos) should follow the same throttle + validation pattern as `submit-sos` / `submit-hazard` — not a bare, unthrottled route.
- Unrelated but worth noting: see [Database Schema — Seed Data](./database-schema.md#seed-data) about the current data dump containing real credentials/tokens that shouldn't ship in a public repo.
