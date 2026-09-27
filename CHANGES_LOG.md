# SINE MDRRMO — Comprehensive Changes & Audit Log

**Date:** September 27, 2026  
**Target Environment:** Local Workspace & DigitalOcean Droplet (`159.223.42.159`)  
**Deployment Container:** `mdrrmo_backend` (Podman)  

---

## 1. Backend Security & Access Control (Anti-IDOR)

| File | Changes Made | Rationale |
| :--- | :--- | :--- |
| `backend/app/Http/Controllers/Auth/PasswordController.php` | Replaced `$request->user_id` with `$request->user()->user_id` in `sendPasswordChangeOtp`, `verifyPasswordChangeOtp`, and `updatePassword`. Made request `user_id` optional. | **Critical Security Fix (IDOR):** Prevented any authenticated user from requesting password reset OTPs or overwriting passwords for arbitrary accounts. |
| `backend/app/Http/Controllers/ProfileController.php` | Replaced `$request->user_id` with `$request->user()->user_id` in `updateProfilePicture`, `updateMedicalProfile`, `completeAccountSetup`, and `savePushToken`. Added ownership verification to `deletePushToken`. | **Critical Security Fix (IDOR):** Prevented users from modifying other citizens' profile pictures, medical records, onboarding states, or deleting other devices' push tokens. |
| `backend/app/Http/Controllers/UserSettingsController.php` | Enforced caller authorization in `get` and `set`. Citizens can only view and update their own settings. Admin/dispatcher override maintained for staff support. | **Critical Security Fix (IDOR):** Blocked cross-user inspection and modification of user app preferences. |
| `backend/app/Http/Controllers/Emergency/SosController.php` | Made `user_id` optional in validation for `submitSos`. Replaced route/request `user_id` with authenticated user context. Enforced that citizens can only inspect (`getMyEmergencies`) and cancel (`cancelEmergency`) their own emergency records. | **Life-Safety Authorization Fix:** Prevented unauthorized spoofing of emergency requests, viewing another citizen's active SOS logs, or cancelling another citizen's pending emergency. |
| `backend/app/Http/Controllers/Emergency/HazardController.php` | Made `user_id` optional in validation for `submitHazard` and derived submitter identity directly from Sanctum token. | **Data Integrity Fix:** Eliminated requirement for client to supply `user_id` on authenticated route. |
| `backend/app/Http/Controllers/FeedbackController.php` | Derived `user_id` strictly from `$request->user()->user_id` in `store()`, making request body `user_id` optional. | **Security Fix (IDOR):** Prevented feedback submissions from spoofing other citizen identities. |

---

## 2. Account Lifecycle & Registration Step 4 Trap Resolution

| File | Changes Made | Rationale |
| :--- | :--- | :--- |
| `backend/database/migrations/2026_09_27_000001_update_account_status_and_email_verified.php` | Extended `users.account_status` enum to `['pending_otp', 'unverified', 'active', 'banned']` and added nullable `email_verified_at` timestamp. | Enables a distinct initial lifecycle state for accounts awaiting email OTP verification before they are placed in the admin review queue. |
| `backend/app/Http/Controllers/Auth/AuthController.php` | 1. **Duplicate ID Check:** Validates `valid_id_number` against `user_verifications` to prevent reuse of government IDs across active or pending registrations.<br>2. **Account Guard:** Prevents deleting or overwriting accounts with status `active`, `banned`, or `unverified`.<br>3. **Safe Stale Pruning:** Only prunes abandoned `pending_otp` sessions and purges their uploaded files from storage.<br>4. **Initial Status:** Sets `account_status = 'pending_otp'` upon registration.<br>5. **Status Promotion:** In `verifyOtp`, transitions `account_status` to `'unverified'` and stamps `email_verified_at = now()`.<br>6. **Login Handling:** Returns HTTP 403 with `reason: 'pending_otp'` and email. | **Architectural & Security Fix:** Solves the Step 4 exit flaw where unverified users were exposed to admins prematurely. Protects legitimate pending applicants from being wiped out by new registration attempts. |
| `backend/app/Http/Controllers/Admin/CitizenController.php` | In `rejectUser`, properly eager-loads `['profile', 'verification', 'medicalProfile']`, resolves the username and image paths, and purges the entire directory across configured storage disks (`config('filesystems.default')` and public fallback) before deleting the user and child records. | **Privacy / PII Compliance Fix:** Fixed bug where non-existent `$user->valid_id_proof` caused file deletion to be skipped entirely, leaving sensitive government ID photos orphaned in storage. |
| `frontend/src/app/features/auth/login/login.page.ts` | Added handler for `err.error?.reason === 'pending_otp'` on 403 login response to guide the citizen back to registration Step 4 with their email prefilled. | **UX Fix:** Replaced false "Your account has been suspended" message with guidance to complete email verification. |

---

## 3. Route Rate Limiting & Throttling

| Endpoint | Throttle Added |
| :--- | :--- |
| `POST /api/register` | `throttle:5,1` (5 attempts / minute) |
| `POST /api/verify-otp` | `throttle:10,1` (10 attempts / minute) |
| `GET /api/check-username` | `throttle:20,1` (20 requests / minute) |
| `GET /api/check-email` | `throttle:20,1` (20 requests / minute) |
| `POST /api/reset-password` | `throttle:5,1` (5 attempts / minute) |
| `POST /api/feedback` | `throttle:10,1` (10 submissions / minute) |

---

## 4. Documentation Audited & Synchronized

- **`docs/architecture/security.md`:** Documented the two-stage registration lifecycle (`pending_otp` → `unverified` → `active`), unique ID number enforcement, verified PII file deletion on rejection, and anti-IDOR Sanctum rules.
- **`docs/api/auth.md`:** Updated endpoint parameters, throttles, 403 `pending_otp` response payloads, and token-derived user identity for authenticated endpoints.
- **`docs/api/emergency.md`:** Documented anti-IDOR protections on emergency submission, cancellation, and retrieval.

---

## 5. Remote VPS Deployment (`159.223.42.159`)

- Connected to host via OpenSSH.
- Executed `git pull origin main` in `/var/www/mdrrmo-backend` (Commit `7b8ba65`).
- Synced migration batch registry and executed `2026_09_27_000001_update_account_status_and_email_verified.php` inside `mdrrmo_backend`.
- Cleared Laravel config, route, view, and event bootstrap caches (`php artisan optimize:clear`).
- Restarted `mdrrmo_backend` container.
- Verified live endpoint: `GET http://localhost/api/health` returned HTTP 200 OK.

---

## 6. Frontend2 Rebuilt with React Native (Spitting Image of Ionic)

- **Storage Conservation (Drive G:):**
  - Deleted old Flutter build cache and dart artifacts, freeing up space on `C:`.
  - Created NTFS junction `frontend2\node_modules` pointing directly to `G:\react_native_workspace\frontend2_modules`.
  - Configured global npm cache to `G:\react_native_workspace\npm_cache`.
- **UI/UX & Components Created:**
  - `CustomTitleBar.tsx`: Custom desktop titlebar with draggable region, live status indicator, and desktop window controls.
  - `theme/colors.ts`: Full SINE MDRRMO design tokens (Emergency Red `#D32F2F`, OLED pure black `#000000`, card borders, glassmorphic elevation).
  - `SosButton.tsx`: Pulsing animated SOS button with concentric ripple waves matching Ionic.
  - `CustomTabBar.tsx`: 4-tab bottom navigation (Home, Report, History, Profile) with active indicators and badges.
  - `CustomDialog.tsx`: iOS-style confirmation and alert dialogs.
  - `LoginScreen.tsx`: Complete login interface with `pending_otp` redirection.
  - `RegisterScreen.tsx`: 4-step registration wizard (Personal → Barangay → Valid ID & Live Selfie → OTP).
  - `PendingVerificationScreen.tsx`: Verification card with real-time polling and status review.
  - `HomeScreen.tsx`: Citizen dashboard with quick SOS categories, active emergency banner, and broadcast ticker.
  - `ReportHazardScreen.tsx`: Hazard reporting screen with GPS coordinates and proof photo upload.
  - `EmergencyHistoryScreen.tsx`: Filterable emergency logs with cancellation modal.
  - `ProfileScreen.tsx`: Golden Minute medical profile (blood type, allergies, PWD status) and dark mode switch.
  - `App.tsx`: Central coordinator managing authentication state and tab navigation.
