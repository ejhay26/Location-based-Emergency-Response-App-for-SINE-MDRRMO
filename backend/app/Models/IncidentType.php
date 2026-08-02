<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** incident_types table: incident_type_id (PK), incident_name. No timestamp columns. */
class IncidentType extends Model
{
    protected $table = 'incident_types';
    protected $primaryKey = 'incident_type_id';
    public $timestamps = false;

    protected $fillable = ['incident_name'];
}
