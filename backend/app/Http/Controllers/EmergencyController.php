<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Services\FirebasePushService;

class EmergencyController extends Controller
{
    // ── Helper: save up to 2 base64 files, return JSON-encoded path array ────
    private function saveProofFiles(array $files, int $userId, string $prefix): string
    {
        $paths = [];
        foreach (array_slice($files, 0, 2) as $fileData) {
            if (!$fileData || !is_string($fileData) || !str_contains($fileData, ';base64,')) continue;
            $ext       = str_contains($fileData, 'data:video') ? 'mp4' : 'png';
            $parts     = explode(';base64,', $fileData, 2);
            if (count($parts) < 2 || $parts[1] === '') continue;
            $decoded   = base64_decode($parts[1], true);
            if ($decoded === false) continue;
            $timestamp = now()->format('Ymd_His') . '_' . uniqid();
            $fileName  = $prefix . '_' . $timestamp . '_' . $userId . '.' . $ext;
            Storage::disk('public')->put('emergencies/' . $fileName, $decoded);
            $paths[] = 'storage/emergencies/' . $fileName;
        }
        return json_encode($paths);
    }

    private function notifyUser(int $userId, string $title, string $body, array $data = []): void
    {
        $tokens = DB::table('device_tokens')
            ->where('user_id', $userId)
            ->pluck('token')
            ->toArray();
        if (!empty($tokens)) {
            (new FirebasePushService())->send($tokens, $title, $body, $data);
        }
    }

    private function notifyAllCitizens(string $title, string $body, array $data = []): void
    {
        $tokens = DB::table('device_tokens')
            ->join('users', 'device_tokens.user_id', '=', 'users.user_id')
            ->where('users.role', 'citizen')
            ->pluck('device_tokens.token')
            ->toArray();
        if (!empty($tokens)) {
            (new FirebasePushService())->send($tokens, $title, $body, $data);
        }
    }

    // ── Internal helper: decode proof_files JSON string to array ─────────────
    private function decodeProofFiles(object $record): object
    {
        if (isset($record->proof_files) && is_string($record->proof_files)) {
            $record->proof_files = json_decode($record->proof_files, true) ?? [];
        } elseif (!isset($record->proof_files)) {
            $record->proof_files = [];
        }
        return $record;
    }

    // ── SOS — proof files are optional for speed in real emergencies ──────────
    public function submitSos(Request $request)
    {
        $request->validate([
            'user_id'          => 'required|integer',
            'incident_type_id' => 'required|integer',
            'latitude'         => 'required|numeric',
            'longitude'        => 'required|numeric',
            'proof_files'      => 'nullable|array|max:2',
            'proof_files.*'    => 'nullable|string|max:20971520',
            'description'      => 'nullable|string|max:1000',
        ]);

        $existing = DB::table('emergency_requests')
            ->where('user_id', $request->user_id)
            ->whereIn('status', ['Pending', 'Dispatched'])
            ->first();
        if ($existing) {
            return response()->json(['message' => 'You already have an active emergency request!'], 429);
        }

        $proofFilesJson = null;
        if ($request->filled('proof_files') && count($request->proof_files)) {
            $proofFilesJson = $this->saveProofFiles($request->proof_files, $request->user_id, 'sos');
        }

        $requestId = DB::table('emergency_requests')->insertGetId([
            'user_id'          => $request->user_id,
            'incident_type_id' => $request->incident_type_id,
            'description'      => $request->description,
            'proof_files'      => $proofFilesJson,
            'latitude'         => $request->latitude,
            'longitude'        => $request->longitude,
            'status'           => 'Pending',
            'request_time'     => now(),
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return response()->json(['message' => 'Emergency SOS sent!', 'request_id' => $requestId], 201);
    }

    public function getMyEmergencies($user_id)
    {
        $requests = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.user_id', $user_id)
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select('emergency_requests.*', 'incident_types.incident_name')
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($requests);
    }

    public function cancelEmergency(Request $request)
    {
        $request->validate(['request_id' => 'required|integer', 'user_id' => 'required|integer']);
        $affected = DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->where('user_id', $request->user_id)
            ->where('status', 'Pending')
            ->update(['status' => 'Cancelled', 'updated_at' => now()]);
        if ($affected) return response()->json(['message' => 'Emergency request cancelled.']);
        return response()->json(['message' => 'Cannot cancel — request may already be dispatched.'], 400);
    }

    public function getActiveEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->whereIn('emergency_requests.status', ['Pending', 'Dispatched'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select(
                'emergency_requests.*',
                'users.first_name', 'users.last_name', 'users.phone',
                'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                'users.false_alarm_strikes',
                'incident_types.incident_name'
            )
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($requests);
    }

    public function getDispatchAssets()
    {
        return response()->json([
            'responders' => DB::table('responders')->where('status', 'Available')->get(),
            'vehicles'   => DB::table('vehicles')->where('status', 'Available')->get(),
        ]);
    }

    public function dispatchEmergency(Request $request)
    {
        $request->validate([
            'request_id'   => 'required|integer',
            'responder_id' => 'required|integer',
            'vehicle_id'   => 'required|integer',
        ]);
        DB::table('dispatch')->insert([
            'request_id'    => $request->request_id,
            'responder_id'  => $request->responder_id,
            'vehicle_id'    => $request->vehicle_id,
            'dispatch_time' => now(),
            'status'        => 'En Route',
        ]);
        DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->update(['status' => 'Dispatched', 'updated_at' => now()]);
        $req = DB::table('emergency_requests')->where('request_id', $request->request_id)->first();
        if ($req) {
            $this->notifyUser($req->user_id, 'Responders Dispatched', 'Help is on the way to your location.', ['type' => 'dispatched']);
        }
        return response()->json(['message' => 'Units dispatched successfully!']);
    }

    public function resolveEmergency(Request $request)
    {
        $request->validate(['request_id' => 'required|integer']);
        DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->update(['status' => 'Resolved', 'updated_at' => now()]);
        DB::table('dispatch')
            ->where('request_id', $request->request_id)
            ->update(['status' => 'Completed', 'arrival_time' => now()]);
        $req = DB::table('emergency_requests')->where('request_id', $request->request_id)->first();
        if ($req) {
            $this->notifyUser($req->user_id, 'Emergency Resolved', 'Your report has been resolved. Stay safe.', ['type' => 'resolved']);
        }
        return response()->json(['message' => 'Emergency resolved and archived.']);
    }

    /**
     * Mark a resolved/cancelled emergency as a false alarm.
     * Increments the user's false_alarm_strikes counter.
     * At 3 strikes, the account is automatically suspended.
     */
    public function markFalseAlarm(Request $request)
    {
        $request->validate(['request_id' => 'required|integer']);

        $emergency = DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->first();

        if (!$emergency) {
            return response()->json(['message' => 'Emergency not found.'], 404);
        }

        // Prevent marking active/pending emergencies as false alarms.
        if (in_array($emergency->status, ['Pending', 'Dispatched'])) {
            return response()->json(['message' => 'Cannot mark an active emergency as a false alarm.'], 400);
        }

        // Prevent double-marking.
        if ($emergency->is_false_alarm) {
            return response()->json(['message' => 'Already marked as a false alarm.'], 400);
        }

        DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->update(['is_false_alarm' => 1, 'updated_at' => now()]);

        // Increment user's strike counter.
        DB::table('users')
            ->where('user_id', $emergency->user_id)
            ->increment('false_alarm_strikes');

        $user = DB::table('users')->where('user_id', $emergency->user_id)->first();

        $strikes = $user->false_alarm_strikes;
        $message = '';

        if ($strikes >= 3) {
            // Auto-suspend at 3 strikes.
            DB::table('users')
                ->where('user_id', $emergency->user_id)
                ->update([
                    'account_status' => 'banned',
                    'ban_reason'     => 'Automatically suspended after 3 false alarm strikes.',
                    'banned_at'      => now(),
                ]);
            // Revoke all tokens — kicks the user out immediately.
            DB::table('personal_access_tokens')
                ->where('tokenable_id', $emergency->user_id)
                ->delete();
            $message = "User suspended after reaching 3 false alarm strikes.";
            $this->notifyUser($emergency->user_id, 'Account Suspended', 'Your account has been suspended due to repeated false emergency reports.', ['type' => 'suspended']);
        } else {
            $remaining = 3 - $strikes;
            $message   = "Strike {$strikes} recorded. {$remaining} more will result in automatic suspension.";
            $this->notifyUser(
                $emergency->user_id,
                'False Alarm Strike ' . $strikes . ' of 3',
                "This report was marked as a false alarm by MDRRMO. {$remaining} more strike(s) will result in account suspension.",
                ['type' => 'false_alarm_strike']
            );
        }

        return response()->json([
            'message'               => $message,
            'false_alarm_strikes'   => $strikes,
            'account_status'        => $strikes >= 3 ? 'banned' : $user->account_status,
        ]);
    }

    public function getArchivedEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->whereIn('emergency_requests.status', ['Resolved', 'Cancelled'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select(
                'emergency_requests.*',
                'users.first_name', 'users.last_name', 'users.phone',
                'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                'users.false_alarm_strikes',
                'incident_types.incident_name'
            )
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($requests);
    }

    public function getAnalytics(Request $request)
    {
        $days = (int) $request->query('days', 7);

        $dailyStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->select(
                DB::raw('DATE(emergency_requests.request_time) as date'),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Fire'    THEN 1 ELSE 0 END) as fire"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Flood'   THEN 1 ELSE 0 END) as flood"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Medical' THEN 1 ELSE 0 END) as medical"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Crime'   THEN 1 ELSE 0 END) as crime"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Others'  THEN 1 ELSE 0 END) as others"),
                DB::raw('COUNT(*) as total')
            )
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        $typeStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('incident_types.incident_name', DB::raw('COUNT(*) as total'))
            ->groupBy('incident_types.incident_name')
            ->get();

        $recentRecords = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select(
                'emergency_requests.*',
                'users.first_name', 'users.last_name',
                'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                'incident_types.incident_name'
            )
            ->orderBy('emergency_requests.request_time', 'desc')
            ->limit(100)
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));

        $hazardStats = DB::table('hazards')
            ->where('created_at', '>=', now()->subDays($days))
            ->select('hazard_type', DB::raw('COUNT(*) as total'))
            ->groupBy('hazard_type')
            ->get();

        $hazardDailyStats = DB::table('hazards')
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('COUNT(*) as total'))
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        return response()->json([
            'daily_stats'        => $dailyStats,
            'type_stats'         => $typeStats,
            'recent_records'     => $recentRecords,
            'hazard_stats'       => $hazardStats,
            'hazard_daily_stats' => $hazardDailyStats,
            'timeframe'          => $days,
        ]);
    }

    // ── Hazard — proof files remain required ──────────────────────────────────
    public function submitHazard(Request $request)
    {
        $request->validate([
            'user_id'       => 'required|integer',
            'description'   => 'required|string',
            'latitude'      => 'required|numeric',
            'longitude'     => 'required|numeric',
            'proof_files'   => 'required|array|min:1|max:2',
            'proof_files.*' => 'string|max:20971520',
            'hazard_type'   => 'nullable|string|max:50',
        ]);

        $proofFilesJson = $this->saveProofFiles($request->proof_files, $request->user_id, 'hazard');

        DB::table('hazards')->insert([
            'user_id'     => $request->user_id,
            'description' => $request->description,
            'hazard_type' => $request->hazard_type,
            'proof_files' => $proofFilesJson,
            'latitude'    => $request->latitude,
            'longitude'   => $request->longitude,
            'status'      => 'Active',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return response()->json(['message' => 'Hazard reported successfully!']);
    }

    public function resolveHazard(Request $request)
    {
        $request->validate(['hazard_id' => 'required|integer']);
        DB::table('hazards')
            ->where('hazard_id', $request->hazard_id)
            ->update(['status' => 'Resolved', 'updated_at' => now()]);
        return response()->json(['message' => 'Hazard removed from active monitoring.']);
    }

    public function getActiveHazards()
    {
        $hazards = DB::table('hazards')
            ->join('users', 'hazards.user_id', '=', 'users.user_id')
            ->where('hazards.status', 'Active')
            ->select('hazards.*', 'users.first_name', 'users.last_name')
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($hazards);
    }

    public function createBroadcast(Request $request)
    {
        $request->validate(['message' => 'required|string']);
        DB::table('broadcasts')->update(['is_active' => 0]);
        DB::table('broadcasts')->insert(['message' => $request->message, 'is_active' => 1, 'created_at' => now()]);
        $this->notifyAllCitizens('SINE MDRRMO Alert', $request->message, ['type' => 'broadcast']);
        return response()->json(['message' => 'Broadcast pushed to all citizens!']);
    }

    public function getActiveBroadcast()
    {
        return response()->json(DB::table('broadcasts')->where('is_active', 1)->latest('created_at')->first());
    }

    public function clearBroadcast()
    {
        DB::table('broadcasts')->update(['is_active' => 0]);
        return response()->json(['message' => 'Broadcast alert cleared.']);
    }
}
