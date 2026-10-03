<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserProfile extends Model
{
    protected $table = 'user_profiles';
    protected $primaryKey = 'profile_id';
    public $timestamps = true;

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'username',
        'phone',
        'birthdate',
        'profile_picture',
        'barangay_id',
        'setup_completed',
    ];

    protected $casts = [
        'birthdate'       => 'date',
        'setup_completed' => 'boolean',
    ];

    /** Prevent MySQL strict mode errors by converting empty string/whitespace to NULL. */
    public function setBirthdateAttribute($value): void
    {
        $this->attributes['birthdate'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setBarangayIdAttribute($value): void
    {
        $this->attributes['barangay_id'] = (!empty($value) && is_numeric($value)) ? (int) $value : null;
    }

    public function setPhoneAttribute($value): void
    {
        $this->attributes['phone'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setFirstNameAttribute($value): void
    {
        $this->attributes['first_name'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function setLastNameAttribute($value): void
    {
        $this->attributes['last_name'] = (!empty($value) && trim((string) $value) !== '') ? trim($value) : null;
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class, 'barangay_id', 'barangay_id');
    }
}
