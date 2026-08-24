# Security Model & Threat Mitigation

Comprehensive documentation of authentication mechanisms, role enforcement, threat protections, and verification pipelines in the SINE MDRRMO platform.

---

## 1. Authentication via Laravel Sanctum

All API endpoints are secured via **Laravel Sanctum Bearer Tokens**. The frontend stores the token in secure client-side storage and passes it via the `Authorization: Bearer <token>` HTTP header on every authenticated request.

### Token Lifecycle
1. On successful login (either password-based or verified OTP), all prior tokens for that user are revoked.
2. A new plain-text token is minted with specific **abilities** tied directly to the user's role:
   - **`admin`**: Granted abilities `['admin', 'dispatcher', 'citizen']`
   - **`dispatcher`**: Granted ability `['dispatcher']`
   - **`citizen`**: Granted ability `['citizen']`
3. On logout, the token is permanently destroyed from the database (`personal_access_tokens` table).

---

## 2. Role-Based Token Ability Enforcement

Routes in `routes/api.php` use Sanctum's `ability:` middleware to guard sensitive administrative and dispatch actions:

```php
// Admin-only management routes
Route::middleware('ability:admin')->group(function () {
    Route::get('/pending-verifications',  [CitizenController::class, 'getPendingVerifications']);
    Route::post('/approve-user',          [CitizenController::class, 'approveUser']);
    Route::post('/reject-user',           [CitizenController::class, 'rejectUser']);
    Route::get('/citizens',               [CitizenController::class, 'getCitizens']);
    Route::post('/suspend-citizen',       [CitizenController::class, 'suspendCitizen']);
    Route::post('/reactivate-citizen',    [CitizenController::class, 'reactivateCitizen']);
    Route::post('/create-dispatcher',     [DispatcherController::class, 'createDispatcher']);
    Route::get('/feedback',               [FeedbackController::class, 'index']);
});

// Dispatcher-operational routes (Admin tokens pass automatically)
Route::middleware('ability:dispatcher')->group(function () {
    Route::post('/dispatch-emergency',    [DispatchController::class, 'dispatchEmergency']);
    Route::post('/resolve-emergency',     [DispatchController::class, 'resolveEmergency']);
    Route::post('/mark-false-alarm',      [DispatchController::class, 'markFalseAlarm']);
    Route::post('/resolve-hazard',        [HazardController::class, 'resolveHazard']);
    Route::post('/create-broadcast',      [BroadcastController::class, 'createBroadcast']);
    Route::post('/clear-broadcast',       [BroadcastController::class, 'clearBroadcast']);
});
```

---

## 3. Account Verification & Lifecycle Security

New citizen registrations start in a locked state to prevent unauthorized system usage:

```
[Citizen Registers]
  ├─ Enters Personal Data
  ├─ Live Front ID + Back ID + Selfie with ID
  └─ Verifies Email/SMS OTP
          │
          ▼
  account_status = 'unverified'
  (Cannot log in; Token is NOT issued)
          │
          ├─────────────────────────────────────────┐
          ▼                                         ▼
   [Admin Reviews ID in Dashboard]            [Admin Rejects ID]
   Approve → account_status = 'active'         Permanent Deletion of User
   Citizen can now log in                      & ID files (No residual PII)
```

- **Status Polling & WebSocket:** The pending verification screen listens to real-time `UserVerified` events on the public `users` channel, while concurrently checking `POST /check-verification-status` (public, throttled to 10/min) every 25 seconds.

---

## 4. Anti-Enumeration & Privacy Defenses

To protect citizens' identities and phone numbers from scraping or dictionary attacks:
1. **Generic OTP Responses:** `loginSendOtp`, `forgotPassword`, and `resendRegistrationOtp` return the exact same HTTP 200 message (`"If that account exists, an OTP was sent."`) whether the user exists, is banned, or is rate-capped.
2. **Timing & Throttle Protection:** Rate-limiting blocks return identical status codes on public endpoints so attackers cannot deduce valid usernames or emails.

---

## 5. Multi-Channel OTP Security (`OtpService`)

1. **Short-Lived Numeric Codes:** 6-digit codes generated using cryptographically secure random integers, valid for **10 minutes**.
2. **Single-Use Invalidation:** The cached OTP is forgotten immediately upon successful verification.
3. **Resend Cooldown & Hourly Cap:**
   - Minimum 60-second cooldown between resend attempts for the same phone/email.
   - Maximum 5 OTP requests per hour per identifier to stop SMS billing abuse.
4. **Multi-Step Password Reset:** Resetting passwords requires both OTP confirmation (`verifyResetOtp`) which sets a 5-minute verified cache token, followed by password submission (`resetPassword`).

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
