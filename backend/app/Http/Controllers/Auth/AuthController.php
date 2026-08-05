<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use App\Models\User;
use App\Services\SemaphoreService;
use App\Services\OtpService;
use App\Rules\CommonRules;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Core authentication: login (password + OTP variants), registration,
 * logout, username/email availability checks, and password-reset request
 * flow (forgot/reset — distinct from the "change password while logged in"
 * flow, which lives in PasswordController).
 */
class AuthController extends Controller
{
    use MediaHandling;

    public function __construct(
        private SemaphoreService $semaphore,
        private OtpService $otp
    ) {
    }

    public function loginSendOtp(Request $request)
    {
        // otp_channel defaults to 'email' so existing callers that only send
        // {email} keep working unchanged; the citizen/admin login screens can
        // now also send {otp_channel: 'phone', phone: ...}, mirroring the
        // forgot-password flow below.
        $request->validate([
            'otp_channel' => 'nullable|in:email,phone',
            'email'       => 'required_if:otp_channel,email|nullable|email',
            'phone'       => 'required_if:otp_channel,phone|nullable|string',
        ]);

        $channel = $request->input('otp_channel', 'email');
        if ($channel === 'phone' && !$request->filled('phone')) {
            return response()->json(['message' => 'Phone number is required.'], 422);
        }
        if ($channel === 'email' && !$request->filled('email')) {
            return response()->json(['message' => 'Email is required.'], 422);
        }

        $user = $channel === 'phone'
            ? User::where('phone', $request->phone)->first()
            : User::where('email', $request->email)->first();

        // Always return the same message to avoid account enumeration.
        if (!$user || $user->account_status === 'banned') {
            return response()->json(['message' => 'If that account exists, an OTP was sent.'], 200);
        }
        if ($user->account_status === 'unverified') {
            return response()->json(['message' => 'Your account is pending admin verification.', 'reason' => 'unverified'], 403);
        }

        $identifier = $channel === 'phone' ? $user->phone : $user->email;
        $cacheKey   = 'login_otp_' . $channel . '_' . $identifier;
        $otp        = $this->otp->generateAndStore($cacheKey);

        if ($channel === 'phone') {
            $sent = $this->semaphore->sendOtp($user->phone, (string) $otp);
            if (!$sent) {
                return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
            }
        } else {
            Mail::raw("Your MDRRMO San Isidro login code is: {$otp}. It expires in 10 minutes.", function ($m) use ($user) {
                $m->to($user->email)->subject('Login Verification Code');
            });
        }

        return response()->json(['message' => 'If that account exists, an OTP was sent.']);
    }

    public function loginVerifyOtp(Request $request)
    {
        $request->validate([
            'otp_channel' => 'nullable|in:email,phone',
            'email'       => 'required_if:otp_channel,email|nullable|email',
            'phone'       => 'required_if:otp_channel,phone|nullable|string',
            'otp'         => 'required|numeric',
        ]);

        $channel    = $request->input('otp_channel', 'email');
        $identifier = $channel === 'phone' ? $request->phone : $request->email;
        $cacheKey   = 'login_otp_' . $channel . '_' . $identifier;

        if (!$identifier || !$this->otp->verify($cacheKey, $request->otp)) {
            return response()->json(['message' => 'Invalid or expired code.'], 400);
        }

        $user = $channel === 'phone'
            ? User::where('phone', $request->phone)->first()
            : User::where('email', $request->email)->first();
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
            return response()->json(['message' => 'Your account registration is currently pending admin verification review.', 'reason' => 'unverified'], 403);
        }
        if ($user && $user->account_status === 'banned') {
            return response()->json(['message' => 'This account has been suspended.', 'reason' => 'banned'], 403);
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
            'password'       => CommonRules::strongPassword(),
            'barangay_id'    => 'required|integer',
            'valid_id_image' => 'required|string',
            'valid_id_type'  => 'required|string',
            'selfie_with_id_image' => 'required|string',
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

        $selfie_base64 = $this->decodeBase64($request->selfie_with_id_image);
        if ($selfie_base64 === false) {
            return response()->json(['message' => 'Your selfie photo failed to process. Please retake it and try again.'], 422);
        }
        if (!$this->checkSize($selfie_base64, 'id')) {
            return response()->json(['message' => 'Selfie photo is too large. Maximum is 10 MB.'], 422);
        }
        $selfieMime = $this->detectMime($selfie_base64);
        if ($selfieMime === null || $selfieMime === 'video/mp4') {
            return response()->json(['message' => 'Selfie photo must be a PNG or JPEG image.'], 422);
        }

        // Store ID proof and selfie-with-ID on the PUBLIC disk for now.
        // TODO: Switch to storePrivate() once private retrieval endpoint is set up.
        $ext        = $this->mimeToExtension($mime);
        $idFileName = 'id_' . now()->format('YmdHis') . '_' . uniqid() . '.' . $ext;
        $idPath     = 'verification_ids/' . $request->username . '/' . $idFileName;
        $this->storePublic($idPath, $id_base64);

        $selfieExt      = $this->mimeToExtension($selfieMime);
        $selfieFileName = 'selfie_' . now()->format('YmdHis') . '_' . uniqid() . '.' . $selfieExt;
        $selfiePath     = 'verification_ids/' . $request->username . '/' . $selfieFileName;
        $this->storePublic($selfiePath, $selfie_base64);

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
            'valid_id_type'  => $request->valid_id_type,
            'selfie_with_id_proof' => 'storage/' . $selfiePath,
        ]);

        $channel = $request->input('otp_channel', 'email');
        $otp     = $this->otp->generateAndStore('otp_' . $user->email);

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

    /**
     * Public, tokenless status check for the Pending Verification screen.
     * Accepts either an email or a username (same lookup logic as login()),
     * since a citizen might reach this screen via the register flow (always
     * has an email) or via the login screen (could be either). Deliberately
     * returns only a bare status string — no user id, tokens, or ID/selfie
     * paths — since this endpoint requires no authentication.
     */
    public function checkVerificationStatus(Request $request)
    {
        $request->validate([
            'email' => 'nullable|email',
            'login' => 'nullable|string',
        ]);

        $identifier = $request->input('email') ?: $request->input('login');
        if (!$identifier) {
            return response()->json(['message' => 'Email or username is required.'], 422);
        }

        $fieldType = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user = User::where($fieldType, $identifier)->first();

        if (!$user) {
            return response()->json(['status' => 'not_found']);
        }

        return response()->json(['status' => $user->account_status]);
    }

    public function checkEmail(Request $request)
    {
        $exists = User::where('email', $request->query('email'))->exists();
        return response()->json(['available' => !$exists]);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate(['email' => 'required|email', 'otp' => 'required|numeric']);
        if ($this->otp->verify('otp_' . $request->email, $request->otp)) {
            $user = User::where('email', $request->email)->first();
            return response()->json([
                'message' => 'Verification successful',
                'user'    => $user->fresh(),
                'role'    => $user->role,
            ]);
        }
        return response()->json(['message' => 'Invalid or expired OTP'], 400);
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
        $cacheKey = 'reset_otp_' . $channel . '_' . ($channel === 'email' ? $request->email : $request->phone);
        $otp      = $this->otp->generateAndStore($cacheKey);
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
            'new_password' => CommonRules::strongPassword(),
        ]);
        $channel    = $request->otp_channel;
        $identifier = $channel === 'email' ? $request->email : $request->phone;
        $cacheKey   = 'reset_otp_' . $channel . '_' . $identifier;
        if ($this->otp->verify($cacheKey, $request->otp)) {
            $user = $channel === 'email'
                ? User::where('email', $request->email)->first()
                : User::where('phone', $request->phone)->first();
            if (!$user) return response()->json(['message' => 'Invalid or expired OTP'], 400);
            $user->password = Hash::make($request->new_password);
            $user->save();
            return response()->json(['message' => 'Password reset successfully!']);
        }
        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }
}
