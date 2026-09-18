# API Reference — Emergency, Dispatch & Real-Time Events

Base Path: `/api`  
All endpoints require `auth:sanctum`. Endpoints tagged **[dispatcher]** require the `dispatcher` or `admin` token ability.

---

## 1. One-Tap SOS & Emergency Requests

### 1.1 `POST /api/submit-sos` (Throttled: 5/min)
Submits a high-priority emergency request with live GPS coordinates and camera evidence.

- **Request Body:**
  ```json
  {
    "user_id": 12,
    "incident_type_id": 1,
    "latitude": 15.31124500,
    "longitude": 120.90678900,
    "proof_files": ["data:image/jpeg;base64,...", "data:video/mp4;base64,..."],
    "description": "Structure fire spreading to neighboring house"
  }
  ```
- **Backend Action:** Automatically resolves the authoritative `barangay_id` via `BarangayResolver` and broadcasts `EmergencyUpdated` (`submitted`) on the `emergencies` WebSocket channel.
- **Response (201):** `{ "message": "Emergency SOS sent!", "request_id": 42 }`

---

### 1.2 `POST /api/cancel-sos`
Cancels an active pending emergency if submitted by mistake.
- **Request Body:** `{ "request_id": 42, "user_id": 12 }`
- **Response (200):** `{ "message": "Emergency request cancelled." }`

---

### 1.3 `GET /api/my-emergencies/{user_id}`
Returns the authenticated citizen's personal emergency history.

---

### 1.4 `GET /api/active-emergencies` & `GET /api/archived-emergencies`
Feeds the Operations Dashboard live map and historical archive panels.
- Returns requests with joined citizen names, contact numbers, "Golden Minute" medical profile (blood type, allergies, conditions, PWD), incident category, and proof files.

---

## 2. Dispatcher Operations **[dispatcher]**

### 2.1 `GET /api/dispatch-assets`
Fetches all currently available responder teams (BFP, PNP, Rescue, RHU) and active vehicles.

---

### 2.2 `POST /api/dispatch-emergency`
Assigns a responder unit and matching vehicle to an active incident.
- **Request Body:**
  ```json
  {
    "request_id": 42,
    "responder_id": 1,
    "vehicle_id": 3
  }
  ```
- **Response (200):** `{ "message": "Units dispatched successfully!" }`  
- **Action:** Broadcasts `EmergencyUpdated` (`dispatched`) and sends an FCM push notification to the reporting citizen.

---

### 2.3 `POST /api/resolve-emergency`
Marks an emergency as completed and archives it.
- **Request Body:** `{ "request_id": 42 }`
- **Response (200):** `{ "message": "Emergency resolved and archived." }`

---

### 2.4 `POST /api/mark-false-alarm`
Records a false alarm strike against the reporting citizen.
- **Request Body:** `{ "request_id": 42 }`
- **Response (200):** `{ "message": "Strike 1 recorded. 2 more will result in automatic suspension.", "false_alarm_strikes": 1 }`
- **Rule:** If strikes reach 3, the account is automatically banned and tokens revoked.

---

## 3. Public Road Hazards

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/submit-hazard` | Authenticated | Submits road hazard (floods, fallen trees, downed wires) with GPS & photo |
| `GET` | `/api/active-hazards` | Authenticated | Retrieves all currently active hazards for map overlay |
| `POST` | `/api/resolve-hazard` | **[dispatcher]** | Acknowledges and clears a hazard report |

---

## 4. Barangay-Targeted Broadcast Alerts

### 4.1 `POST /api/create-broadcast` **[dispatcher]**
Pushes an emergency alert banner town-wide or to specific barangays, queues it for future scheduled release, or saves it as a draft for later review.

- **Request Body:**
  ```json
  {
    "broadcast_id": 8,
    "title": "Severe Flash Flood Advisory",
    "message": "Water levels rising near riverbanks in Tabon and Pulo. Evacuate if necessary.",
    "barangay_ids": [9, 6],
    "media_files": ["data:image/jpeg;base64,..."],
    "scheduled_at": "2026-09-18T08:00:00.000Z",
    "is_draft": false
  }
  ```
  - `broadcast_id` *(optional)*: Pass the ID when updating a previously saved draft or publishing it.
  - `is_draft` *(optional)*: Set to `true` to save the announcement as a draft without sending push notifications or alerting citizens.
  - `scheduled_at` *(optional)*: Date/time for automated future release.
  - `barangay_ids` *(optional)*: Array of target barangay IDs. Leave empty or omit for town-wide alerts.
- **Response (200):**
  ```json
  {
    "message": "Broadcast pushed to Tabon, Pulo!",
    "broadcast_id": 8
  }
  ```

---

### 4.2 `GET /api/active-broadcast`
Retrieves broadcast alerts based on user role:
- **Citizens:** Returns active alerts whose scheduled time has arrived or was immediate. Scoped to town-wide alerts and the citizen's registered barangay. Drafts are never returned.
- **Dispatchers / Admins:** Returns an object containing `drafts`, `active`, `scheduled`, and `archived` arrays.

- **Response for Admin / Dispatcher (200):**
  ```json
  {
    "drafts": [
      {
        "broadcast_id": 12,
        "title": "Draft Evacuation Notice",
        "message": "Draft advisory content...",
        "media_files": [],
        "is_active": 0,
        "is_draft": 1,
        "created_at": "2026-09-18 16:00:00",
        "scope": "barangay",
        "location": "Poblacion",
        "barangay_ids": [1]
      }
    ],
    "active": [],
    "scheduled": [],
    "archived": []
  }
  ```

---

### 4.3 `POST /api/clear-broadcast` **[dispatcher]**
Stops and archives an active broadcast alert, removing it from citizen devices. If called on a draft, permanently removes the draft.
- **Request Body:** `{ "broadcast_id": 8 }`

---

### 4.4 `POST /api/delete-draft` **[dispatcher]**
Permanently discards a saved draft announcement.
- **Request Body:** `{ "broadcast_id": 12 }`
- **Response (200):** `{ "message": "Draft announcement discarded." }`

---

## 5. Analytics & Trends

### 5.1 `GET /api/analytics?days=7`
Provides statistical breakdowns for Chart.js dashboard visualizations (7, 30, or 90 days).

- **Payload Contents:**
  - `daily_stats`: Incident counts per day broken down by type (Fire, Flood, Medical, Crime, Others)
  - `type_stats`: Aggregate count per incident type
  - `barangay_stats`: Incident volume per barangay
  - `hazard_stats`: Active/resolved hazard breakdown by category
  - `hazard_daily_stats`: Daily trend of hazard reports
  - `hazard_barangay_stats`: Hazard distribution across barangays
  - `recent_records`: Recent emergency incident history

---

## 6. Real-Time WebSocket Events Reference (Laravel Reverb)

The client subscribes to public Reverb channels using **Laravel Echo**:

| Channel | Event Name | Payload | Trigger Event |
|---|---|---|---|
| **`emergencies`** | `.EmergencyUpdated` | `{"action": "submitted"\|"dispatched"\|"resolved"\|"cancelled"\|"false_alarm", "request_id": 42}` | Any change to active SOS requests |
| **`hazards`** | `.HazardUpdated` | `{"action": "submitted"\|"resolved", "hazard_id": 15}` | Hazard reported or acknowledged |
| **`broadcasts`** | `.BroadcastMessageUpdated` | `{"action": "created"\|"cleared"\|"draft_saved"\|"deleted", "broadcast_id": 8}` | Admin alert banner added, removed, or draft updated |
| **`users`** | `.UserVerified` | `{"action": "approved"\|"rejected"\|"suspended"\|"reinstated", "user_id": 12}` | Citizen verification state modified |
