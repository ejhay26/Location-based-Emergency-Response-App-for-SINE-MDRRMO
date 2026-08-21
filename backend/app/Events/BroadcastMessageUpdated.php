<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever admin broadcast alerts change:
 *   - A new broadcast message is pushed by an admin/dispatcher
 *   - A broadcast message is cleared/deactivated
 *
 * Broadcasts on the public channel `broadcasts`.
 * Citizens and admin dashboards re-fetch /active-broadcast on receipt.
 * Named BroadcastMessageUpdated (not BroadcastUpdated) to avoid collision
 * with Laravel's own internal Broadcast facade namespace.
 */
class BroadcastMessageUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $action,      // 'created' | 'cleared'
        public readonly int    $broadcastId,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('broadcasts');
    }

    public function broadcastAs(): string
    {
        return 'BroadcastMessageUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'action'       => $this->action,
            'broadcast_id' => $this->broadcastId,
        ];
    }
}
