<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * broadcasts table: broadcast_id (PK), message, is_active, created_at only
 * (no updated_at column) — timestamps must stay off.
 *
 * Targeting: a broadcast with no rows in broadcast_barangays is town-wide;
 * one or more rows there scopes it to those barangays. See Barangay model
 * and the broadcast_barangays pivot table (database/2026_08_03_add_broadcast_barangays.sql).
 */
class Broadcast extends Model
{
    protected $table = 'broadcasts';
    protected $primaryKey = 'broadcast_id';
    public $timestamps = false;

    protected $fillable = ['title', 'message', 'media_files', 'is_active', 'scheduled_at', 'created_at'];

    protected $casts = [
        'media_files'  => 'array',
        'is_active'    => 'integer',
        'scheduled_at' => 'datetime',
    ];

    public function barangays(): BelongsToMany
    {
        return $this->belongsToMany(Barangay::class, 'broadcast_barangays', 'broadcast_id', 'barangay_id');
    }

    public function isTownWide(): bool
    {
        return $this->relationLoaded('barangays')
            ? $this->barangays->isEmpty()
            : $this->barangays()->doesntExist();
    }
}
