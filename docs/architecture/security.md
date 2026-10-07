# Security Model & Threat Mitigation

Comprehensive documentation of authentication mechanisms, role enforcement, threat protections, and verification pipelines in the SINE MDRRMO platform.

---

## 1. Authentication via Bearer Tokens

All API endpoints are secured via **SHA-256 Hashed Bearer Tokens**. The frontend stores the token in secure client-side storage and passes it via the `Authorization: Bearer <token>` HTTP header on every authenticated request.

### Token Lifecycle
1. **Multi-Device Concurrent Staff Sessions:** Administrative and dispatcher accounts maintain concurrent sessions across native desktop workstations (Tauri) and mobile devices without prematurely invalidating active session tokens.
2. A new token is minted with specific **abilities** tied directly to the user's role:
   - **`admin`**: Granted abilities `["admin", "dispatcher", "citizen"]`
   - **`dispatcher`**: Granted ability `["dispatcher"]`
   - **`citizen`**: Granted ability `["citizen"]`
3. On explicit logout, the current session token is permanently revoked from the database (`personal_access_tokens` table).

---

## 2. Role-Based Token Ability Enforcement

Routes use middleware guards to enforce granular role-based capabilities:

```go
// Admin-only management endpoints
adminRoutes := api.Group("/", middleware.RequireRole("admin"))
adminRoutes.Get("/pending-verifications", adminHandler.GetPendingVerifications)
adminRoutes.Post("/approve-user", adminHandler.ApproveUser)
adminRoutes.Post("/reject-user", adminHandler.RejectUser)
adminRoutes.Get("/citizens", adminHandler.GetCitizens)
adminRoutes.Post("/suspend-citizen", adminHandler.SuspendCitizen)
adminRoutes.Post("/reactivate-citizen", adminHandler.ReactivateCitizen)
adminRoutes.Post("/create-dispatcher", adminHandler.CreateDispatcher)
adminRoutes.Get("/feedback", feedbackHandler.GetFeedback)

// Dispatcher-operational endpoints (Admin tokens pass automatically)
dispatchRoutes := api.Group("/", middleware.RequireRole("dispatcher"))
dispatchRoutes.Post("/dispatch-emergency", dispatchHandler.DispatchEmergency)
dispatchRoutes.Post("/resolve-emergency", dispatchHandler.ResolveEmergency)
dispatchRoutes.Post("/mark-false-alarm", dispatchHandler.MarkFalseAlarm)
dispatchRoutes.Post("/resolve-hazard", hazardHandler.ResolveHazard)
dispatchRoutes.Post("/create-broadcast", broadcastHandler.CreateBroadcast)
dispatchRoutes.Post("/clear-broadcast", broadcastHandler.ClearBroadcast)
```

---

## 3. Account Verification & Lifecycle Security

New citizen registrations start in a two-stage locked state to protect staff from unverified spam submissions:

```
[Citizen Registers]
  ├─ Enters Personal Data & Barangay
  ├─ Live Front ID + Back ID + Selfie with ID
  └─ Sets Password & Valid ID Number (Unique check enforced)
          │
          ▼
  account_status = 'pending_otp'
  (Cannot log in; 403 reason: 'pending_otp'; Hidden from Admin Verification Queue)
          │
          ▼
   [Verifies Email/SMS OTP]
          │
          ▼
  account_status = 'unverified'
  email_verified_at = now()
  (Queued in Admin Dashboard under Pending Verifications)
          │
          ├─────────────────────────────────────────┐
          ▼                                         ▼
   [Admin Reviews ID in Dashboard]            [Admin Rejects ID]
   Approve → account_status = 'active'         Permanent Deletion of User
   Citizen can now log in                      & ID files from storage (Zero residual PII)
```

- **Step 4 Interruption Handling:** If a registrant exits or crashes during OTP verification, their account remains in `pending_otp`. Subsequent logins return HTTP 403 with `reason: 'pending_otp'` and route the user back to complete verification.
- **Valid ID Number Uniqueness:** The system verifies `user_verifications.valid_id_number` against active and pending registrations to prevent duplicate government ID usage.
- **Permanent PII Cleanup on Reject:** `rejectUser` is strictly guarded to target only pending citizen accounts (`role = 'citizen'` with `account_status` in `unverified` or `pending_otp`). Administrative accounts, dispatchers, and active citizens are fully protected from deletion. Rejection resolves the citizen's uploaded documents across configured storage disks and purges the directory before deleting database records.
- **Strict Token Identity Enforcement (Anti-IDOR):** Endpoints behind `auth:sanctum` (`/settings`, `/update-profile-picture`, `/update-password`, `/send-password-change-otp`, `/verify-password-change-otp`, `/submit-sos`, `/cancel-sos`, `/my-emergencies`, `/my-hazards`, `/save-push-token`, `/delete-push-token`, `/feedback`) derive user identity strictly from `$request->user()->user_id` rather than client request bodies.

---

## 4. Anti-Enumeration & Privacy Defenses

To protect citizens' identities and phone numbers from scraping or dictionary attacks:
1. **Generic OTP Responses:** `loginSendOtp`, `forgotPassword`, and `resendRegistrationOtp` return the exact same HTTP 200 message (`"If that account exists, an OTP was sent."`) whether the user exists, is banned, or is rate-capped.
2. **Timing & Throttle Protection:** Rate-limiting blocks return identical status codes on public endpoints so attackers cannot deduce valid usernames or emails.
3. **Zero Plaintext OTP Logging:** Plaintext OTP codes are strictly suppressed from all server application logs (`journalctl`, stdout, and log files).
4. **Cryptographically Secure Media Filenames:** Uploaded government ID photos, profile images, and incident media are named using 16 cryptographically secure random bytes (`crypto/rand` / `random_bytes`), producing 128-bit unguessable filenames that prevent enumeration attacks.

---

## 5. Multi-Channel OTP Security (`OtpService`)

1. **Short-Lived Numeric Codes:** 6-digit codes generated using cryptographically secure random integers, valid for **10 minutes**.
2. **Single-Use Invalidation:** The cached OTP is forgotten immediately upon successful verification.
3. **Resend Cooldown & Hourly Cap:**
   - Minimum 60-second cooldown between resend attempts for the same phone/email.
   - Maximum 5 OTP requests per hour per identifier to stop SMS billing abuse.
4. **Failed Attempt Capping:** OTP codes enforce a maximum threshold of 5 incorrect guesses. Exceeding 5 wrong attempts immediately purges the code from cache to neutralize brute-force guessing.
5. **Multi-Step Password Reset:** Resetting passwords requires both OTP confirmation (`verifyResetOtp`) which sets a 5-minute verified cache token, followed by password submission (`resetPassword`).

---

## 6. Authoritative Geofencing & Anti-Prank Protections

1. **Authoritative Server Geolocation (`BarangayResolver`):**
   - The backend runs ray-casting point-in-polygon math against official San Isidro PSA boundary polygons (`resources/geo/san-isidro-barangays.geojson`). Clients cannot forge their barangay location.
2. **Camera Anti-Prank Restriction:**
   - The citizen app forces live camera capture for both SOS evidence (photo/10s video) and ID proof, preventing users from uploading downloaded or pre-recorded gallery files.
3. **3-Strike False Alarm Moderation:**
   - When a dispatcher marks an incident as a false alarm (`POST /mark-false-alarm`), the citizen receives an incremented strike count. Upon reaching 3 strikes, the account is automatically locked (`account_status = 'banned'`) and all active tokens are revoked.

---

## 7. Rate Limiting Reference

| Endpoint | Throttle Limit | Protection Goal |
|---|---|---|
| `POST /login` | 5 attempts / minute (IP-based) | Brute-force protection |
| `POST /login-send-otp` | 3 requests / minute | SMS gateway cost & spam control |
| `POST /login-verify-otp` | 5 requests / minute | Code guessing prevention |
| `POST /forgot-password` | 3 requests / minute | Account recovery spam |
| `POST /verify-reset-otp` | 5 requests / minute | OTP brute-force defense |
| `POST /submit-sos` | 5 requests / minute (Auth) | Anti-prank flood protection |
| `POST /submit-hazard` | 5 requests / minute (Auth) | Report spam prevention |
