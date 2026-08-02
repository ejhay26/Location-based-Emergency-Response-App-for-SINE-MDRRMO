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
     * Generate a new 4-digit OTP and cache it under $key for $minutes.
     * Returns the generated code so the caller can send it (email/SMS).
     */
    public function generateAndStore(string $key, int $minutes = 10): int
    {
        $otp = rand(1000, 9999);
        Cache::put($key, $otp, now()->addMinutes($minutes));
        return $otp;
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
