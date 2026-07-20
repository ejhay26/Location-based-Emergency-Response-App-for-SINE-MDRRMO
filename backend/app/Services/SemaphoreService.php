<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class SemaphoreService
{
    private string $apiKey;
    private string $senderName;

    public function __construct()
    {
        $this->apiKey     = config('services.semaphore.key');
        $this->senderName = config('services.semaphore.sender', 'MDRRMO San Isidro');
    }

    /**
     * Send an SMS OTP via Semaphore.
     * Returns true on success, false on failure.
     */
    public function sendOtp(string $phone, string $otp): bool
    {
        // The last line of the SMS must match:  @<origin> #<code>
        // Android's WebOTP API reads this automatically and fills the input
        // without any Contacts permission. iOS QuickType handles OTP natively.
        // APP_URL in .env should be your ngrok/production domain, e.g.
        //   APP_URL=https://interbranchial-angella-nonteleologically.ngrok-free.app
        $origin  = parse_url(config('app.url'), PHP_URL_HOST) ?? '';
        $hint    = $origin ? "\n@{$origin} #{$otp}" : '';

        $message = "Your MDRRMO San Isidro verification code is: {$otp}. "
                 . "Do not share this with anyone. Valid for 10 minutes.{$hint}";

        $response = Http::post('https://api.semaphore.co/api/v4/messages', [
            'apikey'      => $this->apiKey,
            'number'      => $phone,
            'message'     => $message,
            'sendername'  => $this->senderName,
        ]);

        return $response->successful();
    }
}