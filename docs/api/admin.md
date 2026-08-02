# API Reference — Admin

Base path: `/api`. All endpoints below require `auth:sanctum` **and** the `admin` token ability, except Profile/Settings/Feedback-submission which only require `auth:sanctum` (any authenticated role). See [Security Model](../architecture/security.md).

## Citizen & Verification Management **[admin]**

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `GET` | `/pending-verifications` | `CitizenController@getPendingVerifications` | New registrations awaiting ID verification |
| `POST` | `/approve-user` | `CitizenController@approveUser` | |
| `POST` | `/reject-user` | `CitizenController@rejectUser` | |
| `GET` | `/citizens` | `CitizenController@getCitizens` | |
| `POST` | `/suspend-citizen` | `CitizenController@suspendCitizen` | |
| `POST` | `/reactivate-citizen` | `CitizenController@reactivateCitizen` | |

## Dispatcher Account Management **[admin]**

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/create-dispatcher` | `DispatcherController@createDispatcher` | |
| `GET` | `/dispatchers` | `DispatcherController@getDispatchers` | |
| `POST` | `/update-dispatcher` | `DispatcherController@updateDispatcher` | |
| `POST` | `/deactivate-dispatcher` | `DispatcherController@deactivateDispatcher` | |

## Feedback

| Method | Endpoint | Controller | Access | Notes |
|---|---|---|---|---|
| `POST` | `/feedback` | `FeedbackController@store` | any authenticated user | Citizen submits feedback |
| `GET` | `/feedback` | `FeedbackController@index` | **[admin]** | |
| `POST` | `/feedback/clear` | `FeedbackController@clear` | **[admin]** | |
| `GET` | `/feedback/export` | `FeedbackController@export` | **[admin]** | |

## Profile & Settings (any authenticated user)

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/update-profile-picture` | `ProfileController@updateProfilePicture` | |
| `POST` | `/update-medical-profile` | `ProfileController@updateMedicalProfile` | "Golden Minute" data — blood type, allergies, conditions, PWD status |
| `POST` | `/save-push-token` | `ProfileController@savePushToken` | Registers an FCM device token |
| `GET` | `/settings/{user_id}` | `UserSettingsController@get` | |
| `POST` | `/settings` | `UserSettingsController@set` | |

## Related

- [Database Schema](../architecture/database-schema.md) — `users`, `feedback`, `device_tokens`, `user_settings`
- [API — Auth](./auth.md)
- [API — Emergency](./emergency.md)
