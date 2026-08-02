<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * broadcasts table: broadcast_id (PK), message, is_active, created_at only
 * (no updated_at column) — timestamps must stay off.
 */
class Broadcast extends Model
{
    protected $table = 'broadcasts';
    protected $primaryKey = 'broadcast_id';
    public $timestamps = false;

    protected $fillable = ['message', 'is_active', 'created_at'];
}
