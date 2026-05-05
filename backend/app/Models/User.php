<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    // Tell Laravel exactly which table and primary key to use
    protected $table = 'users';
    protected $primaryKey = 'user_id';
    
    // Disable default timestamps since your table doesn't use created_at/updated_at
    public $timestamps = false;

    // Allow these fields to be filled via the API
    protected $fillable = [
        'first_name',
        'last_name',
        'phone',
        'email',
        'password',
        'barangay_id',
    ];

    // Hide the password when sending data back to Ionic
    protected $hidden = [
        'password',
    ];
}