<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserMedicalProfile extends Model
{
    protected $table = 'user_medical_profiles';
    protected $primaryKey = 'profile_id';
    public $timestamps = true;

    protected $fillable = [
        'user_id',
        'blood_type',
        'allergies',
        'medical_conditions',
        'pwd_status',
    ];

    public function setBloodTypeAttribute($value): void
    {
        $this->attributes['blood_type'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setAllergiesAttribute($value): void
    {
        $this->attributes['allergies'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setMedicalConditionsAttribute($value): void
    {
        $this->attributes['medical_conditions'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setPwdStatusAttribute($value): void
    {
        $this->attributes['pwd_status'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
