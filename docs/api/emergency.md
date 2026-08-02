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

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `GET` | `/active-broadcast` | `BroadcastController@getActiveBroadcast` | Current alert banner, if any |
| `POST` | `/create-broadcast` | `BroadcastController@createBroadcast` | **[dispatcher]** |
| `POST` | `/clear-broadcast` | `BroadcastController@clearBroadcast` | **[dispatcher]** |

## Analytics

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `GET` | `/analytics` | `AnalyticsController@getAnalytics` | Emergency trends, filterable by 7/30/90-day windows |

## Related

- [Database Schema](../architecture/database-schema.md) — `emergency_requests`, `hazards`, `dispatch`, `broadcasts` tables
- [API — Admin](./admin.md)
