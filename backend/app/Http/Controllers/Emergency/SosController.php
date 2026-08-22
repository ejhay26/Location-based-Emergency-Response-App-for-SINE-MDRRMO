<?php

namespace App\Http\Controllers\Emergency;

use App\Events\EmergencyUpdated;
use App\Http\Controllers\Controller;
use App\Services\BarangayResolver;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\EmergencyRequest;

/** Citizen-facing SOS lifecycle: submit, list own, cancel; and admin listing (active/archived). */
class SosController extends Controller
{
    use MediaHandling;

    public function __construct(private readonly BarangayResolver $barangayResolver)
    {
    }

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

        $existing = EmergencyRequest::where('user_id', $request->user_id)
            ->whereIn('status', ['Pending', 'Dispatched'])
            ->first();
        if ($existing) {
            return response()->json(['message' => 'You already have an active emergency request!'], 429);
        }

        $proofFilesJson = null;
        if ($request->filled('proof_files') && count($request->proof_files)) {
            $proofFilesJson = $this->processProofFiles($request->proof_files, $request->user_id, 'sos');
        }

        // Server-side, authoritative barangay resolution — see
        // BarangayResolver's class doc for why this is never trusted from
        // the client. Null (unresolved) is a valid, expected outcome and
        // must never block submission — this is a life-safety path.
        $barangayId = $this->barangayResolver->resolve((float) $request->latitude, (float) $request->longitude);

        $created = EmergencyRequest::create([
            'user_id'          => $request->user_id,
            'incident_type_id' => $request->incident_type_id,
            'description'      => $request->description,
            'proof_files'      => $proofFilesJson,
            'latitude'         => $request->latitude,
            'longitude'        => $request->longitude,
            'barangay_id'      => $barangayId,
            'status'           => 'Pending',
            'request_time'     => now(),
        ]);

        broadcast(new EmergencyUpdated('submitted', $created->request_id))->toOthers();

        return response()->json(['message' => 'Emergency SOS sent!', 'request_id' => $created->request_id], 201);
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
        $request->validate([
            'request_id' => 'required|integer',
            'user_id'    => 'nullable|integer',
        ]);
        $userId = $request->user_id ?? $request->user()?->user_id;

        $query = EmergencyRequest::where('request_id', $request->request_id)
            ->where('status', 'Pending');

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $affected = $query->update(['status' => 'Cancelled']);

        if ($affected) {
            broadcast(new EmergencyUpdated('cancelled', $request->request_id))->toOthers();
            return response()->json(['message' => 'Emergency request cancelled.']);
        }
        return response()->json(['message' => 'Cannot cancel — request may already be dispatched or was not found.'], 400);
    }

    public function getActiveEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->leftJoin('barangays', 'emergency_requests.barangay_id', '=', 'barangays.barangay_id')
            ->whereIn('emergency_requests.status', ['Pending', 'Dispatched'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select(
                'emergency_requests.*',
                'users.first_name', 'users.last_name', 'users.phone', 'users.profile_picture',
                'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                'users.false_alarm_strikes',
                'incident_types.incident_name',
                'barangays.barangay_name'
            )
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($requests);
    }

    public function getArchivedEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->leftJoin('barangays', 'emergency_requests.barangay_id', '=', 'barangays.barangay_id')
            ->whereIn('emergency_requests.status', ['Resolved', 'Cancelled'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select(
                'emergency_requests.*',
                'users.first_name', 'users.last_name', 'users.phone', 'users.profile_picture',
                'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                'users.false_alarm_strikes',
                'incident_types.incident_name',
                'barangays.barangay_name'
            )
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($requests);
    }
}
