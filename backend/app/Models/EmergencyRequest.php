<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmergencyRequest extends Model
{
    protected $table = 'emergency_requests';
    protected $primaryKey = 'request_id';
    
    // Disable default timestamps (you use request_time which we can handle manually or via DB default)
    public $timestamps = false; 

    protected $fillable = [
        'user_id',
        'incident_type_id',
        'location_id',
        'status',
    ];
}