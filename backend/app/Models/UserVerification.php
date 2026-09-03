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

    /**
     * Ensure any empty string or whitespace passed for valid_id_expiry
     * is converted to NULL before reaching MySQL's strict DATE column.
     */
    public function setValidIdExpiryAttribute($value): void
    {
        $this->attributes['valid_id_expiry'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setValidIdNumberAttribute($value): void
    {
        $this->attributes['valid_id_number'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setValidIdDetailsAttribute($value): void
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '' || $trimmed === 'null') {
                $this->attributes['valid_id_details'] = null;
                return;
            }
            $decoded = json_decode($trimmed, true);
            $this->attributes['valid_id_details'] = $decoded !== null ? json_encode($decoded) : null;
            return;
        }
        $this->attributes['valid_id_details'] = (!empty($value) && (is_array($value) || is_object($value))) ? json_encode($value) : null;
    }

    public function setRejectionReasonAttribute($value): void
    {
        $this->attributes['rejection_reason'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setReviewedByAttribute($value): void
    {
        $this->attributes['reviewed_by'] = (!empty($value) && is_numeric($value)) ? (int) $value : null;
    }

    public function setReviewedAtAttribute($value): void
    {
        $this->attributes['reviewed_at'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }
}
