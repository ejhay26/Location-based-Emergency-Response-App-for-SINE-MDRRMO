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
            ->groupBy(DB::raw('DATE(emergency_requests.request_time)'))
            ->orderBy(DB::raw('DATE(emergency_requests.request_time)'), 'asc')->get();

        $typeStats = DB::table('emergency_requests')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('incident_types.incident_name', DB::raw('COUNT(*) as total'))
            ->groupBy('incident_types.incident_name')->get();

        $recentRecords = DB::table('emergency_requests')
            ->join('users', 'emergency_requests.user_id', '=', 'users.user_id')
            ->join('incident_types', 'emergency_requests.incident_type_id', '=', 'incident_types.incident_type_id')
            ->leftJoin('barangays', 'emergency_requests.barangay_id', '=', 'barangays.barangay_id')
            ->leftJoin('user_medical_profiles', 'users.user_id', '=', 'user_medical_profiles.user_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('emergency_requests.*', 'users.first_name', 'users.last_name',
                     'user_medical_profiles.blood_type', 'user_medical_profiles.allergies', 'user_medical_profiles.medical_conditions', 'user_medical_profiles.pwd_status',
                     'incident_types.incident_name', 'barangays.barangay_name')
            ->orderBy('emergency_requests.request_time', 'desc')->limit(100)->get()
            ->map(fn($r) => $this->decodeProofFiles($r));

        // Per-barangay emergency counts (unresolved locations excluded — a
        // null barangay_id has nothing meaningful to group under here).
        $barangayStats = DB::table('emergency_requests')
            ->join('barangays', 'emergency_requests.barangay_id', '=', 'barangays.barangay_id')
            ->where('emergency_requests.request_time', '>=', now()->subDays($days))
            ->select('barangays.barangay_name', DB::raw('COUNT(*) as total'))
            ->groupBy('barangays.barangay_name')->orderBy('total', 'desc')->get();

        $hazardStats = DB::table('hazards')
            ->where('created_at', '>=', now()->subDays($days))
            ->select('hazard_type', DB::raw('COUNT(*) as total'))
            ->groupBy('hazard_type')
            ->get()
            ->map(function ($row) {
                $type = trim($row->hazard_type ?? '');
                return (object) [
                    'hazard_type' => $type !== '' ? $type : 'Others',
                    'total'       => (int) $row->total,
                ];
            });

        $hazardDailyStats = DB::table('hazards')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw("SUM(CASE WHEN hazard_type = 'Flooded Street' OR hazard_type LIKE '%Flood%' THEN 1 ELSE 0 END) as flood"),
                DB::raw("SUM(CASE WHEN hazard_type = 'Road Obstruction' OR hazard_type LIKE '%Road%' OR hazard_type LIKE '%Block%' THEN 1 ELSE 0 END) as road"),
                DB::raw("SUM(CASE WHEN hazard_type = 'Fallen Tree' OR hazard_type LIKE '%Tree%' THEN 1 ELSE 0 END) as tree"),
                DB::raw("SUM(CASE WHEN hazard_type = 'Downed Wire' OR hazard_type LIKE '%Wire%' OR hazard_type LIKE '%Electric%' THEN 1 ELSE 0 END) as electrical"),
                DB::raw("SUM(CASE WHEN (hazard_type IS NULL OR (hazard_type NOT IN ('Flooded Street', 'Road Obstruction', 'Fallen Tree', 'Downed Wire') AND hazard_type NOT LIKE '%Flood%' AND hazard_type NOT LIKE '%Road%' AND hazard_type NOT LIKE '%Tree%' AND hazard_type NOT LIKE '%Wire%')) THEN 1 ELSE 0 END) as others"),
                DB::raw('COUNT(*) as total')
            )
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'), 'asc')->get();

        $hazardBarangayStats = DB::table('hazards')
            ->join('barangays', 'hazards.barangay_id', '=', 'barangays.barangay_id')
            ->where('hazards.created_at', '>=', now()->subDays($days))
            ->select('barangays.barangay_name', DB::raw('COUNT(*) as total'))
            ->groupBy('barangays.barangay_name')->orderBy('total', 'desc')->get();

        return response()->json([
            'daily_stats'           => $dailyStats,
            'type_stats'            => $typeStats,
            'recent_records'        => $recentRecords,
            'barangay_stats'        => $barangayStats,
            'hazard_stats'          => $hazardStats,
            'hazard_daily_stats'    => $hazardDailyStats,
            'hazard_barangay_stats' => $hazardBarangayStats,
            'timeframe'             => $days,
        ]);
    }
}
