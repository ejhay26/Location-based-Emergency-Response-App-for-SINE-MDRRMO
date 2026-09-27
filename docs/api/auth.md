# API Reference — Authentication & Accounts

Base Path: `/api`  
Security: Laravel Sanctum (`Bearer <token>`)

---

## 1. Public Authentication Endpoints (No Token Required)

### 1.1 `GET /api/health`
Lightweight health probe endpoint.
- **Response (200):**
  ```json
  { "status": "ok", "timestamp": "2026-08-21T16:00:00.000000Z" }
  ```

---

### 1.2 `POST /api/register` (Throttled: 5/min)
Creates a new citizen registration in `pending_otp` status and triggers an initial OTP verification code.
*Note: Government `valid_id_number` must be unique across all active or pending accounts.*

- **Request Body (JSON):**
  | Field | Type | Required | Description |
  |---|---|---|---|
  | `first_name` | string | Yes | Citizen first name |
  | `last_name` | string | Yes | Citizen surname |
  | `phone` | string | Yes | Philippine mobile number (`09...` or `+639...`) |
  | `birthdate` | string (YYYY-MM-DD) | Yes | Citizen date of birth |
  | `username` | string | Yes | Unique handle (3–20 chars, alphanumeric, dots, and underscores allowed: `^[a-zA-Z0-9._]+$`) |
  | `email` | string | Yes | Unique email address |
  | `password` | string | Yes | Strong password (8+ chars, uppercase, lowercase, digit, symbol) |
  | `barangay_id` | integer | Yes | ID of resident barangay (1–9) |
  | `valid_id_type` | string (enum) | Yes | Whitelisted Philippine ID: `Philippine National ID (PhilSys)`, `Driver's License`, `Philippine Passport`, `UMID / SSS ID`, `Postal ID`, `PRC License`, `Voter's ID`, `Senior Citizen ID`, `PWD ID`, `Barangay ID` |
  | `valid_id_number` | string | Yes | Formatted government ID number (unique) |
  | `valid_id_expiry` | string (YYYY-MM-DD) | Optional | ID Expiration Date (required for Driver's License, Passport, Postal, PRC) |
  | `valid_id_details` | object / JSON | Optional | Extra metadata (e.g. `{ "profession": "..." }`) |
  | `valid_id_image` | string (base64) | Yes | Front of Valid Government ID |
  | `valid_id_image_back`| string (base64) | Yes | Back of Valid Government ID |
  | `selfie_with_id_image`| string (base64) | Yes | Live selfie holding the ID card |
  | `otp_channel` | string (`email` \| `sms`) | No | Preferred channel for verification code (default: `email`) |

- **Response (200):**
  ```json
  { "message": "Verification code sent." }
  ```

---

### 1.3 `POST /api/login`
Authenticates a citizen, dispatcher, or admin using username/email and password.

- **Request Body:** `{ "login": "username_or_email", "password": "secret_password" }`
- **Response (200):**
  ```json
  {
    "message": "Login successful",
    "token": "1|abcdef123456...",
    "role": "citizen",
    "user": { "user_id": 12, "first_name": "Juan", "role": "citizen", "setup_completed": false }
  }
  ```
- **Error (403 Forbidden):**
  - **Pending OTP:** `{ "message": "Please verify the OTP code sent to your email to complete registration.", "reason": "pending_otp", "email": "user@example.com" }`
  - **Pending Admin Review:** `{ "message": "Your account registration is currently pending admin verification review.", "reason": "unverified" }`
  - **Suspended:** `{ "message": "This account has been suspended.", "reason": "banned" }`

---

### 1.4 `POST /api/login-send-otp` (Throttled: 3/min)
Sends a passwordless login code via Email or PhilSMS.

- **Request Body:**
  ```json
  {
    "otp_channel": "phone",
    "phone": "09171234567"
  }
  ```
  *(Or `{"otp_channel": "email", "email": "user@example.com"}`)*
- **Response (200):** `{ "message": "If that account exists, an OTP was sent." }`

---

### 1.5 `POST /api/login-verify-otp` (Throttled: 5/min)
Verifies the passwordless login code and issues a Sanctum token.

- **Request Body:**
  ```json
  {
    "otp_channel": "phone",
    "phone": "09171234567",
    "otp": "4812"
  }
  ```
- **Response (200):** Returns Sanctum token, user object, and role.

---

### 1.6 `POST /api/verify-otp` (Throttled: 10/min)
Confirms the OTP received during registration. Transitions `account_status` from `pending_otp` to `unverified` (queueing the application for admin review) and stamps `email_verified_at = now()`.

- **Request Body:** `{ "email": "user@example.com", "otp": "1234" }`
- **Response (200):** `{ "message": "Verification successful. Your account is now pending admin verification.", "user": {...}, "role": "citizen" }`

---

### 1.7 Public Check Endpoints
- `GET /api/check-username?username=...` (Throttled: 20/min)
- `GET /api/check-email?email=...` (Throttled: 20/min)
- `POST /api/check-verification-status` (Throttled: 10/min)
- `POST /api/reset-password` (Throttled: 5/min)

---

## 2. Authenticated Account & Profile Endpoints (`auth:sanctum`)
*Note: All endpoints below derive user identity authoritatively from the Sanctum bearer token (`$request->user()->user_id`). Passing foreign user IDs in the request body is rejected or ignored to prevent IDOR vulnerabilities.*

- `POST /api/send-password-change-otp`: Sends password-change OTP to authenticated user's email/phone.
- `POST /api/verify-password-change-otp`: Verifies OTP for the authenticated session.
- `POST /api/update-password`: Sets new password following verified OTP confirmation.
- `POST /api/update-profile-picture`: Updates authenticated user's avatar.
- `POST /api/update-medical-profile`: Updates medical/blood type/PWD details.
- `POST /api/complete-account-setup`: Marks first-time onboarding tour as completed.
- `POST /api/save-push-token`: Registers device FCM token bound to authenticated user.
- `POST /api/delete-push-token`: Revokes device token on logout.
- `GET /api/settings`: Returns personalized app settings for authenticated user.
- `POST /api/settings`: Persists setting key/value pairs for authenticated user.

---

### 1.7 `POST /api/resend-registration-otp` (Throttled: 3/min)
Resends the registration OTP for an unverified account.

- **Request Body:** `{ "email": "user@example.com", "otp_channel": "email" }`
- **Response (200):** `{ "message": "If a pending registration exists, a new code was sent." }`

---

### 1.8 `POST /api/check-verification-status` (Throttled: 10/min)
Tokenless endpoint polled by the Pending Verification screen.

- **Request Body:** `{ "login": "user@example.com" }` (or `{ "email": "..." }`)
- **Response (200):** `{ "status": "unverified" | "active" | "banned" | "not_found" }`

---

### 1.9 `GET /api/check-username` & `GET /api/check-email`
Live availability checkers during registration.
- `GET /api/check-username?username=juan26` → `{ "available": true }`
- `GET /api/check-email?email=juan@gmail.com` → `{ "available": true }`

---

### 1.10 Password Recovery Flow
1. **`POST /api/forgot-password` (3/min):**  
   Body: `{"otp_channel": "email"|"phone", "email": "...", "phone": "..."}`  
   Response: `{ "message": "If an account exists, an OTP was sent." }`
2. **`POST /api/verify-reset-otp` (5/min):**  
   Body: `{"otp_channel": "email"|"phone", "email": "...", "phone": "...", "otp": "1234"}`  
   Response: `{ "message": "OTP verified." }`
3. **`POST /api/reset-password`:**  
   Body: `{"otp_channel": "...", "email": "...", "phone": "...", "new_password": "NewSecurePassword123!"}`  
   Response: `{ "message": "Password reset successfully!" }`

---

## 2. Authenticated Account Endpoints (`auth:sanctum`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/logout` | Revokes current Sanctum token |
| `POST` | `/api/complete-account-setup` | Marks the initial post-approval onboarding wizard completed |
| `POST` | `/api/send-password-change-otp` | Sends an OTP to verify identity before changing password while logged in |
| `POST` | `/api/verify-password-change-otp` | Validates the password change OTP |
| `POST` | `/api/update-password` | Commits the new password after OTP verification |
