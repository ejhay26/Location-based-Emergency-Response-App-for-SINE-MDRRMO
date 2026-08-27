<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserVerification extends Model
{
    protected $table = 'user_verifications';
    protected $primaryKey = 'verification_id';
    public $timestamps = true;

    protected $fillable = [
        'user_id',
        'valid_id_type',
        'valid_id_number',
        'valid_id_expiry',
        'valid_id_details',
        'valid_id_proof',
        'valid_id_proof_back',
        'selfie_with_id_proof',
        'verification_status',
        'rejection_reason',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'valid_id_details' => 'array',
        'valid_id_expiry'  => 'date',
        'reviewed_at'      => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }
}
