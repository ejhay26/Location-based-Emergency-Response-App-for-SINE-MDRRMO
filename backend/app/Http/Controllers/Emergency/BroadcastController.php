<?php

namespace App\Http\Controllers\Emergency;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Broadcast;
use App\Models\Barangay;
use App\Services\NotificationService;

/**
 * Admin/dispatcher-pushed alert broadcasts. A broadcast can be town-wide
 * (no barangay_ids given) or scoped to one or more barangays via the
 * broadcast_barangays pivot (see Broadcast::barangays()). Multiple
 * broadcasts — town-wide and/or barangay-scoped — can be active at the
 * same time; each is stopped individually by broadcast_id.
 */
class BroadcastController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function createBroadcast(Request $request)
    {
        $validated = $request->validate([
            'message'         => 'required|string|max:2000',
            'barangay_ids'    => 'array',
            'barangay_ids.*'  => 'integer|distinct|exists:barangays,barangay_id',
        ]);

        $barangayIds = array_values(array_unique($validated['barangay_ids'] ?? []));

        $broadcast = Broadcast::create([
            'message'    => $validated['message'],
            'is_active'  => 1,
            'created_at' => now(),
        ]);

        if (!empty($barangayIds)) {
            $broadcast->barangays()->attach($barangayIds);
        }

        $location = $this->locationLabel($barangayIds);
        $title    = "SINE MDRRMO Alert — {$location}";
        $data     = [
            'type'         => 'broadcast',
            'broadcast_id' => $broadcast->broadcast_id,
            'scope'        => empty($barangayIds) ? 'town' : 'barangay',
            'location'     => $location,
        ];

        if (empty($barangayIds)) {
            $this->notifications->notifyAllCitizens($title, $validated['message'], $data);
        } else {
            $this->notifications->notifyCitizensInBarangays($barangayIds, $title, $validated['message'], $data);
        }

        return response()->json(['message' => "Broadcast pushed to {$location}!"]);
    }

    public function getActiveBroadcast(Request $request)
    {
        $user = $request->user();

        $query = Broadcast::where('is_active', 1)
            ->with('barangays:barangay_id,barangay_name')
            ->orderByDesc('created_at');

        // Citizens only see town-wide alerts plus ones targeted at their own
        // barangay. Admins/dispatchers see every active alert regardless of
        // scope, so the dashboard reflects the full picture.
        if ($user && $user->role === 'citizen') {
            $query->where(function ($q) use ($user) {
                $q->whereDoesntHave('barangays');
                if ($user->barangay_id) {
                    $q->orWhereHas('barangays', fn ($bq) => $bq->where('barangays.barangay_id', $user->barangay_id));
                }
            });
        }

        $broadcasts = $query->get()->map(function (Broadcast $broadcast) {
            return [
                'broadcast_id' => $broadcast->broadcast_id,
                'message'      => $broadcast->message,
                'is_active'    => $broadcast->is_active,
                'created_at'   => $broadcast->created_at,
                'scope'        => $broadcast->barangays->isEmpty() ? 'town' : 'barangay',
                'location'     => $broadcast->barangays->isEmpty()
                    ? 'Town-wide'
                    : $broadcast->barangays->pluck('barangay_name')->implode(', '),
                'barangay_ids' => $broadcast->barangays->pluck('barangay_id')->values(),
            ];
        });

        return response()->json($broadcasts);
    }

    public function clearBroadcast(Request $request)
    {
        $validated = $request->validate(['broadcast_id' => 'required|integer|exists:broadcasts,broadcast_id']);

        $broadcast = Broadcast::find($validated['broadcast_id']);
        $broadcast->is_active = 0;
        $broadcast->save();

        return response()->json(['message' => 'Broadcast alert cleared.']);
    }

    private function locationLabel(array $barangayIds): string
    {
        if (empty($barangayIds)) return 'Town-wide';
        return Barangay::whereIn('barangay_id', $barangayIds)->pluck('barangay_name')->implode(', ');
    }
}
