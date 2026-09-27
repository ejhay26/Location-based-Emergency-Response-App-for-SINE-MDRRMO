<?php

namespace App\Http\Controllers;

use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\DeviceToken;
use Illuminate\Support\Facades\Storage;

/**
 * Self-service profile management: avatar, medical info, and push token
 * registration. Split out of AuthController — these aren't authentication
 * concerns, they're "things a logged-in user manages about themselves."
 */
class ProfileController extends Controller
{
    use MediaHandling;

    public function updateProfilePicture(Request $request)
    {
        $request->validate([
            'user_id' => 'nullable',
            'image'   => 'required|string',
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $image_base64 = $this->decodeBase64($request->image);
        if ($image_base64 === false) {
            return response()->json(['message' => 'Photo failed to process. Please try cropping again.'], 422);
        }
        if (!$this->checkSize($image_base64, 'profile')) {
            return response()->json(['message' => 'Photo is too large. Maximum is 5 MB.'], 422);
        }
        $mime = $this->detectMime($image_base64);
        if ($mime === null || $mime === 'video/mp4') {
            return response()->json(['message' => 'Profile picture must be a PNG or JPEG image.'], 422);
        }

        // Store new file FIRST, then delete old — avoids broken state on failure.
        $ext      = $this->mimeToExtension($mime);
        $fileName = $this->makeFilename('profile', $user->user_id, $ext);
        $filePath = 'profiles/' . $user->user_id . '/' . $fileName;
        $newUrl   = $this->storePublic($filePath, $image_base64);

        // Only delete the old file after the new one is safely written.
        // Two possible shapes for the old value, handled separately:
        //   - legacy local file: "storage/profiles/..." served off the public disk
        //   - current R2 file: a full https://<AWS_URL>/... URL
        $old = $user->profile_picture;
        if ($old && str_starts_with($old, 'storage/')) {
            $oldDiskPath = substr($old, strlen('storage/'));
            if (Storage::disk('public')->exists($oldDiskPath)) {
                Storage::disk('public')->delete($oldDiskPath);
            }
        } elseif ($old) {
            $s3PublicBase = rtrim((string) config('filesystems.disks.s3.url'), '/') . '/';
            if ($s3PublicBase !== '/' && str_starts_with($old, $s3PublicBase)) {
                Storage::disk('s3')->delete(substr($old, strlen($s3PublicBase)));
            }
        }

        $user->profile()->updateOrCreate(
            ['user_id' => $user->user_id],
            ['profile_picture' => $newUrl]
        );

        return response()->json(['message' => 'Photo updated!', 'user' => $user->fresh()]);
    }

    public function updateMedicalProfile(Request $request)
    {
        $request->validate(['user_id' => 'nullable']);
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated.'], 401);

        $user->medicalProfile()->updateOrCreate(
            ['user_id' => $user->user_id],
            [
                'blood_type'         => $request->blood_type         ?? null,
                'allergies'          => $request->allergies          ?? null,
                'medical_conditions' => $request->medical_conditions ?? null,
                'pwd_status'         => $request->pwd_status         ?? null,
            ]
        );

        return response()->json(['message' => 'Medical profile updated successfully!', 'user' => $user->fresh()]);
    }

    /**
     * Marks the first-login account setup flow (profile photo / settings /
     * medical profile / tour offer segments) as done — whether the user
     * actually filled anything in or skipped every segment. Persisted on
     * the user profile (not device localStorage) so it correctly stays
     * dismissed across reinstalls and other devices, and only ever fires
     * once per account. Idempotent: calling it again is a harmless no-op.
     */
    public function completeAccountSetup(Request $request)
    {
        $request->validate(['user_id' => 'nullable']);
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthenticated.'], 401);

        $user->profile()->updateOrCreate(
            ['user_id' => $user->user_id],
            ['setup_completed' => true]
        );

        return response()->json(['message' => 'Setup complete.', 'user' => $user->fresh()]);
    }

    public function savePushToken(Request $request)
    {
        $request->validate([
            'user_id'  => 'nullable|integer',
            'token'    => 'required|string',
            'platform' => 'nullable|string|in:android,ios',
        ]);
        $userId = $request->user()?->user_id ?? $request->user_id;
        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        DeviceToken::updateOrCreate(
            ['token' => $request->token],
            ['user_id' => $userId, 'platform' => $request->platform ?? 'android', 'created_at' => now()]
        );
        return response()->json(['message' => 'Token saved.']);
    }

    /**
     * Deletes only the single device_tokens row matching this exact token
     * (i.e. this device), belonging to the authenticated user.
     * Called on logout so a signed-out device stops receiving push notifications.
     */
    public function deletePushToken(Request $request)
    {
        $request->validate(['token' => 'required|string']);
        $query = DeviceToken::where('token', $request->token);
        if ($request->user()) {
            $query->where('user_id', $request->user()->user_id);
        }
        $query->delete();
        return response()->json(['message' => 'Token removed.']);
    }
}
