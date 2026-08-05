# API Reference — Emergency

Base path: `/api`. Everything below needs `auth:sanctum`; anything marked **[dispatcher]** also needs the `dispatcher` token ability (admins pass automatically — see [Security Model](../architecture/security.md)).

## SOS (Emergency Requests)

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/submit-sos` | `SosController@submitSos` | Throttled: 5/min. Needs live GPS + camera capture |
| `POST` | `/cancel-sos` | `SosController@cancelEmergency` | Citizen cancels their own active request |
| `GET` | `/my-emergencies/{user_id}` | `SosController@getMyEmergencies` | Citizen's own SOS history |
| `GET` | `/active-emergencies` | `SosController@getActiveEmergencies` | Feed for the admin/dispatcher dashboard map |
| `GET` | `/archived-emergencies` | `SosController@getArchivedEmergencies` | Resolved/closed history |

## Dispatch **[dispatcher]**

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/dispatch-emergency` | `DispatchController@dispatchEmergency` | Assigns a responder + vehicle to an emergency |
| `POST` | `/resolve-emergency` | `DispatchController@resolveEmergency` | Marks an emergency resolved |
| `POST` | `/mark-false-alarm` | `DispatchController@markFalseAlarm` | Bumps up the reporting user's `false_alarm_strikes` |
| `GET` | `/dispatch-assets` | `DispatchController@getDispatchAssets` | Available responders/vehicles to assign |

## Hazards

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/submit-hazard` | `HazardController@submitHazard` | Throttled: 5/min |
| `GET` | `/active-hazards` | `HazardController@getActiveHazards` | Feed for the admin/dispatcher dashboard map |
| `POST` | `/resolve-hazard` | `HazardController@resolveHazard` | **[dispatcher]** |

## Broadcasts

A broadcast can be **town-wide** or scoped to one or more **barangays** (see `broadcast_barangays` in [Database Schema](../architecture/database-schema.md)). Multiple broadcasts can be active at once, mixing town-wide and barangay-scoped alerts — each one is cleared individually.

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `GET` | `/active-broadcast` | `BroadcastController@getActiveBroadcast` | Returns a **list** of currently active broadcasts, not just one. Citizens only get town-wide alerts plus ones targeted at their own barangay; admins/dispatchers see everything active |
| `POST` | `/create-broadcast` | `BroadcastController@createBroadcast` | **[dispatcher]**. Body: `message` (required), `barangay_ids` (optional array — omit or leave empty for town-wide) |
| `POST` | `/clear-broadcast` | `BroadcastController@clearBroadcast` | **[dispatcher]**. Body: `broadcast_id` (required) — clears that specific broadcast, not "the" broadcast |

<details>
<summary><b>What <code>GET /active-broadcast</code> returns</b></summary>

Each item in the list includes a computed `scope` (`'town'` or `'barangay'`) and a human-readable `location` (`'Town-wide'` or a comma-joined list of barangay names), plus the raw `barangay_ids` if the frontend needs them:

```json
[
  {
    "broadcast_id": 8,
    "message": "Flooding reported",
    "is_active": 1,
    "created_at": "2026-08-02 06:48:27",
    "scope": "barangay",
    "location": "Tabon, Pulo",
    "barangay_ids": [9, 6]
  }
]
```

</details>

## Analytics

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `GET` | `/analytics` | `AnalyticsController@getAnalytics` | Emergency trends, filterable by 7/30/90-day windows |

## Related

- [Database Schema](../architecture/database-schema.md) — `emergency_requests`, `hazards`, `dispatch`, `broadcasts` tables
- [API — Admin](./admin.md)
