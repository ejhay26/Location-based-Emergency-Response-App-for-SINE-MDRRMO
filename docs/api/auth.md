# API Reference — Auth

Base path: `/api`. See [Security Model](../architecture/security.md) for the token/OTP flow this reference assumes.

## No Login Needed

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/register` | `AuthController@register` | Creates a citizen account |
| `POST` | `/login` | `AuthController@login` | Returns a Sanctum token on success |
| `POST` | `/login-send-otp` | `AuthController@loginSendOtp` | Throttled: 3/min |
| `POST` | `/login-verify-otp` | `AuthController@loginVerifyOtp` | Throttled: 5/min |
| `POST` | `/verify-otp` | `AuthController@verifyOtp` | Registration OTP check |
| `GET` | `/check-username` | `AuthController@checkUsername` | Availability check |
| `GET` | `/check-email` | `AuthController@checkEmail` | Availability check |
| `POST` | `/forgot-password` | `AuthController@forgotPassword` | Throttled: 3/min |
| `POST` | `/reset-password` | `AuthController@resetPassword` | Finishes the password reset via OTP |

## Login Required (`auth:sanctum`)

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/logout` | `AuthController@logout` | Revokes the current token |
| `POST` | `/update-password` | `PasswordController@updatePassword` | Needs OTP verification first (see below) |
| `POST` | `/send-password-change-otp` | `PasswordController@sendPasswordChangeOtp` | Step 1 of changing password while logged in |
| `POST` | `/verify-password-change-otp` | `PasswordController@verifyPasswordChangeOtp` | Step 2 — must pass before `/update-password` works |

<details>
<summary><b>Password change flow, step by step</b></summary>

```
send-password-change-otp → (email) → verify-password-change-otp → update-password
```

This applies even if you're already logged in, so a stolen or active session alone isn't enough to change someone's password.

</details>

## Related

- [Security Model](../architecture/security.md)
- [API — Emergency](./emergency.md)
- [API — Admin](./admin.md)
