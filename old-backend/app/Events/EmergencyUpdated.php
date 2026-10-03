<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever the active emergencies list changes:
 *   - A new SOS is submitted
 *   - An emergency is dispatched
 *   - An emergency is resolved or cancelled
 *   - A false alarm strike is recorded
 *
 * Broadcasts on the public channel `emergencies` so both the admin
 * dashboard and the citizen home screen can react without polling.
 * No sensitive payload is sent — listeners re-fetch via the existing
 * authenticated REST endpoints upon receiving this event.
 */
class EmergencyUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $action,   // 'submitted' | 'dispatched' | 'resolved' | 'cancelled' | 'false_alarm'
        public readonly int    $requestId,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('emergencies');
    }

    public function broadcastAs(): string
    {
        return 'EmergencyUpdated';
    }

    /**
     * Only send the minimal signal needed to trigger a re-fetch.
     * Never include PII or location data in the broadcast payload.
     */
    public function broadcastWith(): array
    {
        return [
            'action'     => $this->action,
            'request_id' => $this->requestId,
        ];
    }
}
