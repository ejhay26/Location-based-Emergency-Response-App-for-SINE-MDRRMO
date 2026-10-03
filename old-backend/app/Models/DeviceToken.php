<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * device_tokens table: id (PK), user_id, token, platform, created_at only
 * (no updated_at column) — timestamps must stay off. `token` has a UNIQUE
 * constraint, matching the updateOrInsert(['token' => ...]) upsert pattern
 * already used in AuthController::savePushToken.
 */
class DeviceToken extends Model
{
    protected $table = 'device_tokens';
    public $timestamps = false;

    protected $fillable = ['user_id', 'token', 'platform', 'created_at'];
}
