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
        $this->senderName = config('services.semaphore.sender', 'SINE-MDRRMO');
    }

    /**
     * Send an SMS OTP via Semaphore.
     * Returns true on success, false on failure.
     */
    public function sendOtp(string $phone, string $otp): bool
    {
        $message = "Your SINE MDRRMO verification code is: {$otp}. Do not share this with anyone.";

        $response = Http::post('https://api.semaphore.co/api/v4/messages', [
            'apikey'      => $this->apiKey,
            'number'      => $phone,
            'message'     => $message,
            'sendername'  => $this->senderName,
        ]);

        return $response->successful();
    }
}