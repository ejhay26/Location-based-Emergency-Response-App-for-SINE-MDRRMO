<?php

namespace App\Http\Controllers\Emergency;

use App\Events\BroadcastMessageUpdated;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Broadcast;
use App\Models\Barangay;
use App\Services\NotificationService;
use App\Traits\MediaHandling;
use Illuminate\Support\Facades\Log;

/**
 * Admin/dispatcher-pushed alert broadcasts. A broadcast can be town-wide
 * (no barangay_ids given) or scoped to one or more barangays via the
 * broadcast_barangays pivot (see Broadcast::barangays()). Multiple
 * broadcasts — town-wide and/or barangay-scoped — can be active at the
 * same time; each is stopped individually by broadcast_id.
 */
class BroadcastController extends Controller
{
    use MediaHandling;

    public function __construct(private NotificationService $notifications)
    {
    }

    public function createBroadcast(Request $request)
    {
        $validated = $request->validate([
            'title'           => 'nullable|string|max:255',
            'message'         => 'required|string|max:2000',
            'barangay_ids'    => 'array',
            'barangay_ids.*'  => 'integer|distinct|exists:barangays,barangay_id',
            'media_files'     => 'nullable|array|max:4',
            'media_files.*'   => 'nullable|string|max:20971520',
            'scheduled_at'    => 'nullable|date',
        ]);

        $userId = $request->user()?->user_id ?? 1;
        $barangayIds = array_values(array_unique($validated['barangay_ids'] ?? []));

        $storedMediaPaths = [];
        if (!empty($validated['media_files'])) {
            foreach (array_slice($validated['media_files'], 0, 4) as $rawMedia) {
                if (!$rawMedia || !is_string($rawMedia)) continue;
                $storedPath = $this->processAndStorePublic(
                    'broadcast',
                    "reports/broadcasts/{$userId}",
                    'proof',
                    $rawMedia,
                    $userId
                );
                if ($storedPath !== null) {
                    $storedMediaPaths[] = $storedPath;
                }
            }
        }

        $scheduledAt = !empty($validated['scheduled_at']) ? \Carbon\Carbon::parse($validated['scheduled_at']) : null;
        $isFutureSchedule = $scheduledAt && $scheduledAt->isFuture();

        $broadcast = Broadcast::create([
            'title'        => $validated['title'] ?? null,
            'message'      => $validated['message'],
            'media_files'  => !empty($storedMediaPaths) ? $storedMediaPaths : null,
            'is_active'    => 1,
            'scheduled_at' => $scheduledAt,
            'created_at'   => now(),
        ]);

        if (!empty($barangayIds)) {
            $broadcast->barangays()->attach($barangayIds);
        }

        $location = $this->locationLabel($barangayIds);

        // Only send immediate citizen notifications if NOT scheduled in the future
        if (!$isFutureSchedule) {
            $notifTitle = !empty($validated['title'])
                ? "MDRRMO Alert: {$validated['title']}"
                : "SINE MDRRMO Alert — {$location}";

            $data = [
                'type'         => 'broadcast',
                'broadcast_id' => $broadcast->broadcast_id,
                'title'        => $validated['title'] ?? '',
                'scope'        => empty($barangayIds) ? 'town' : 'barangay',
                'location'     => $location,
            ];

            try {
                if (empty($barangayIds)) {
                    $this->notifications->notifyAllCitizens($notifTitle, $validated['message'], $data);
                } else {
                    $this->notifications->notifyCitizensInBarangays($barangayIds, $notifTitle, $validated['message'], $data);
                }
            } catch (\Throwable $e) {
                Log::error('BroadcastController: notification failed: ' . $e->getMessage());
            }
        }

        try {
            broadcast(new BroadcastMessageUpdated('created', $broadcast->broadcast_id));
        } catch (\Throwable $e) {
            Log::error('BroadcastController: reverb broadcast failed: ' . $e->getMessage());
        }

        $respMsg = $isFutureSchedule
            ? "Announcement scheduled for {$scheduledAt->format('M d, Y h:i A')} ({$location})!"
            : "Broadcast pushed to {$location}!";

        return response()->json(['message' => $respMsg]);
    }

    public function getActiveBroadcast(Request $request)
    {
        $user = $request->user();

        // Citizens only see active announcements whose scheduled time has arrived or was immediate
        if ($user && $user->role === 'citizen') {
            $query = Broadcast::where('is_active', 1)
                ->where(function ($q) {
                    $q->whereNull('scheduled_at')
                      ->orWhere('scheduled_at', '<=', now());
                })
                ->with('barangays:barangay_id,barangay_name')
                ->orderByDesc('created_at');

            $query->where(function ($q) use ($user) {
                $q->whereDoesntHave('barangays');
                if ($user->barangay_id) {
                    $q->orWhereHas('barangays', fn ($bq) => $bq->where('barangays.barangay_id', $user->barangay_id));
                }
            });

            $list = $query->get()->map(fn (Broadcast $b) => $this->formatBroadcastItem($b));
            return response()->json($list);
        }

        // For Admin / Dispatcher: return active, scheduled, and archived
        $all = Broadcast::with('barangays:barangay_id,barangay_name')
            ->orderByDesc('created_at')
            ->get();

        $active = [];
        $scheduled = [];
        $archived = [];

        foreach ($all as $b) {
            $item = $this->formatBroadcastItem($b);
            if (!$b->is_active) {
                $archived[] = $item;
            } elseif ($b->scheduled_at && \Carbon\Carbon::parse($b->scheduled_at)->isFuture()) {
                $scheduled[] = $item;
            } else {
                $active[] = $item;
            }
        }

        return response()->json([
            'active'    => $active,
            'scheduled' => $scheduled,
            'archived'  => array_slice($archived, 0, 30),
        ]);
    }

    public function clearBroadcast(Request $request)
    {
        $validated = $request->validate(['broadcast_id' => 'required|integer|exists:broadcasts,broadcast_id']);

        $broadcast = Broadcast::find($validated['broadcast_id']);
        $broadcast->is_active = 0;
        $broadcast->save();

        try {
            broadcast(new BroadcastMessageUpdated('cleared', $broadcast->broadcast_id));
        } catch (\Throwable $e) {
            Log::error('BroadcastController: clear broadcast failed: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Broadcast alert cleared and moved to archive.']);
    }

    private function formatBroadcastItem(Broadcast $broadcast): array
    {
        $media = $broadcast->media_files;
        if (is_string($media)) {
            $media = json_decode($media, true) ?? [];
        } elseif (!is_array($media)) {
            $media = [];
        }

        return [
            'broadcast_id' => $broadcast->broadcast_id,
            'title'        => $broadcast->title ?? '',
            'message'      => $broadcast->message,
            'media_files'  => $media,
            'is_active'    => (int) $broadcast->is_active,
            'scheduled_at' => $broadcast->scheduled_at ? \Carbon\Carbon::parse($broadcast->scheduled_at)->toISOString() : null,
            'created_at'   => $broadcast->created_at,
            'scope'        => $broadcast->barangays->isEmpty() ? 'town' : 'barangay',
            'location'     => $broadcast->barangays->isEmpty()
                ? 'Town-wide'
                : $broadcast->barangays->pluck('barangay_name')->implode(', '),
            'barangay_ids' => $broadcast->barangays->pluck('barangay_id')->values(),
        ];
    }

    private function locationLabel(array $barangayIds): string
    {
        if (empty($barangayIds)) return 'Town-wide';
        return Barangay::whereIn('barangay_id', $barangayIds)->pluck('barangay_name')->implode(', ');
    }
}
