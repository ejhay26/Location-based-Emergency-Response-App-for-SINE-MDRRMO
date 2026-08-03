<?php

namespace App\Services;

use App\Models\DeviceToken;

/**
 * NotificationService — push-notification fan-out for a single user or
 * for all citizens. Extracted from EmergencyController so both the
 * emergency and dispatch flows share one code path.
 *
 * Fetches both `token` and `platform` per device (not just the token) so
 * FirebasePushService can send a platform-specific payload shape — Android
 * gets a data-only message so its own MessagingService can attach a "Got it"
 * action button; iOS keeps the standard notification block. Same underlying
 * device_tokens lookup and "all citizens" join as before, same no-op when
 * there are no tokens to send to.
 */
class NotificationService
{
    public function __construct(private FirebasePushService $push)
    {
    }

    public function notifyUser(int $userId, string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::where('user_id', $userId)->get(['token', 'platform'])->toArray();
        if (!empty($tokens)) {
            $this->push->send($tokens, $title, $body, $data);
        }
    }

    public function notifyAllCitizens(string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::query()
            ->join('users', 'device_tokens.user_id', '=', 'users.user_id')
            ->where('users.role', 'citizen')
            ->get(['device_tokens.token', 'device_tokens.platform'])->toArray();
        if (!empty($tokens)) {
            $this->push->send($tokens, $title, $body, $data);
        }
    }

    /**
     * Same as notifyAllCitizens() but scoped to citizens whose barangay_id
     * is in $barangayIds — used for barangay-targeted broadcasts.
     */
    public function notifyCitizensInBarangays(array $barangayIds, string $title, string $body, array $data = []): void
    {
        if (empty($barangayIds)) return;

        $tokens = DeviceToken::query()
            ->join('users', 'device_tokens.user_id', '=', 'users.user_id')
            ->where('users.role', 'citizen')
            ->whereIn('users.barangay_id', $barangayIds)
            ->get(['device_tokens.token', 'device_tokens.platform'])->toArray();
        if (!empty($tokens)) {
            $this->push->send($tokens, $title, $body, $data);
        }
    }
}
