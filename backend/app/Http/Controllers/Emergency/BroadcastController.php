<?php

namespace App\Http\Controllers\Emergency;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Broadcast;
use App\Services\NotificationService;

/** Admin-pushed alert broadcasts to all citizens. */
class BroadcastController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function createBroadcast(Request $request)
    {
        $request->validate(['message' => 'required|string']);
        Broadcast::query()->update(['is_active' => 0]);
        Broadcast::create(['message' => $request->message, 'is_active' => 1, 'created_at' => now()]);
        $this->notifications->notifyAllCitizens('SINE MDRRMO Alert', $request->message, ['type' => 'broadcast']);
        return response()->json(['message' => 'Broadcast pushed to all citizens!']);
    }

    public function getActiveBroadcast()
    {
        return response()->json(Broadcast::where('is_active', 1)->latest('created_at')->first());
    }

    public function clearBroadcast()
    {
        Broadcast::query()->update(['is_active' => 0]);
        return response()->json(['message' => 'Broadcast alert cleared.']);
    }
}
