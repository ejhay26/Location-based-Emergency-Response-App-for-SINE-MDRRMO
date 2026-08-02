<?php

namespace App\Services;

use App\Models\DeviceToken;

/**
 * NotificationService — push-notification fan-out for a single user or
 * for all citizens. Extracted from EmergencyController so both the
 * emergency and dispatch flows share one code path.
 *
 * Behavior is identical to the private methods it replaces: same
 * device_tokens lookup, same join for the "all citizens" case, same
 * no-op when there are no tokens to send to.
 */
class NotificationService
{
    public function __construct(private FirebasePushService $push)
    {
    }

    public function notifyUser(int $userId, string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::where('user_id', $userId)->pluck('token')->toArray();
        if (!empty($tokens)) {
            $this->push->send($tokens, $title, $body, $data);
        }
    }

    public function notifyAllCitizens(string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::query()
            ->join('users', 'device_tokens.user_id', '=', 'users.user_id')
            ->where('users.role', 'citizen')
            ->pluck('device_tokens.token')->toArray();
        if (!empty($tokens)) {
            $this->push->send($tokens, $title, $body, $data);
        }
    }
}
