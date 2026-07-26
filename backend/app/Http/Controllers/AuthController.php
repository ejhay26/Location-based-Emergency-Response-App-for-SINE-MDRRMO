<?php

namespace App\Http\Controllers;

use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use App\Models\User;
use App\Services\SemaphoreService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    use MediaHandling;

    private SemaphoreService $semaphore;

    public function __construct(SemaphoreService $semaphore)
    {
        $this->semaphore = $semaphore;
    }

    // ── File storage structure ────────────────────────────────────────────────
    // profiles/          → profile pictures   (public disk, old deleted on update)
    // verification_ids/  → ID proofs          (private disk, admin-only retrieval)
    // reports/sos/       → SOS proof files    (public disk, permanent)
    // reports/hazard/    → hazard proof files  (public disk, permanent)
    // ─────────────────────────────────────────────────────────────────────────

    public function loginSendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $user = User::where('email', $request->email)->first();
        // Always return the same message to avoid email enumeration.
        if (!$user || $user->account_status === 'banned') {
            return response()->json(['message' => 'If that email exists, an OTP was sent.'], 200);
        }
        if ($user->account_status === 'unverified') {
            return response()->json(['message' => 'Your account is pending admin verification.'], 403);
        }
        $otp = rand(1000, 9999);
        Cache::put('login_otp_' . $user->email, $otp, now()->addMinutes(10));
        Mail::raw("Your MDRRMO San Isidro login code is: {$otp}. It expires in 10 minutes.", function ($m) use ($user) {
            $m->to($user->email)->subject('Login Verification Code');
        });
        return response()->json(['message' => 'If that email exists, an OTP was sent.']);
    }

    public function loginVerifyOtp(Request $request)
    {
        $request->validate(['email' => 'required|email', 'otp' => 'required|numeric']);
        $cached = Cache::get('login_otp_' . $request->email);
        if (!$cached || $cached != $request->otp) {
            return response()->json(['message' => 'Invalid or expired code.'], 400);
        }
        Cache::forget('login_otp_' . $request->email);
        $user = User::where('email', $request->email)->first();
        if (!$user) return response()->json(['message' => 'Invalid or expired code.'], 400);
        $user->tokens()->delete();
        $abilities = match ($user->role) {
            'admin'      => ['admin', 'dispatcher', 'citizen'],
            'dispatcher' => ['dispatcher'],
            default      => ['citizen'],
        };
        $token = $user->createToken('app-token', $abilities)->plainTextToken;
        return response()->json([
            'message' => 'Login successful',
            'token'   => $token,
            'user'    => $user->fresh(),
            'role'    => $user->role,
        ]);
    }

    public function login(Request $request)
    {
        $request->validate(['login' => 'required', 'password' => 'required']);

        $throttleKey = 'login_attempts|' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json(['message' => "Too many attempts. Please try again in {$seconds} seconds."], 429);
        }

        $fieldType = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user = User::where($fieldType, $request->login)->first();

        if ($user && $user->account_status === 'unverified') {
            return response()->json(['message' => 'Your account registration is currently pending admin verification review.'], 403);
        }
        if ($user && $user->account_status === 'banned') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }
        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, 60);
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        RateLimiter::clear($throttleKey);
        $user->tokens()->delete();

        $abilities = match ($user->role) {
            'admin'      => ['admin', 'dispatcher', 'citizen'],
            'dispatcher' => ['dispatcher'],
            default      => ['citizen'],
        };

        $token = $user->createToken('app-token', $abilities)->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'token'   => $token,
            'user'    => $user->fresh(),
            'role'    => $user->role,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function register(Request $request)
    {
        $request->validate([
            'first_name'     => 'required|string',
            'last_name'      => 'required|string',
            'phone'          => 'required|string',
            'birthdate'      => 'required|date',
            'username'       => 'required|string|unique:users',
            'email'          => 'required|email|unique:users',
            'password'       => ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'],
            'barangay_id'    => 'required|integer',
            'valid_id_image' => 'required|string',
        ]);

        $id_base64 = $this->decodeBase64($request->valid_id_image);
        if ($id_base64 === false) {
            return response()->json(['message' => 'Your ID photo failed to process. Please retake it and try again.'], 422);
        }
        if (!$this->checkSize($id_base64, 'id')) {
            return response()->json(['message' => 'ID photo is too large. Maximum is 10 MB.'], 422);
        }
        $mime = $this->detectMime($id_base64);
        if ($mime === null || $mime === 'video/mp4') {
            return response()->json(['message' => 'ID photo must be a PNG or JPEG image.'], 422);
        }

        // Store ID proof on the PUBLIC disk for now.
        // TODO: Switch to storePrivate() once private retrieval endpoint is set up.
        $ext        = $this->mimeToExtension($mime);
        $idFileName = 'id_' . now()->format('YmdHis') . '_' . uniqid() . '.' . $ext;
        $idPath     = 'verification_ids/' . $request->username . '/' . $idFileName;
        $this->storePublic($idPath, $id_base64);

        $user = User::create([
            'first_name'     => $request->first_name,
            'last_name'      => $request->last_name,
            'phone'          => $request->phone,
            'birthdate'      => $request->birthdate,
            'username'       => $request->username,
            'email'          => $request->email,
            'password'       => Hash::make($request->password),
            'barangay_id'    => $request->barangay_id,
            'role'           => 'citizen',
            'account_status' => 'unverified',
            'valid_id_proof' => 'storage/' . $idPath,
        ]);

        $otp     = rand(1000, 9999);
        $channel = $request->input('otp_channel', 'email');
        Cache::put('otp_' . $user->email, $otp, now()->addMinutes(10));

        if ($channel === 'sms') {
            $sent = $this->semaphore->sendOtp($user->phone, (string) $otp);
            if (!$sent) {
                return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
            }
        } else {
            Mail::to($user->email)->send(new \App\Mail\OtpMail($otp));
        }

        return response()->json(['message' => 'Verification code sent.']);
    }

    public function checkUsername(Request $request)
    {
        $exists = User::where('username', $request->query('username'))->exists();
        return response()->json(['available' => !$exists]);
    }

    public function checkEmail(Request $request)
    {
        $exists = User::where('email', $request->query('email'))->exists();
        return response()->json(['available' => !$exists]);
    }

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

    public function sendPasswordChangeOtp(Request $request)
    {
        $request->validate(['user_id' => 'required|integer', 'channel' => 'required|in:email,phone']);
        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) return response()->json(['message' => 'User not found.'], 404);
        $otp = rand(1000, 9999);
        Cache::put('pwd_change_otp_' . $request->user_id, $otp, now()->addMinutes(10));
        if ($request->channel === 'phone') {
            $sent = $this->semaphore->sendOtp($user->phone, (string) $otp);
            if (!$sent) return response()->json(['message' => 'Failed to send SMS OTP.'], 500);
        } else {
            Mail::raw("Your MDRRMO San Isidro Password Change Code is: {$otp}. It will expire in 10 minutes.", function ($m) use ($user) {
                $m->to($user->email)->subject('Password Change Verification');
            });
        }
        return response()->json(['message' => 'Verification code sent.']);
    }

    public function verifyPasswordChangeOtp(Request $request)
    {
        $request->validate(['user_id' => 'required|integer', 'otp' => 'required|numeric']);
        $cachedOtp = Cache::get('pwd_change_otp_' . $request->user_id);
        if ($cachedOtp && $cachedOtp == $request->otp) {
            Cache::forget('pwd_change_otp_' . $request->user_id);
            Cache::put('pwd_change_verified_' . $request->user_id, true, now()->addMinutes(5));
            return response()->json(['message' => 'OTP verified.']);
        }
        return response()->json(['message' => 'Invalid or expired OTP.'], 400);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'user_id'      => 'required',
            'new_password' => ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'],
        ]);
        if (!Cache::get('pwd_change_verified_' . $request->user_id)) {
            return response()->json(['message' => 'Identity verification required before changing password.'], 403);
        }
        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) return response()->json(['message' => 'User not found.'], 404);
        $user->password = Hash::make($request->new_password);
        $user->save();
        Cache::forget('pwd_change_verified_' . $request->user_id);
        return response()->json(['message' => 'Password updated successfully!']);
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

    public function getCitizens(Request $request)
    {
        $query = User::where('role', 'citizen');
        if ($request->filled('search')) {
            $term = $request->query('search');
            $query->where(function ($q) use ($term) {
                $q->where('first_name', 'like', "%{$term}%")
                  ->orWhere('last_name',  'like', "%{$term}%")
                  ->orWhere('username',   'like', "%{$term}%")
                  ->orWhere('email',      'like', "%{$term}%")
                  ->orWhere('phone',      'like', "%{$term}%");
            });
        }
        if ($request->filled('status')) {
            $query->where('account_status', $request->query('status'));
        }
        return response()->json(
            $query->orderBy('created_at', 'desc')
                  ->get(['user_id','first_name','last_name','username','email','phone',
                         'barangay_id','account_status','ban_reason','banned_at',
                         'created_at','profile_picture','false_alarm_strikes'])
        );
    }

    public function suspendCitizen(Request $request)
    {
        $request->validate(['user_id' => 'required|integer', 'reason' => 'required|string|max:500']);
        $user = User::where('user_id', $request->user_id)->where('role', 'citizen')->first();
        if (!$user) return response()->json(['message' => 'Citizen not found.'], 404);
        $user->account_status = 'banned';
        $user->ban_reason     = $request->reason;
        $user->banned_at      = now();
        $user->save();
        $user->tokens()->delete();
        return response()->json(['message' => 'Account suspended.', 'user' => $user->fresh()]);
    }

    public function reactivateCitizen(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        $user = User::where('user_id', $request->user_id)->where('role', 'citizen')->first();
        if (!$user) return response()->json(['message' => 'Citizen not found.'], 404);
        $user->account_status = 'active';
        $user->ban_reason     = null;
        $user->banned_at      = null;
        $user->save();
        return response()->json(['message' => 'Account reactivated.', 'user' => $user->fresh()]);
    }

    public function getDispatchers()
    {
        return response()->json(
            User::where('role', 'dispatcher')->orderBy('created_at', 'desc')
                ->get(['user_id','first_name','last_name','username','email',
                       'phone','barangay_id','account_status','created_at','profile_picture'])
        );
    }

    public function getPendingVerifications()
    {
        return response()->json(
            User::where('account_status', 'unverified')->orderBy('created_at', 'desc')->get()
        );
    }

    public function approveUser(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        User::where('user_id', $request->user_id)->update(['account_status' => 'active']);
        return response()->json(['message' => 'User approved successfully.']);
    }

    public function rejectUser(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        $user = User::where('user_id', $request->user_id)->first();
        if ($user && $user->valid_id_proof) {
            Storage::disk('public')->deleteDirectory(
                'verification_ids/' . $user->username
            );
        }
        User::where('user_id', $request->user_id)->delete();
        return response()->json(['message' => 'User request rejected and deleted.']);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate(['email' => 'required|email', 'otp' => 'required|numeric']);
        $cachedOtp = Cache::get('otp_' . $request->email);
        if ($cachedOtp && $cachedOtp == $request->otp) {
            Cache::forget('otp_' . $request->email);
            $user = User::where('email', $request->email)->first();
            return response()->json([
                'message' => 'Verification successful',
                'user'    => $user->fresh(),
                'role'    => $user->role,
            ]);
        }
        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }

    public function createDispatcher(Request $request)
    {
        $request->validate([
            'first_name'  => 'required|string',
            'last_name'   => 'required|string',
            'phone'       => 'required|string',
            'username'    => 'required|string|unique:users',
            'email'       => 'required|email|unique:users',
            'password'    => 'required|min:6',
            'barangay_id' => 'required|integer',
        ]);
        User::create([
            'first_name'     => $request->first_name,
            'last_name'      => $request->last_name,
            'phone'          => $request->phone,
            'username'       => $request->username,
            'email'          => $request->email,
            'password'       => Hash::make($request->password),
            'barangay_id'    => $request->barangay_id,
            'role'           => 'dispatcher',
            'account_status' => 'active',
        ]);
        return response()->json(['message' => 'Dispatcher created successfully!'], 201);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'otp_channel' => 'required|in:email,phone',
            'email'       => 'required_if:otp_channel,email|email',
            'phone'       => 'required_if:otp_channel,phone|string',
        ]);
        $channel = $request->otp_channel;
        $user    = $channel === 'email'
            ? User::where('email', $request->email)->first()
            : User::where('phone', $request->phone)->first();
        if (!$user) return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
        $otp      = rand(1000, 9999);
        $cacheKey = 'reset_otp_' . $channel . '_' . ($channel === 'email' ? $request->email : $request->phone);
        Cache::put($cacheKey, $otp, now()->addMinutes(10));
        if ($channel === 'phone') {
            $sent = $this->semaphore->sendOtp($request->phone, (string) $otp);
            if (!$sent) return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
        } else {
            Mail::raw("Your MDRRMO San Isidro Password Reset Code is: {$otp}. It will expire in 10 minutes.", function ($m) use ($request) {
                $m->to($request->email)->subject('Password Reset Request');
            });
        }
        return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'otp_channel'  => 'required|in:email,phone',
            'email'        => 'required_if:otp_channel,email|email',
            'phone'        => 'required_if:otp_channel,phone|string',
            'otp'          => 'required|numeric',
            'new_password' => ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'],
        ]);
        $channel    = $request->otp_channel;
        $identifier = $channel === 'email' ? $request->email : $request->phone;
        $cacheKey   = 'reset_otp_' . $channel . '_' . $identifier;
        $cachedOtp  = Cache::get($cacheKey);
        if ($cachedOtp && $cachedOtp == $request->otp) {
            $user = $channel === 'email'
                ? User::where('email', $request->email)->first()
                : User::where('phone', $request->phone)->first();
            if (!$user) return response()->json(['message' => 'Invalid or expired OTP'], 400);
            $user->password = Hash::make($request->new_password);
            $user->save();
            Cache::forget($cacheKey);
            return response()->json(['message' => 'Password reset successfully!']);
        }
        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }

    public function savePushToken(Request $request)
    {
        $request->validate([
            'user_id'  => 'required|integer',
            'token'    => 'required|string',
            'platform' => 'nullable|string|in:android,ios',
        ]);
        DB::table('device_tokens')->updateOrInsert(
            ['token'   => $request->token],
            ['user_id' => $request->user_id, 'platform' => $request->platform ?? 'android', 'created_at' => now()]
        );
        return response()->json(['message' => 'Token saved.']);
    }
}
