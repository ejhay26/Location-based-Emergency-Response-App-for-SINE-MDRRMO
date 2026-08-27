<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'users';
    protected $primaryKey = 'user_id';
    public $timestamps = false;

    protected $fillable = [
        'first_name', 'last_name', 'phone', 'username', 'birthdate',
        'email', 'password', 'barangay_id', 'role', 'profile_picture',
        'account_status', 'setup_completed',
        'ban_reason', 'banned_at',
        'false_alarm_strikes',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'setup_completed' => 'boolean',
    ];

    protected $appends = [
        'valid_id_type',
        'valid_id_number',
        'valid_id_expiry',
        'valid_id_details',
        'valid_id_proof',
        'valid_id_proof_back',
        'selfie_with_id_proof',
        'blood_type',
        'allergies',
        'medical_conditions',
        'pwd_status',
    ];

    // ── Relationships ───────────────────────────────────────────────────

    public function verification()
    {
        return $this->hasOne(UserVerification::class, 'user_id', 'user_id')->latestOfMany();
    }

    public function verifications()
    {
        return $this->hasMany(UserVerification::class, 'user_id', 'user_id');
    }

    public function medicalProfile()
    {
        return $this->hasOne(UserMedicalProfile::class, 'user_id', 'user_id');
    }

    // ── Backwards-Compatible Accessors ─────────────────────────────────

    public function getValidIdTypeAttribute()
    {
        return $this->verification?->valid_id_type;
    }

    public function getValidIdNumberAttribute()
    {
        return $this->verification?->valid_id_number;
    }

    public function getValidIdExpiryAttribute()
    {
        return $this->verification?->valid_id_expiry;
    }

    public function getValidIdDetailsAttribute()
    {
        return $this->verification?->valid_id_details;
    }

    public function getValidIdProofAttribute()
    {
        return $this->verification?->valid_id_proof;
    }

    public function getValidIdProofBackAttribute()
    {
        return $this->verification?->valid_id_proof_back;
    }

    public function getSelfieWithIdProofAttribute()
    {
        return $this->verification?->selfie_with_id_proof;
    }

    public function getBloodTypeAttribute()
    {
        return $this->medicalProfile?->blood_type;
    }

    public function getAllergiesAttribute()
    {
        return $this->medicalProfile?->allergies;
    }

    public function getMedicalConditionsAttribute()
    {
        return $this->medicalProfile?->medical_conditions;
    }

    public function getPwdStatusAttribute()
    {
        return $this->medicalProfile?->pwd_status;
    }
}
