<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserSettingsController extends Controller
{
    private const ALLOWED_KEYS = [
        'dark_mode',
        'reduce_animations',
        'location_auto_fetch',
        'map_default_style',
        'notif_emergency_alerts',
        'notif_broadcast_alerts',
    ];

    private const DEFAULTS = [
        'dark_mode'              => 'false',
        'reduce_animations'      => 'false',
        'location_auto_fetch'    => 'true',
        'map_default_style'      => 'street',
        'notif_emergency_alerts' => 'true',
        'notif_broadcast_alerts' => 'true',
    ];

    public function get(int $user_id)
    {
        $rows = DB::table('user_settings')
            ->where('user_id', $user_id)
            ->whereIn('key', self::ALLOWED_KEYS)
            ->get(['key', 'value']);

        $stored = [];
        foreach ($rows as $row) {
            $stored[$row->key] = $row->value;
        }

        return response()->json(array_merge(self::DEFAULTS, $stored));
    }

    public function set(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'key'     => 'required|string|in:' . implode(',', self::ALLOWED_KEYS),
            'value'   => 'required|string|max:255',
        ]);

        DB::table('user_settings')->updateOrInsert(
            ['user_id' => $request->user_id, 'key' => $request->key],
            ['value' => $request->value, 'updated_at' => now()]
        );

        return response()->json(['message' => 'Setting saved.']);
    }
}
