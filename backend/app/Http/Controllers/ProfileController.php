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
            'user_id' => 'required',
            'image'   => 'required|string',
        ]);

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

        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        // Store new file FIRST, then delete old — avoids broken state on failure.
        $ext      = $this->mimeToExtension($mime);
        $fileName = $this->makeFilename('profile', $user->user_id, $ext);
        $filePath = 'profiles/' . $user->user_id . '/' . $fileName;
        $this->storePublic($filePath, $image_base64);

        // Only delete old file after new one is safely written.
        if ($user->profile_picture && str_starts_with($user->profile_picture, 'storage/')) {
            $oldDiskPath = substr($user->profile_picture, strlen('storage/'));
            if (Storage::disk('public')->exists($oldDiskPath)) {
                Storage::disk('public')->delete($oldDiskPath);
            }
        }

        $user->profile_picture = 'storage/' . $filePath;
        $user->save();

        return response()->json(['message' => 'Photo updated!', 'user' => $user->fresh()]);
    }

    public function updateMedicalProfile(Request $request)
    {
        $request->validate(['user_id' => 'required']);
        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) return response()->json(['message' => 'User not found'], 404);
        $user->blood_type         = $request->blood_type         ?? null;
        $user->allergies          = $request->allergies          ?? null;
        $user->medical_conditions = $request->medical_conditions ?? null;
        $user->pwd_status         = $request->pwd_status         ?? null;
        $user->save();
        return response()->json(['message' => 'Medical profile updated successfully!', 'user' => $user->fresh()]);
    }

    public function savePushToken(Request $request)
    {
        $request->validate([
            'user_id'  => 'required|integer',
            'token'    => 'required|string',
            'platform' => 'nullable|string|in:android,ios',
        ]);
        DeviceToken::updateOrCreate(
            ['token' => $request->token],
            ['user_id' => $request->user_id, 'platform' => $request->platform ?? 'android', 'created_at' => now()]
        );
        return response()->json(['message' => 'Token saved.']);
    }
}
