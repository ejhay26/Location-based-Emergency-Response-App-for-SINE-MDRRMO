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
            'broadcast_id'    => 'nullable|integer|exists:broadcasts,broadcast_id',
            'title'           => 'nullable|string|max:255',
            'message'         => 'required|string|max:2000',
            'barangay_ids'    => 'array',
            'barangay_ids.*'  => 'integer|distinct|exists:barangays,barangay_id',
            'media_files'     => 'nullable|array|max:4',
            'media_files.*'   => 'nullable|string|max:20971520',
            'scheduled_at'    => 'nullable|date',
            'is_draft'        => 'nullable|boolean',
        ]);

        $userId = $request->user()?->user_id ?? 1;
        $barangayIds = array_values(array_unique($validated['barangay_ids'] ?? []));
        $isDraft = (bool) ($validated['is_draft'] ?? false);

        $storedMediaPaths = [];
        if (!empty($validated['media_files'])) {
            foreach (array_slice($validated['media_files'], 0, 4) as $rawMedia) {
                if (!$rawMedia || !is_string($rawMedia)) continue;
                // Preserve already stored paths or URLs when re-saving drafts
                if (str_starts_with($rawMedia, 'http') || str_starts_with($rawMedia, '/storage/') || str_starts_with($rawMedia, 'reports/')) {
                    $storedMediaPaths[] = $rawMedia;
                    continue;
                }
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

        $existingId = $validated['broadcast_id'] ?? null;
        $broadcast = $existingId ? Broadcast::find($existingId) : null;

        if ($broadcast) {
            $broadcast->title        = $validated['title'] ?? null;
            $broadcast->message      = $validated['message'];
            $broadcast->media_files  = !empty($storedMediaPaths) ? $storedMediaPaths : null;
            $broadcast->is_active    = $isDraft ? 0 : 1;
            $broadcast->is_draft     = $isDraft ? 1 : 0;
            $broadcast->scheduled_at = $scheduledAt;
            $broadcast->save();
            $broadcast->barangays()->sync($barangayIds);
        } else {
            $broadcast = Broadcast::create([
                'title'        => $validated['title'] ?? null,
                'message'      => $validated['message'],
                'media_files'  => !empty($storedMediaPaths) ? $storedMediaPaths : null,
                'is_active'    => $isDraft ? 0 : 1,
                'is_draft'     => $isDraft ? 1 : 0,
                'scheduled_at' => $scheduledAt,
                'created_at'   => now(),
            ]);

            if (!empty($barangayIds)) {
                $broadcast->barangays()->attach($barangayIds);
            }
        }

        $location = $this->locationLabel($barangayIds);

        // If saved as draft, do NOT notify citizens or sound public alerts
        if ($isDraft) {
            try {
                broadcast(new BroadcastMessageUpdated('draft_saved', $broadcast->broadcast_id));
            } catch (\Throwable $e) {
                Log::error('BroadcastController: draft broadcast event failed: ' . $e->getMessage());
            }

            return response()->json([
                'message'      => 'Announcement saved as draft for later review.',
                'broadcast_id' => $broadcast->broadcast_id,
            ]);
        }

        // Only send immediate citizen notifications if NOT scheduled in the future and NOT a draft
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

        return response()->json([
            'message'      => $respMsg,
            'broadcast_id' => $broadcast->broadcast_id,
        ]);
    }

    public function getActiveBroadcast(Request $request)
    {
        $user = $request->user();

        // Citizens only see active announcements whose scheduled time has arrived or was immediate (never drafts)
        if ($user && $user->role === 'citizen') {
            $query = Broadcast::where('is_active', 1)
                ->where('is_draft', 0)
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

        // For Admin / Dispatcher: return drafts, active, scheduled, and archived
        $all = Broadcast::with('barangays:barangay_id,barangay_name')
            ->orderByDesc('created_at')
            ->get();

        $drafts    = [];
        $active    = [];
        $scheduled = [];
        $archived  = [];

        foreach ($all as $b) {
            $item = $this->formatBroadcastItem($b);
            if ($b->is_draft) {
                $drafts[] = $item;
            } elseif (!$b->is_active) {
                $archived[] = $item;
            } elseif ($b->scheduled_at && \Carbon\Carbon::parse($b->scheduled_at)->isFuture()) {
                $scheduled[] = $item;
            } else {
                $active[] = $item;
            }
        }

        return response()->json([
            'drafts'    => $drafts,
            'active'    => $active,
            'scheduled' => $scheduled,
            'archived'  => array_slice($archived, 0, 30),
        ]);
    }

    public function clearBroadcast(Request $request)
    {
        $validated = $request->validate(['broadcast_id' => 'required|integer|exists:broadcasts,broadcast_id']);

        $broadcast = Broadcast::find($validated['broadcast_id']);

        if ($broadcast->is_draft) {
            $broadcast->barangays()->detach();
            $broadcast->delete();

            try {
                broadcast(new BroadcastMessageUpdated('deleted', $validated['broadcast_id']));
            } catch (\Throwable $e) {
                Log::error('BroadcastController: delete draft broadcast failed: ' . $e->getMessage());
            }

            return response()->json(['message' => 'Draft announcement discarded.']);
        }

        $broadcast->is_active = 0;
        $broadcast->save();

        try {
            broadcast(new BroadcastMessageUpdated('cleared', $broadcast->broadcast_id));
        } catch (\Throwable $e) {
            Log::error('BroadcastController: clear broadcast failed: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Broadcast alert cleared and moved to archive.']);
    }

    public function deleteDraft(Request $request)
    {
        $validated = $request->validate(['broadcast_id' => 'required|integer|exists:broadcasts,broadcast_id']);

        $broadcast = Broadcast::find($validated['broadcast_id']);
        $broadcast->barangays()->detach();
        $broadcast->delete();

        try {
            broadcast(new BroadcastMessageUpdated('deleted', $validated['broadcast_id']));
        } catch (\Throwable $e) {
            Log::error('BroadcastController: delete draft broadcast failed: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Draft announcement discarded.']);
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
            'is_draft'     => (int) ($broadcast->is_draft ?? 0),
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
