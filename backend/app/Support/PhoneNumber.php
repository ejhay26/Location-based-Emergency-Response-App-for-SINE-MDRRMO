<?php

namespace App\Support;

/**
 * Canonical Philippine mobile number handling. Every phone number in this
 * app is stored, looked up, and sent to PhilSMS in ONE format:
 * "63XXXXXXXXXX" (63 + 10 digits, no +, no spaces, no dashes) — e.g.
 * "639171234567". This is exactly what PhilSMS's API expects (see the
 * confirmed-working test call in PhilSmsService), so normalizing once here
 * means every other layer can just trust the DB value is already correct.
 *
 * WHY a single shared class instead of normalizing inline everywhere:
 * this app has at least 6 places that read or write a phone number
 * (registration, dispatcher create/update, 4 separate OTP lookup points
 * in AuthController). If each one reimplements "strip a leading 0" with
 * slightly different regex, they will eventually drift and silently stop
 * matching each other — which is exactly the bug this class exists to
 * prevent. Every call site MUST go through here, never hand-roll its own
 * stripping logic again.
 */
final class PhoneNumber
{
    /**
     * Normalizes any of these common input shapes to "63XXXXXXXXXX":
     *   "09171234567"    11 digits, local format, leading 0
     *   "9171234567"     10 digits, no prefix at all
     *   "+639171234567"  E.164 with a leading +
     *   "639171234567"   already canonical
     *   any of the above with spaces or dashes mixed in
     *
     * Returns null if the input can't be confidently interpreted as a
     * valid PH mobile number. Callers MUST check for null rather than
     * trusting a passthrough value — silently accepting an unrecognized
     * shape is exactly how a raw "0994..." ends up stored un-normalized
     * and every later lookup against it starts silently failing.
     */
    public static function normalize(?string $raw): ?string
    {
        if ($raw === null || trim($raw) === '') return null;

        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        // Already 12 digits starting with "63" — canonical shape already.
        if (strlen($digits) === 12 && str_starts_with($digits, '63')) {
            return self::isValidMobileSuffix($digits) ? $digits : null;
        }

        // 11 digits starting with "0" — standard local format "09XXXXXXXXX".
        if (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $candidate = '63' . substr($digits, 1);
            return self::isValidMobileSuffix($candidate) ? $candidate : null;
        }

        // 10 digits with no prefix at all — "9XXXXXXXXX".
        if (strlen($digits) === 10 && str_starts_with($digits, '9')) {
            $candidate = '63' . $digits;
            return self::isValidMobileSuffix($candidate) ? $candidate : null;
        }

        return null;
    }

    /** After the "63" country-code prefix, a real PH mobile number's next digit is always 9. */
    private static function isValidMobileSuffix(string $canonical): bool
    {
        return strlen($canonical) === 12 && $canonical[2] === '9';
    }
}
