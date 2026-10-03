<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever the active hazards list changes:
 *   - A new hazard is submitted by a citizen
 *   - A hazard is resolved/acknowledged by an admin
 *
 * Broadcasts on the public channel `hazards`.
 * No sensitive payload — listeners re-fetch via REST on receipt.
 */
class HazardUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $action,   // 'submitted' | 'resolved'
        public readonly int    $hazardId,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('hazards');
    }

    public function broadcastAs(): string
    {
        return 'HazardUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'action'    => $this->action,
            'hazard_id' => $this->hazardId,
        ];
    }
}
