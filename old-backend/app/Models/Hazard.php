<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * hazards table: hazard_id (PK), user_id, description, hazard_type,
 * proof_files (JSON string), latitude, longitude, barangay_id
 * (server-resolved incident-location barangay — see App\Services\BarangayResolver;
 * distinct from users.barangay_id, the citizen's home barangay), status,
 * created_at, updated_at. Both timestamp columns exist and updated_at has
 * ON UPDATE CURRENT_TIMESTAMP, so Eloquent's default timestamp management
 * is safe here.
 */
class Hazard extends Model
{
    protected $table = 'hazards';
    protected $primaryKey = 'hazard_id';

    protected $fillable = [
        'user_id', 'description', 'hazard_type', 'proof_files', 'latitude', 'longitude', 'barangay_id', 'status',
    ];
}
