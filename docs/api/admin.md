# API Reference — Administrative & Management

Base Path: `/api`  
All endpoints require `auth:sanctum`. Endpoints marked **[admin]** require the `admin` token ability.

---

## 1. Citizen Verification & Moderation **[admin]**

### 1.1 `GET /api/pending-verifications`
Retrieves all citizen registrations awaiting identity approval. Returns full registration records including URLs for `valid_id_proof` (Front), `valid_id_proof_back` (Back), and `selfie_with_id_proof`.

---

### 1.2 `POST /api/approve-user`
Approves a citizen's registration, enabling account login.
- **Request Body:** `{ "user_id": 12 }`
- **Actions Triggered:**
  1. Sets `account_status = 'active'`.
  2. Broadcasts `UserVerified` (`approved`) on the `users` WebSocket channel.
  3. Sends an automated Welcome Email and FCM Push Notification to the citizen.
- **Response (200):** `{ "message": "User approved successfully.", "user": {...} }`

---

### 1.3 `POST /api/reject-user`
Rejects a fraudulent or invalid registration.
- **Request Body:** `{ "user_id": 12 }`
- **Actions Triggered:** Permanently deletes the user record and purges all uploaded ID and selfie files from storage.

---

### 1.4 `GET /api/citizens`
Returns a searchable and filterable list of all registered citizens.
- **Query Parameters:** `?search=juan&status=active`

---

### 1.5 `POST /api/suspend-citizen` & `POST /api/reactivate-citizen`
- **Suspend:** `{ "user_id": 12, "reason": "Repeated false emergency filings" }`  
  Sets `account_status = 'banned'` and invalidates all active Sanctum tokens.
- **Reactivate:** `{ "user_id": 12 }`  
  Lifts the suspension and restores `account_status = 'active'`.

---

## 2. Dispatcher Account Management **[admin]**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dispatchers` | Lists all dispatcher staff accounts |
| `POST` | `/api/create-dispatcher` | Creates a new dispatcher account with username, email, phone, and password |
| `POST` | `/api/update-dispatcher` | Updates a dispatcher's contact information |
| `POST` | `/api/deactivate-dispatcher` | Deactivates a dispatcher's account and revokes their active tokens |

---

## 3. Citizen Feedback Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/feedback` | Any Authenticated User | Citizen submits feedback (`message`, `category: general\|bug\|suggestion\|other`) |
| `GET` | `/api/feedback` | **[admin]** | Retrieves full list of submitted citizen feedback with sender details |
| `POST` | `/api/feedback/clear` | **[admin]** | Clears all stored feedback records |
| `GET` | `/api/feedback/export` | **[admin]** | Downloads feedback archive as a formatted JSON file |

---

## 4. Self-Service Profile & Settings (All Roles)

### 4.1 `POST /api/update-profile-picture`
Uploads a new avatar image (PNG/JPEG base64 string, max 5 MB).

---

### 4.2 `POST /api/update-medical-profile`
Saves pre-configured "Golden Minute" medical data attached automatically to future SOS submissions:
- **Request Body:**
  ```json
  {
    "user_id": 12,
    "blood_type": "O+",
    "allergies": "Penicillin, Aspirin",
    "medical_conditions": "Asthma",
    "pwd_status": "None"
  }
  ```

---

### 4.3 `POST /api/save-push-token` & `POST /api/delete-push-token`
- **Save Token:** Registers an FCM device token on login/permission grant:
  `{ "user_id": 12, "token": "fcm_token_...", "platform": "android"|"ios" }`
- **Delete Token:** Unregisters the current device token on logout so logged-out devices stop receiving alerts.

---

### 4.4 `GET /api/settings/{user_id}` & `POST /api/settings`
Retrieves or updates user preferences key-value pairs (`dark_mode`, `reduce_animations`, `location_auto_fetch`, `map_default_style`, `notif_emergency_alerts`, `notif_broadcast_alerts`, `save_media_to_device`).
