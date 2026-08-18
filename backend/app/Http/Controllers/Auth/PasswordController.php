<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Services\PhilSmsService;
use App\Services\OtpService;
use App\Rules\CommonRules;
use App\Mail\OtpMail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;

/**
 * Password change for an already-logged-in user: send/verify an OTP to
 * confirm identity, then submit the new password within the 5-minute
 * verified window. Distinct from AuthController's forgot/reset flow,
 * which doesn't require an existing session.
 */
class PasswordController extends Controller
{
    public function __construct(
        private PhilSmsService $sms,
        private OtpService $otp
    ) {
    }

    public function sendPasswordChangeOtp(Request $request)
    {
        $request->validate(['user_id' => 'required|integer', 'channel' => 'required|in:email,phone']);
        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) return response()->json(['message' => 'User not found.'], 404);

        $result = $this->otp->requestOtp('pwd_change_otp_' . $request->user_id);
        if (isset($result['blocked'])) {
            if ($result['blocked'] === 'cooldown') {
                return response()->json([
                    'message'     => "A code was already sent — check your inbox or wait {$result['retry_after']}s before requesting another.",
                    'retry_after' => $result['retry_after'],
                ], 429);
            }
            return response()->json(['message' => 'Too many code requests. Please try again later.'], 429);
        }
        $otp = $result['otp'];

        if ($request->channel === 'phone') {
            $sent = $this->sms->sendOtp($user->phone, (string) $otp, 'changing your password');
            if (!$sent) return response()->json(['message' => 'Failed to send SMS OTP.'], 500);
        } else {
            Mail::to($user->email)->send(new OtpMail($otp, 'changing your password'));
        }
        return response()->json(['message' => 'Verification code sent.']);
    }

    public function verifyPasswordChangeOtp(Request $request)
    {
        $request->validate(['user_id' => 'required|integer', 'otp' => 'required|numeric']);
        if ($this->otp->verify('pwd_change_otp_' . $request->user_id, $request->otp)) {
            Cache::put('pwd_change_verified_' . $request->user_id, true, now()->addMinutes(5));
            return response()->json(['message' => 'OTP verified.']);
        }
        return response()->json(['message' => 'Invalid or expired OTP.'], 400);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'user_id'      => 'required',
            'new_password' => CommonRules::strongPassword(),
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
}
