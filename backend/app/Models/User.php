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
        'email', 'password', 'role',
        'account_status',
        'ban_reason', 'banned_at',
        'false_alarm_strikes',
    ];

    protected $hidden = ['password'];

    public function setEmailAttribute($value): void
    {
        $this->attributes['email'] = (!empty($value) && trim((string) $value) !== '') ? strtolower(trim((string) $value)) : null;
    }

    public function setBanReasonAttribute($value): void
    {
        $this->attributes['ban_reason'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setBannedAtAttribute($value): void
    {
        $this->attributes['banned_at'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    protected $with = ['profile'];

    protected $appends = [
        'first_name',
        'last_name',
        'username',
        'phone',
        'birthdate',
        'profile_picture',
        'barangay_id',
        'setup_completed',
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

    public function profile()
    {
        return $this->hasOne(UserProfile::class, 'user_id', 'user_id');
    }

    public function verification()
    {
        return $this->hasOne(UserVerification::class, 'user_id', 'user_id')->latestOfMany('verification_id');
    }

    public function verifications()
    {
        return $this->hasMany(UserVerification::class, 'user_id', 'user_id');
    }

    public function medicalProfile()
    {
        return $this->hasOne(UserMedicalProfile::class, 'user_id', 'user_id');
    }

    // ── Demographic Profile Accessors ──────────────────────────────────

    public function getFirstNameAttribute()
    {
        return $this->profile?->first_name;
    }

    public function getLastNameAttribute()
    {
        return $this->profile?->last_name;
    }

    public function getUsernameAttribute()
    {
        return $this->profile?->username;
    }

    public function getPhoneAttribute()
    {
        return $this->profile?->phone;
    }

    public function getBirthdateAttribute()
    {
        return $this->profile?->birthdate;
    }

    public function getProfilePictureAttribute()
    {
        return $this->profile?->profile_picture;
    }

    public function getBarangayIdAttribute()
    {
        return $this->profile?->barangay_id;
    }

    public function getSetupCompletedAttribute()
    {
        return (bool) ($this->profile?->setup_completed ?? false);
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
