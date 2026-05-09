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
        ]);

        $imagePath = null;
        if ($request->has('image_proof') && $request->image_proof) {
            $image_parts = explode(";base64,", $request->image_proof);
            $image_base64 = base64_decode($image_parts[1]);
            $fileName = 'sos_' . time() . '_' . $request->user_id . '.png';
            
            Storage::disk('public')->put('emergencies/' . $fileName, $image_base64);
            $imagePath = 'storage/emergencies/' . $fileName; 
        }

        $requestId = DB::table('emergency_requests')->insertGetId([
            'user_id' => $request->user_id,
            'incident_type_id' => $request->incident_type_id,
            'image_proof' => $imagePath,
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
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 'users.phone', 'incident_types.incident_name')
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
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 'users.phone', 'incident_types.incident_name')
            ->get();
        return response()->json($requests);
    }

    // NEW: Analytics Data Engine
    // UPGRADED: Dynamic Analytics Data Engine
    public function getAnalytics(Request $request)
    {
        // Get the 'days' parameter from the URL, default to 7 if missing
        $days = $request->query('days', 7); 

        // 1. Group by Date dynamically based on the requested timeframe
        $dailyStats = DB::table('emergency_requests')
            ->select(DB::raw('DATE(request_time) as date'), DB::raw('count(*) as total'))
            ->where('request_time', '>=', now()->subDays($days)) // Only grab data from the last X days
            ->groupBy('date')
            ->orderBy('date', 'asc') // Order chronologically for the chart
            ->get();

        // 2. Group by Incident Type (Filter this by the same timeframe too!)
        $typeStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('incident_types.incident_name', DB::raw('count(*) as total'))
            ->groupBy('incident_types.incident_name')
            ->get();

        // 3. Get the recent records for the interactive clickable filter list
        $recentRecords = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name', 'incident_types.incident_name')
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
}