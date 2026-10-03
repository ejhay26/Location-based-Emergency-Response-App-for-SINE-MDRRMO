<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Support\PhoneNumber;

/**
 * PhilSmsService — sends OTP/SMS via PhilSMS (dashboard.philsms.com).
 * Drop-in replacement for SemaphoreService: same sendOtp(...): bool
 * contract, so callers only needed their constructor + property types
 * changed, none of their call sites' control flow.
 *
 * API reference (v3, confirmed working against the live endpoint):
 *   POST https://dashboard.philsms.com/api/v3/sms/send
 *   Auth: Bearer token (Authorization header), NOT an API-key query param
 *   Body: { recipient, sender_id, type: "plain", message }
 *   Success shape: { "status": "success", "data": { "status": "Delivered", ... } }
 *   Failure shape: PhilSMS returns non-2xx OR { "status": "error", ... } —
 *   both are treated as failure here.
 */
class PhilSmsService
{
    private const ENDPOINT = 'https://dashboard.philsms.com/api/v3/sms/send';

    /** Seconds to wait for PhilSMS before giving up — an OTP request must
     *  not hang the HTTP worker indefinitely if PhilSMS is slow/down. */
    private const TIMEOUT_SECONDS = 10;

    private string $apiToken;
    private string $senderName;

    public function __construct()
    {
        $this->apiToken   = (string) config('services.philsms.token');
        $this->senderName = (string) config('services.philsms.sender', 'PhilSMS');
    }

    /**
     * Send an SMS OTP via PhilSMS, explicitly stating what it's FOR.
     *
     * $purpose is a short, human-readable phrase describing why this code
     * was sent — e.g. "account registration", "logging in", "resetting
     * your password", "changing your password". Every call site MUST pass
     * one; there is no default, because a generic "your code is 1234" is
     * exactly what this was changed away from — a citizen who requested a
     * password reset and one who's just logging in both need to be able to
     * tell, from the SMS alone, which action they're confirming, and
     * anyone who DIDN'T request anything needs to immediately understand
     * that from the message too (see the "if you didn't request this"
     * line below).
     *
     * Returns true only when PhilSMS confirms the request succeeded;
     * false on any transport error, timeout, or API-reported failure.
     */
    public function sendOtp(string $phone, string $otp, string $purpose): bool
    {
        // No special format required in the message body — unlike the old
        // WebOTP approach, Android's SMS User Consent API (via
        // @capawesome/capacitor-android-sms-retriever on the frontend) reads
        // any code out of the message text itself via regex once the user
        // taps the one-tap consent dialog. The API's hard constraints:
        // message must stay under 140 bytes total, and the sender must not
        // be in the user's contacts (true here — transactional SMS gateway).
        // Kept intentionally short: the original longer wording measured
        // 151 characters with the longest $purpose value
        // ("resetting your password"), which would silently fail to trigger
        // the consent dialog.
        $message = "MDRRMO San Isidro: code for {$purpose}: {$otp}. "
                 . "Valid 10 min. Didn't request this? Ignore this message.";

        return $this->send($phone, $message);
    }

    /**
     * Send an arbitrary plain-text SMS via PhilSMS (broadcasts, alerts,
     * anything beyond OTPs). Kept separate from sendOtp() so callers that
     * just need "send this text" don't have to fake an OTP value.
     */
    public function send(string $phone, string $message): bool
    {
        if ($this->apiToken === '') {
            Log::error('PhilSmsService: PHILSMS_API_TOKEN is not configured — refusing to send.');
            return false;
        }

        $recipient = PhoneNumber::normalize($phone);
        if ($recipient === null) {
            // Every write path in this app (AuthController, DispatcherController)
            // already normalizes before saving, so hitting this in practice
            // means either a pre-migration DB row nobody's normalized yet,
            // or a caller passed something that was never a real PH mobile
            // number. Either way, sending PhilSMS a malformed recipient
            // would just fail on their end with a less useful error.
            Log::error('PhilSmsService: could not normalize phone number, refusing to send.', ['raw' => $phone]);
            return false;
        }

        try {
            $response = Http::withToken($this->apiToken)
                ->timeout(self::TIMEOUT_SECONDS)
                ->post(self::ENDPOINT, [
                    'recipient' => $recipient,
                    'sender_id' => $this->senderName,
                    'type'      => 'plain',
                    'message'   => $message,
                ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('PhilSmsService: connection error sending SMS.', ['error' => $e->getMessage()]);
            return false;
        }

        if (!$response->successful()) {
            Log::error('PhilSmsService: PhilSMS API returned an error.', [
                'status' => $response->status(),
                'body'   => $response->json() ?? $response->body(),
            ]);
            return false;
        }

        $status = $response->json('status');
        if ($status !== 'success') {
            Log::warning('PhilSmsService: PhilSMS responded 2xx but status was not "success".', [
                'body' => $response->json(),
            ]);
            return false;
        }

        return true;
    }
}
