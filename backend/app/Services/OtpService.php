<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * OtpService — single source of truth for generating, storing, and
 * verifying one-time codes cached under a caller-supplied key.
 *
 * Behavior is intentionally identical to the inline logic it replaces:
 * 4-digit numeric code, 10-minute default TTL, loose (==) comparison,
 * and the cache entry is forgotten immediately after a successful verify.
 */
class OtpService
{
    /**
     * Per-identifier (not per-IP) abuse limits, independent of the
     * existing route-level throttle:N,1 middleware (which only limits by
     * IP). Two limits, both keyed off the same OTP cache key so they
     * automatically scope per email/phone/user_id/purpose:
     *   - RESEND_COOLDOWN_SECONDS: minimum gap between two requests for the
     *     same identifier, so re-requesting doesn't silently overwrite a
     *     code that's still in flight.
     *   - MAX_REQUESTS_PER_HOUR: a rolling-hour hard cap so the cooldown
     *     can't be ground through by waiting it out repeatedly.
     */
    private const RESEND_COOLDOWN_SECONDS = 60;
    private const MAX_REQUESTS_PER_HOUR   = 5;

    /**
     * Generate a new 6-digit OTP and cache it under $key for $minutes.
     * Returns the generated code so the caller can send it (email/SMS).
     *
     * NOTE: this does NOT enforce the abuse limits below — it's kept as a
     * plain, unconditional primitive for internal use (requestOtp() below
     * calls it only after its own cooldown/cap check has already passed).
     * Prefer requestOtp() at call sites; only reach for this directly if a
     * new use case truly needs an unthrottled code (none currently do).
     */
    public function generateAndStore(string $key, int $minutes = 10): int
    {
        $otp = random_int(100000, 999999);
        Cache::put($key, $otp, now()->addMinutes($minutes));
        return $otp;
    }

    /**
     * Rate-limited entry point: checks the per-identifier cooldown + hourly
     * cap for $key, and only if both pass does it generate+store a new OTP
     * and record the request. Returns:
     *   - ['otp' => int]                                   on success
     *   - ['blocked' => 'cooldown', 'retry_after' => int]   still within
     *     the resend cooldown from the last request
     *   - ['blocked' => 'cap']                              hourly cap for
     *     this identifier has been hit
     *
     * How callers should handle a 'blocked' result depends on whether the
     * endpoint is anonymous (pre-auth) or already-authenticated:
     *   - Anonymous, identifier-lookup endpoints (AuthController's
     *     loginSendOtp/forgotPassword/resendRegistrationOtp) MUST return
     *     the exact same response for 'blocked' as for a real send — no
     *     distinct status/message/retry_after — otherwise the difference
     *     becomes an account-enumeration oracle. See the comment on
     *     AuthController::forgotPassword() for the full rationale.
     *   - Authenticated endpoints (PasswordController::sendPasswordChangeOtp)
     *     have no anonymous identity to protect, so they're free to return
     *     a real 429 with the specific message + retry_after.
     */
    public function requestOtp(string $key, int $minutes = 10): array
    {
        $cooldownKey = $key . ':cooldown_until';
        $countKey    = $key . ':req_count';

        $cooldownUntil = Cache::get($cooldownKey);
        if ($cooldownUntil !== null && $cooldownUntil > time()) {
            return ['blocked' => 'cooldown', 'retry_after' => $cooldownUntil - time()];
        }

        $count = (int) Cache::get($countKey, 0);
        if ($count >= self::MAX_REQUESTS_PER_HOUR) {
            return ['blocked' => 'cap'];
        }

        Cache::put($cooldownKey, time() + self::RESEND_COOLDOWN_SECONDS, self::RESEND_COOLDOWN_SECONDS);
        Cache::put($countKey, $count + 1, now()->addHour());

        return ['otp' => $this->generateAndStore($key, $minutes)];
    }

    /**
     * Verify a submitted code against the cached one for $key.
     * On success, the cache entry is forgotten (single use) and true is returned.
     * On failure, the cache entry is left untouched and false is returned.
     */
    public function verify(string $key, mixed $submitted): bool
    {
        $cached = Cache::get($key);
        if ($cached !== null && $cached == $submitted) {
            Cache::forget($key);
            return true;
        }
        return false;
    }

    /** Explicitly clear a pending OTP for $key (e.g. after it's no longer needed). */
    public function forget(string $key): void
    {
        Cache::forget($key);
    }
}
