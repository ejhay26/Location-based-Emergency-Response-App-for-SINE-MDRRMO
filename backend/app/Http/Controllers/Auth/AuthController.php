<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use App\Models\User;
use App\Services\PhilSmsService;
use App\Services\OtpService;
use App\Support\PhoneNumber;
use App\Rules\CommonRules;
use App\Mail\OtpMail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Cache;

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
        private PhilSmsService $sms,
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

        // Normalize once, up front — every lookup, cache key, and outbound
        // SMS below uses this canonical value, never $request->phone raw.
        $normalizedPhone = $channel === 'phone' ? PhoneNumber::normalize($request->phone) : null;
        if ($channel === 'phone' && $normalizedPhone === null) {
            return response()->json(['message' => 'Please enter a valid Philippine mobile number.'], 422);
        }

        $user = $channel === 'phone'
            ? User::where('phone', $normalizedPhone)->first()
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
        $result     = $this->otp->requestOtp($cacheKey);
        // Enumeration-safe: a blocked (already-pending / rate-capped) request
        // returns the exact same response as a real send — no distinct
        // status, message, or retry_after — so probing this endpoint twice
        // can't be used to infer whether the account exists (see
        // forgotPassword() below for the fuller rationale).
        if (isset($result['blocked'])) {
            return response()->json(['message' => 'If that account exists, an OTP was sent.'], 200);
        }
        $otp = $result['otp'];

        if ($channel === 'phone') {
            $sent = $this->sms->sendOtp($user->phone, (string) $otp, 'logging in');
            if (!$sent) {
                return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
            }
        } else {
            Mail::to($user->email)->send(new OtpMail($otp, 'logging in'));
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
        // Must normalize identically to how loginSendOtp derived its cache
        // key (from $user->phone, which is always canonical since every
        // write path normalizes before saving) — otherwise a request typed
        // in a different shape than what's stored would build a different
        // cache key and verification would fail even with the right OTP.
        $normalizedPhone = $channel === 'phone' ? PhoneNumber::normalize($request->phone) : null;
        $identifier = $channel === 'phone' ? $normalizedPhone : $request->email;
        $cacheKey   = 'login_otp_' . $channel . '_' . $identifier;

        if (!$identifier || !$this->otp->verify($cacheKey, $request->otp)) {
            return response()->json(['message' => 'Invalid or expired code.'], 400);
        }

        $user = $channel === 'phone'
            ? User::where('phone', $normalizedPhone)->first()
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
            // Deliberately identical whether the account doesn't exist or the
            // password is wrong — a distinct "no account found" message would
            // let an attacker enumerate registered emails/usernames, which
            // matters more here than most apps given accounts are tied to
            // verified government ID + selfie data.
            return response()->json(['message' => 'Invalid email or password.'], 401);
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
            'valid_id_image'      => 'required|string',
            'valid_id_image_back' => 'required|string',
            'valid_id_type'  => 'required|string',
            'selfie_with_id_image' => 'required|string',
        ]);

        $normalizedPhone = PhoneNumber::normalize($request->phone);
        if ($normalizedPhone === null) {
            return response()->json(['message' => 'Please enter a valid Philippine mobile number.'], 422);
        }

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

        $idBack_base64 = $this->decodeBase64($request->valid_id_image_back);
        if ($idBack_base64 === false) {
            return response()->json(['message' => 'Your ID (back) photo failed to process. Please retake it and try again.'], 422);
        }
        if (!$this->checkSize($idBack_base64, 'id')) {
            return response()->json(['message' => 'ID (back) photo is too large. Maximum is 10 MB.'], 422);
        }
        $idBackMime = $this->detectMime($idBack_base64);
        if ($idBackMime === null || $idBackMime === 'video/mp4') {
            return response()->json(['message' => 'ID (back) photo must be a PNG or JPEG image.'], 422);
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
        $idUrl      = $this->storePublic($idPath, $id_base64);

        $idBackExt      = $this->mimeToExtension($idBackMime);
        $idBackFileName = 'id_back_' . now()->format('YmdHis') . '_' . uniqid() . '.' . $idBackExt;
        $idBackPath     = 'verification_ids/' . $request->username . '/' . $idBackFileName;
        $idBackUrl      = $this->storePublic($idBackPath, $idBack_base64);

        $selfieExt      = $this->mimeToExtension($selfieMime);
        $selfieFileName = 'selfie_' . now()->format('YmdHis') . '_' . uniqid() . '.' . $selfieExt;
        $selfiePath     = 'verification_ids/' . $request->username . '/' . $selfieFileName;
        $selfieUrl      = $this->storePublic($selfiePath, $selfie_base64);

        $user = User::create([
            'first_name'     => $request->first_name,
            'last_name'      => $request->last_name,
            'phone'          => $normalizedPhone,
            'birthdate'      => $request->birthdate,
            'username'       => $request->username,
            'email'          => $request->email,
            'password'       => Hash::make($request->password),
            'barangay_id'    => $request->barangay_id,
            'role'           => 'citizen',
            'account_status' => 'unverified',
            'valid_id_proof' => $idUrl,
            'valid_id_proof_back' => $idBackUrl,
            'valid_id_type'  => $request->valid_id_type,
            'selfie_with_id_proof' => $selfieUrl,
        ]);

        $channel = $request->input('otp_channel', 'email');
        $otp     = $this->otp->generateAndStore('otp_' . $user->email);

        if ($channel === 'sms') {
            $sent = $this->sms->sendOtp($user->phone, (string) $otp, 'account registration');
            if (!$sent) {
                return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
            }
        } else {
            Mail::to($user->email)->send(new OtpMail($otp, 'verifying your new account'));
        }

        return response()->json(['message' => 'Verification code sent.']);
    }

    /**
     * Resend the registration-verification OTP. Deliberately separate from
     * register() itself — register() creates the User row, which can only
     * happen once (unique email/username); resend just needs to look the
     * pending row up and re-issue a code against the same cache key
     * verifyOtp() already checks ('otp_' . email), so a resent code
     * verifies through the exact same path as the original one.
     */
    public function resendRegistrationOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->where('account_status', 'unverified')->first();
        // Enumeration-safe: identical response whether or not a pending
        // registration exists for this email.
        if (!$user) {
            return response()->json(['message' => 'If a pending registration exists, a new code was sent.']);
        }

        $result = $this->otp->requestOtp('otp_' . $user->email);
        // Enumeration-safe (see forgotPassword() below): identical response
        // whether blocked or actually sent.
        if (isset($result['blocked'])) {
            return response()->json(['message' => 'If a pending registration exists, a new code was sent.']);
        }
        $otp     = $result['otp'];
        $channel = $request->input('otp_channel', 'email');

        if ($channel === 'sms') {
            $sent = $this->sms->sendOtp($user->phone, (string) $otp, 'account registration');
            if (!$sent) {
                return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
            }
        } else {
            Mail::to($user->email)->send(new OtpMail($otp, 'verifying your new account'));
        }

        return response()->json(['message' => 'If a pending registration exists, a new code was sent.']);
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
        $normalizedPhone = $channel === 'phone' ? PhoneNumber::normalize($request->phone) : null;
        if ($channel === 'phone' && $normalizedPhone === null) {
            // Same enumeration-safe response as "account not found" — an
            // invalid phone shape shouldn't reveal anything about whether
            // it would have matched an account.
            return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
        }
        $user    = $channel === 'email'
            ? User::where('email', $request->email)->first()
            : User::where('phone', $normalizedPhone)->first();
        if (!$user) return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
        $cacheKey = 'reset_otp_' . $channel . '_' . ($channel === 'email' ? $request->email : $normalizedPhone);
        $result   = $this->otp->requestOtp($cacheKey);
        // Enumeration-safe by design: a blocked request (already-pending code,
        // or the per-identifier hourly cap hit) returns the EXACT same 200 +
        // generic message as a real send — same status, same wording, no
        // retry_after. If we instead returned a distinct 429 here, sending
        // the same identifier twice in a row would let a caller tell real
        // accounts (429 on the 2nd try) from fake ones (always 200) apart,
        // which defeats the enumeration protection above this block. The
        // trade-off: a legitimate user who resends before their real
        // cooldown expires just sees another "sent" toast with no new code
        // actually going out — their frontend's own optimistic countdown is
        // what actually prevents them spamming the button while the page
        // stays open; a page refresh or a second tab can silently no-op
        // once. Same pattern applied in loginSendOtp() and
        // resendRegistrationOtp() above. sendPasswordChangeOtp()
        // (PasswordController) is exempt from this — it's behind
        // auth:sanctum, so there's no anonymous account existence to
        // protect, and returns a real 429 + retry_after instead.
        if (isset($result['blocked'])) {
            return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
        }
        $otp = $result['otp'];
        if ($channel === 'phone') {
            $sent = $this->sms->sendOtp($normalizedPhone, (string) $otp, 'resetting your password');
            if (!$sent) return response()->json(['message' => 'Failed to send SMS OTP. Try email instead.'], 500);
        } else {
            Mail::to($request->email)->send(new OtpMail($otp, 'resetting your password'));
        }
        return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
    }

    /**
     * Verify-only step for the forgot-password flow — confirms the OTP is
     * correct and marks a short-lived "verified" flag, without changing the
     * password yet. Mirrors PasswordController::verifyPasswordChangeOtp's
     * verify-then-flag pattern so resetPassword() below only has to trust
     * the flag (like updatePassword() trusts pwd_change_verified_) instead
     * of re-validating the OTP itself — this lets the frontend show the new
     * password fields only after a real verified code, not just a
     * client-side length check.
     */
    public function verifyResetOtp(Request $request)
    {
        $request->validate([
            'otp_channel' => 'required|in:email,phone',
            'email'       => 'required_if:otp_channel,email|email',
            'phone'       => 'required_if:otp_channel,phone|string',
            'otp'         => 'required|numeric',
        ]);
        $channel = $request->otp_channel;
        $normalizedPhone = $channel === 'phone' ? PhoneNumber::normalize($request->phone) : null;
        $identifier = $channel === 'email' ? $request->email : $normalizedPhone;
        $cacheKey   = 'reset_otp_' . $channel . '_' . $identifier;
        if (!$identifier || !$this->otp->verify($cacheKey, $request->otp)) {
            return response()->json(['message' => 'Invalid or expired OTP'], 400);
        }
        Cache::put('reset_verified_' . $channel . '_' . $identifier, true, now()->addMinutes(5));
        return response()->json(['message' => 'OTP verified.']);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'otp_channel'  => 'required|in:email,phone',
            'email'        => 'required_if:otp_channel,email|email',
            'phone'        => 'required_if:otp_channel,phone|string',
            'new_password' => CommonRules::strongPassword(),
        ]);
        $channel    = $request->otp_channel;
        $normalizedPhone = $channel === 'phone' ? PhoneNumber::normalize($request->phone) : null;
        $identifier = $channel === 'email' ? $request->email : $normalizedPhone;
        if (!$identifier || !Cache::get('reset_verified_' . $channel . '_' . $identifier)) {
            return response()->json(['message' => 'Identity verification required before resetting password.'], 403);
        }
        $user = $channel === 'email'
            ? User::where('email', $request->email)->first()
            : User::where('phone', $normalizedPhone)->first();
        if (!$user) return response()->json(['message' => 'Invalid or expired OTP'], 400);
        $user->password = Hash::make($request->new_password);
        $user->save();
        Cache::forget('reset_verified_' . $channel . '_' . $identifier);
        return response()->json(['message' => 'Password reset successfully!']);
    }
}
