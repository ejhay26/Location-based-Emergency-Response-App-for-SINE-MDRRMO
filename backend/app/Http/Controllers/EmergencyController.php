<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class EmergencyController extends Controller
{
    public function submitSos(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'incident_type_id' => 'required|integer',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'proof_file' => 'nullable|string|max:20971520'
        ]);

        $existingEmergency = DB::table('emergency_requests')
            ->where('user_id', $request->user_id)
            ->whereIn('status', ['Pending', 'Dispatched'])
            ->first();

        if ($existingEmergency) {
            return response()->json(['message' => 'You already have an active emergency request!'], 429);
        }

        $filePath = null;
        if ($request->has('proof_file') && $request->proof_file) {
            $fileData = $request->proof_file;
            $ext = str_contains($fileData, 'data:video') ? 'mp4' : 'png';
            $parts = explode(";base64,", $fileData);
            $decoded = base64_decode($parts[1]);
            $timestamp = now()->format('Ymd_His');
            $fileName = 'sos_' . $timestamp . '_' . $request->user_id . '.' . $ext;
            Storage::disk('public')->put('emergencies/' . $fileName, $decoded);
            $filePath = 'storage/emergencies/' . $fileName;
        }

        $requestId = DB::table('emergency_requests')->insertGetId([
            'user_id' => $request->user_id,
            'incident_type_id' => $request->incident_type_id,
            'proof_file' => $filePath,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'status' => 'Pending',
            'request_time' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Emergency SOS dispatched successfully!', 'request_id' => $requestId], 201);
    }

    public function getMyEmergencies($user_id)
    {
        $requests = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.user_id', $user_id)
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select('emergency_requests.*', 'incident_types.incident_name')
            ->get();
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

        if ($affected) return response()->json(['message' => 'Emergency request cancelled successfully.']);
        return response()->json(['message' => 'Cannot cancel this request. It may already be dispatched.'], 400);
    }

    public function getActiveEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->whereIn('emergency_requests.status', ['Pending', 'Dispatched'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 'users.phone', 
                     'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status', 
                     'incident_types.incident_name')
            ->get();
        return response()->json($requests);
    }

    public function getDispatchAssets()
    {
        $responders = DB::table('responders')->where('status', 'Available')->get();
        $vehicles = DB::table('vehicles')->where('status', 'Available')->get();
        return response()->json(['responders' => $responders, 'vehicles' => $vehicles]);
    }

    public function dispatchEmergency(Request $request)
    {
        $request->validate([
            'request_id' => 'required|integer',
            'responder_id' => 'required|integer',
            'vehicle_id' => 'required|integer'
        ]);

        DB::table('dispatch')->insert([
            'request_id' => $request->request_id,
            'responder_id' => $request->responder_id,
            'vehicle_id' => $request->vehicle_id,
            'dispatch_time' => now(),
            'status' => 'En Route'
        ]);

        DB::table('emergency_requests')
            ->where('request_id', $request->request_id)
            ->update(['status' => 'Dispatched', 'updated_at' => now()]);

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

        return response()->json(['message' => 'Emergency resolved and archived.']);
    }

    public function getArchivedEmergencies()
    {
        $requests = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->whereIn('emergency_requests.status', ['Resolved', 'Cancelled'])
            ->orderBy('emergency_requests.request_time', 'desc')
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 'users.phone', 
                     'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status', 
                     'incident_types.incident_name')
            ->get();
        return response()->json($requests);
    }

    public function getAnalytics(Request $request)
    {
        $days = $request->query('days', 7); 

        // UPGRADED: Conditional Aggregation separates each category natively by timeline dates
        $dailyStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->select(
                DB::raw('DATE(emergency_requests.request_time) as date'),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Fire' THEN 1 ELSE 0 END) as fire"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Flood' THEN 1 ELSE 0 END) as flood"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Medical' THEN 1 ELSE 0 END) as medical"),
                DB::raw("SUM(CASE WHEN incident_types.incident_name = 'Crime' THEN 1 ELSE 0 END) as crime"),
                DB::raw('count(*) as total')
            )
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        $typeStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('incident_types.incident_name', DB::raw('count(*) as total'))
            ->groupBy('incident_types.incident_name')
            ->get();

        $recentRecords = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 
                     'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                     'incident_types.incident_name')
            ->orderBy('emergency_requests.request_time', 'desc')
            ->limit(100)
            ->get();

        return response()->json([
            'daily_stats' => $dailyStats,
            'type_stats' => $typeStats,
            'recent_records' => $recentRecords,
            'timeframe' => $days
        ]);
    }

    public function submitHazard(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'description' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'proof_file' => 'required|string',
            'hazard_type' => 'nullable|string|max:50'
        ]);

        $fileData = $request->proof_file;
        $ext = str_contains($fileData, 'data:video') ? 'mp4' : 'png';
        $parts = explode(";base64,", $fileData);
        $decoded = base64_decode($parts[1]);
        $timestamp = now()->format('Ymd_His');
        $fileName = 'hazard_' . $timestamp . '_' . $request->user_id . '.' . $ext;
        Storage::disk('public')->put('emergencies/' . $fileName, $decoded);
        $filePath = 'storage/emergencies/' . $fileName;

        DB::table('hazards')->insert([
            'user_id' => $request->user_id,
            'description' => $request->description,
            'hazard_type' => $request->hazard_type,
            'proof_file' => $filePath,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'status' => 'Active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Hazard reported successfully!']);
    }

    // function to handle hazard dismissals
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
            ->get();
        return response()->json($hazards);
    }

    public function createBroadcast(Request $request)
    {
        $request->validate(['message' => 'required|string']);
        DB::table('broadcasts')->update(['is_active' => 0]);
        DB::table('broadcasts')->insert([
            'message' => $request->message,
            'is_active' => 1,
            'created_at' => now()
        ]);
        return response()->json(['message' => 'Broadcast pushed to all citizens!']);
    }

    public function getActiveBroadcast()
    {
        $broadcast = DB::table('broadcasts')->where('is_active', 1)->latest('created_at')->first();
        return response()->json($broadcast);
    }
    
    public function clearBroadcast()
    {
        DB::table('broadcasts')->update(['is_active' => 0]);
        return response()->json(['message' => 'Broadcast alert removed successfully.']);
    }
}