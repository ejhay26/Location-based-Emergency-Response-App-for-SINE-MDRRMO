<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirebasePushService
{
    private function getAccessToken(): string
    {
        $client = new GoogleClient();
        $client->setAuthConfig(base_path(config('services.firebase.credentials')));
        $client->addScope('https://www.googleapis.com/auth/firebase.messaging');
        $client->refreshTokenWithAssertion();
        return $client->getAccessToken()['access_token'];
    }

    /**
     * Send to one or multiple device tokens.
     * Automatically batches if multiple tokens are provided.
     */
    public function send(array $tokens, string $title, string $body, array $data = []): void
    {
        if (empty($tokens)) return;

        $projectId   = config('services.firebase.project_id');
        $accessToken = $this->getAccessToken();
        $url         = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        // FCM V1 sends one message at a time per token
        // For broadcast (many tokens), loop — or use a topic subscription
        foreach ($tokens as $token) {
            $payload = [
                'message' => [
                    'token'        => $token,
                    'notification' => [
                        'title' => $title,
                        'body'  => $body,
                    ],
                    'android' => [
                        'priority'     => 'high',
                        'notification' => ['sound' => 'default'],
                    ],
                    'apns' => [
                        'payload' => ['aps' => ['sound' => 'default']],
                    ],
                    'data' => array_map('strval', $data), // FCM data must be strings
                ]
            ];

            try {
                Http::withToken($accessToken)
                    ->post($url, $payload);
            } catch (\Exception $e) {
                Log::error('FCM send failed: ' . $e->getMessage());
            }
        }
    }
}