<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever a citizen account's verification status changes:
 *   - Approved (pending → active)
 *   - Rejected (pending → rejected)
 *   - Suspended / reinstated (active ↔ banned)
 *
 * Broadcasts on the public channel `users` so:
 *   - VerificationsPanel refreshes its queue in real-time when another
 *     admin approves/rejects an application in a parallel session.
 *   - CitizensPanel refreshes when a suspension/reinstatement happens.
 *   - PendingVerificationPage detects its own approval without polling.
 *
 * No sensitive payload — listeners re-fetch via authenticated REST on receipt.
 */
class UserVerified implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $action,  // 'approved' | 'rejected' | 'suspended' | 'reinstated'
        public readonly int    $userId,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('users');
    }

    public function broadcastAs(): string
    {
        return 'UserVerified';
    }

    public function broadcastWith(): array
    {
        return [
            'action'  => $this->action,
            'user_id' => $this->userId,
        ];
    }
}
