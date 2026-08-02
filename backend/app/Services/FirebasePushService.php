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
     *
     * $tokens is an array of ['token' => string, 'platform' => 'android'|'ios'].
     *
     * Payload shape is intentionally different per platform:
     * - iOS keeps the standard `notification` block (system auto-displays it)
     *   plus `apns.payload.aps.category`, which is what tells the OS to show
     *   the "Got it" action registered natively in AppDelegate.swift.
     * - Android is sent DATA-ONLY (no top-level `notification` key). A
     *   `notification`-block message on Android is auto-displayed by the OS
     *   with no way to attach custom actions; going data-only guarantees our
     *   own MdrrmoMessagingService.onMessageReceived() always runs and builds
     *   the notification itself, with the "Got it" action button.
     */
    public function send(array $tokens, string $title, string $body, array $data = []): void
    {
        if (empty($tokens)) return;

        $projectId   = config('services.firebase.project_id');
        $accessToken = $this->getAccessToken();
        $url         = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $stringData  = array_map('strval', $data); // FCM data values must be strings

        // FCM V1 sends one message at a time per token.
        foreach ($tokens as $entry) {
            $token    = $entry['token'];
            $platform = $entry['platform'] ?? 'android';

            $message = $platform === 'ios'
                ? [
                    'token'        => $token,
                    'notification' => ['title' => $title, 'body' => $body],
                    'apns'         => [
                        'payload' => [
                            'aps' => ['sound' => 'default', 'category' => 'MDRRMO_ALERT'],
                        ],
                    ],
                    'data' => $stringData,
                ]
                : [
                    'token'   => $token,
                    'android' => ['priority' => 'high'],
                    'data'    => array_merge($stringData, ['title' => $title, 'body' => $body]),
                ];

            try {
                Http::withToken($accessToken)
                    ->post($url, ['message' => $message]);
            } catch (\Exception $e) {
                Log::error('FCM send failed: ' . $e->getMessage());
            }
        }
    }
}