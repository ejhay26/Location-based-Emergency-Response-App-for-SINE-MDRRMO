# API Reference — Auth

Base path: `/api`. See [Security Model](../architecture/security.md) for the token/OTP flow this reference assumes.

## No Login Needed

| Method | Endpoint | Controller | Notes |
|---|---|---|---|
| `POST` | `/register` | `AuthController@register` | Creates a citizen account |
| `POST` | `/login` | `AuthController@login` | Returns a Sanctum token on success |
| `POST` | `/login-send-otp` | `AuthController@loginSendOtp` | Throttled: 3/min |
| `POST` | `/login-verify-otp` | `AuthController@loginVerifyOtp` | Throttled: 5/min |
| `POST` | `/verify-otp` | `AuthController@verifyOtp` | Registration OTP check. Doesn't return a token — the account is still `unverified` at this point (see below) |
| `POST` | `/check-verification-status` | `AuthController@checkVerificationStatus` | Throttled: 10/min. Body: `email`. Returns `{ "status": "unverified" \| "active" \| "banned" \| "not_found" }` — nothing else. Polled by the Pending Verification screen |
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

<details>
<summary><b>Registration → login flow, step by step</b></summary>

```
register → (email OTP) → verify-otp → Pending Verification screen
                                          ↓ (polls check-verification-status every 20–30s)
                              still unverified ─────────▶ keeps waiting
                              approved (active) ──────▶ login (issues a token)
                              rejected ─────────────▶ account no longer exists
```

A newly registered citizen can't actually use the app until an admin approves their submitted ID — see [Security Model — New Accounts Start Locked](../architecture/security.md#new-accounts-start-locked-pending-verification).

</details>

## Related

- [Security Model](../architecture/security.md)
- [API — Emergency](./emergency.md)
- [API — Admin](./admin.md)
