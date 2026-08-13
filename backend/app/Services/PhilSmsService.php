<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * PhilSmsService — sends OTP/SMS via PhilSMS (dashboard.philsms.com).
 * Drop-in replacement for SemaphoreService: same sendOtp(string, string):
 * bool contract, so AuthController only needed its constructor + property
 * types changed, none of its call sites.
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
     * Send an SMS OTP via PhilSMS.
     * Returns true only when PhilSMS confirms the request succeeded;
     * false on any transport error, timeout, or API-reported failure.
     */
    public function sendOtp(string $phone, string $otp): bool
    {
        // The last line of the SMS must match:  @<origin> #<code>
        // Android's WebOTP API reads this automatically and fills the input
        // without any Contacts permission. iOS QuickType handles OTP natively.
        $origin = parse_url((string) config('app.url'), PHP_URL_HOST) ?? '';
        $hint   = $origin ? "\n@{$origin} #{$otp}" : '';

        $message = "Your MDRRMO San Isidro verification code is: {$otp}. "
                 . "Do not share this with anyone. Valid for 10 minutes.{$hint}";

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

        try {
            $response = Http::withToken($this->apiToken)
                ->timeout(self::TIMEOUT_SECONDS)
                ->post(self::ENDPOINT, [
                    'recipient' => $this->normalizePhone($phone),
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

    /**
     * PhilSMS expects the recipient in international format without a
     * leading "+" (e.g. "639171234567"), matching the confirmed-working
     * test call. Accepts common local formats and normalizes them so
     * callers can keep passing whatever shape is already in the users
     * table (e.g. "09171234567") without every call site re-formatting it.
     */
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '63')) {
            return $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '63' . substr($digits, 1);
        }
        return $digits;
    }
}
