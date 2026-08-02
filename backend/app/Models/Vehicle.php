<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** vehicles table: vehicle_id (PK), responder_id, name, type, plate, status. No timestamp columns. */
class Vehicle extends Model
{
    protected $table = 'vehicles';
    protected $primaryKey = 'vehicle_id';
    public $timestamps = false;

    protected $fillable = ['responder_id', 'name', 'type', 'plate', 'status'];
}
