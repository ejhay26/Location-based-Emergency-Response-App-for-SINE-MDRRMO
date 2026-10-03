<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * barangays table: barangay_id (PK), barangay_name only — static reference
 * data (9 seeded rows), no timestamps.
 */
class Barangay extends Model
{
    protected $table = 'barangays';
    protected $primaryKey = 'barangay_id';
    public $timestamps = false;

    protected $fillable = ['barangay_name'];

    public function broadcasts(): BelongsToMany
    {
        return $this->belongsToMany(Broadcast::class, 'broadcast_barangays', 'barangay_id', 'broadcast_id');
    }
}
