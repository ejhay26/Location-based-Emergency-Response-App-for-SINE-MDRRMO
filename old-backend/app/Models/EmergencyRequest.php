<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * emergency_requests table: request_id (PK), user_id, incident_type_id,
 * proof_files (JSON string), description, latitude, longitude, barangay_id
 * (server-resolved incident-location barangay — see App\Services\BarangayResolver;
 * distinct from users.barangay_id, the citizen's home barangay), status,
 * request_time, created_at, updated_at (ON UPDATE CURRENT_TIMESTAMP),
 * deleted_at, is_false_alarm.
 */
class EmergencyRequest extends Model
{
    protected $table = 'emergency_requests';
    protected $primaryKey = 'request_id';

    protected $fillable = [
        'user_id',
        'incident_type_id',
        'proof_files',
        'description',
        'latitude',
        'longitude',
        'barangay_id',
        'status',
        'request_time',
        'is_false_alarm',
    ];

    // Deliberately no $casts here: the frontend consumes this table's raw
    // 0/1 integer values (e.g. is_false_alarm), and Eloquent's boolean cast
    // would serialize those as true/false in JSON instead of 0/1 — a
    // response-shape change the Ionic app doesn't expect. Kept uncast to
    // match the original DB::table() output exactly.
}
