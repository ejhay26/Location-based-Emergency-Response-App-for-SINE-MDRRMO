<?php

namespace App\Http\Controllers\Emergency;

use App\Http\Controllers\Controller;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Admin dashboard analytics: incident trends over a rolling window. */
class AnalyticsController extends Controller
{
    use MediaHandling;

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
            ->groupBy('date')->orderBy('date', 'asc')->get();

        $typeStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('incident_types.incident_name', DB::raw('COUNT(*) as total'))
            ->groupBy('incident_types.incident_name')->get();

        $recentRecords = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name',
                     'users.blood_type', 'users.allergies', 'users.medical_conditions', 'users.pwd_status',
                     'incident_types.incident_name')
            ->orderBy('emergency_requests.request_time', 'desc')->limit(100)->get()
            ->map(fn($r) => $this->decodeProofFiles($r));

        $hazardStats = DB::table('hazards')
            ->where('created_at', '>=', now()->subDays($days))
            ->select('hazard_type', DB::raw('COUNT(*) as total'))
            ->groupBy('hazard_type')->get();

        $hazardDailyStats = DB::table('hazards')
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('COUNT(*) as total'))
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')->orderBy('date', 'asc')->get();

        return response()->json([
            'daily_stats'        => $dailyStats,
            'type_stats'         => $typeStats,
            'recent_records'     => $recentRecords,
            'hazard_stats'       => $hazardStats,
            'hazard_daily_stats' => $hazardDailyStats,
            'timeframe'          => $days,
        ]);
    }
}
