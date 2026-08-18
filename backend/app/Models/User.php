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
        'account_status', 'setup_completed', 'valid_id_proof', 'valid_id_proof_back', 'valid_id_type', 'selfie_with_id_proof',
        'ban_reason', 'banned_at',
        'blood_type', 'allergies', 'medical_conditions', 'pwd_status',
        'false_alarm_strikes',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'setup_completed' => 'boolean',
    ];
}
