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

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
