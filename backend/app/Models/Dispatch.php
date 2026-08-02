<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * dispatch table: dispatch_id (PK), request_id, responder_id, vehicle_id,
 * dispatch_time, arrival_time, status. No created_at/updated_at columns exist,
 * so Eloquent's automatic timestamp writes must stay off or every insert/update
 * will fail trying to write a column that isn't there.
 */
class Dispatch extends Model
{
    protected $table = 'dispatch';
    protected $primaryKey = 'dispatch_id';
    public $timestamps = false;

    protected $fillable = [
        'request_id', 'responder_id', 'vehicle_id', 'dispatch_time', 'arrival_time', 'status',
    ];
}
