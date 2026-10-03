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
        'save_media_to_device',
        'photo_cropping_enabled',
        'video_trimming_enabled',
    ];

    private const DEFAULTS = [
        'dark_mode'              => 'false',
        'reduce_animations'      => 'false',
        'location_auto_fetch'    => 'true',
        'map_default_style'      => 'street',
        'notif_emergency_alerts' => 'true',
        'notif_broadcast_alerts' => 'true',
        'save_media_to_device'   => 'false',
        'photo_cropping_enabled' => 'true',
        'video_trimming_enabled' => 'true',
    ];

    public function get(Request $request, ?int $user_id = null)
    {
        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $targetId = $user_id ?: $authUser->user_id;
        if ($targetId !== $authUser->user_id && !$authUser->tokenCan('admin') && !$authUser->tokenCan('dispatcher')) {
            return response()->json(['message' => 'Unauthorized to view settings for another user.'], 403);
        }

        $rows = DB::table('user_settings')
            ->where('user_id', $targetId)
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
            'user_id' => 'nullable|integer',
            'key'     => 'required|string|in:' . implode(',', self::ALLOWED_KEYS),
            'value'   => 'required|string|max:255',
        ]);

        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $targetId = $request->user_id ? (int)$request->user_id : $authUser->user_id;
        if ($targetId !== $authUser->user_id && !$authUser->tokenCan('admin')) {
            return response()->json(['message' => 'Unauthorized to modify settings for another user.'], 403);
        }

        DB::table('user_settings')->updateOrInsert(
            ['user_id' => $targetId, 'key' => $request->key],
            ['value' => $request->value, 'updated_at' => now()]
        );

        return response()->json(['message' => 'Setting saved.']);
    }
}
