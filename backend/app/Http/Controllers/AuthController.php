<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required',
            'password' => 'required'
        ]);

        $throttleKey = 'login_attempts|' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) { 
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json(['message' => "Too many attempts. Please try again in {$seconds} seconds."], 429);
        }

        $fieldType = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user = User::where($fieldType, $request->login)->first();

        if ($user && $user->account_status === 'banned') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, 60); 
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        RateLimiter::clear($throttleKey); 

        return response()->json([
            'message' => 'Login successful',
            'user' => clone $user,
            'role' => $user->role
        ]);
    }

    public function register(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'phone' => 'required|string',
            'birthdate' => 'required|date',
            'username' => 'required|string|unique:users',
            'email' => 'required|email|unique:users',
            'password' => [
                'required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'
            ],
            'barangay_id' => 'required|integer'
        ]);

        $otp = rand(1000, 9999);
        Cache::put('otp_' . $request->email, $otp, now()->addMinutes(10));

        Mail::raw("Your SINE MDRRMO Verification Code is: {$otp}. It will expire in 10 minutes.", function ($message) use ($request) {
            $message->to($request->email)->subject('MDRRMO Account Verification');
        });

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'phone' => $request->phone,
            'birthdate' => $request->birthdate, 
            'username' => $request->username, 
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'barangay_id' => $request->barangay_id,
            'role' => 'citizen' 
        ]);

        return response()->json(['message' => 'OTP sent to email', 'email' => $user->email], 200);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate(['email' => 'required|email', 'otp' => 'required|numeric']);
        $cachedOtp = Cache::get('otp_' . $request->email);

        if ($cachedOtp && $cachedOtp == $request->otp) {
            Cache::forget('otp_' . $request->email);
            $user = User::where('email', $request->email)->first();
            return response()->json(['message' => 'Verification successful', 'user' => clone $user, 'role' => $user->role], 200);
        }
        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }

    public function createDispatcher(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'phone' => 'required|string',
            'username' => 'required|string|unique:users', 
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
            'barangay_id' => 'required|integer'
        ]);

        $dispatcher = clone User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'phone' => $request->phone,
            'username' => $request->username, 
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'barangay_id' => $request->barangay_id,
            'role' => 'dispatcher' 
        ]);

        return response()->json(['message' => 'Dispatcher created successfully!'], 201);
    }

    public function updateProfilePicture(Request $request)
    {
        $request->validate(['user_id' => 'required', 'image' => 'required']);
        
        $image_parts = explode(";base64,", $request->image);
        $image_base64 = base64_decode($image_parts[1]);
        $fileName = 'profile_' . time() . '_' . $request->user_id . '.png';
        
        \Illuminate\Support\Facades\Storage::disk('public')->put('profiles/' . $fileName, $image_base64);
        $newUrl = 'http://127.0.0.1:8000/storage/profiles/' . $fileName;

        $user = User::where('user_id', $request->user_id)->first();
        $user->profile_picture = $newUrl;
        $user->save();

        return response()->json(['message' => 'Photo updated!', 'user' => clone $user]);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'user_id' => 'required',
            'current_password' => 'required',
            'new_password' => ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/']
        ]);

        $user = User::where('user_id', $request->user_id)->first();
        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 400);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json(['message' => 'Password updated successfully!']);
    }

    public function updateMedicalProfile(Request $request)
    {
        $request->validate(['user_id' => 'required']);
        
        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) return response()->json(['message' => 'User not found'], 404);

        $user->blood_type = $request->blood_type;
        $user->allergies = $request->allergies;
        $user->medical_conditions = $request->medical_conditions;
        $user->pwd_status = $request->pwd_status;
        $user->save();

        return response()->json(['message' => 'Medical profile updated successfully!', 'user' => clone $user]);
    }

    // --- NEW: FORGOT PASSWORD FLOW --- //
    
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        
        $user = User::where('email', $request->email)->first();
        if (!$user) {
            // Return success anyway to prevent email enumeration attacks (security best practice)
            return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
        }

        $otp = rand(1000, 9999);
        Cache::put('reset_otp_' . $request->email, $otp, now()->addMinutes(10));

        Mail::raw("Your SINE MDRRMO Password Reset Code is: {$otp}. It will expire in 10 minutes.", function ($message) use ($request) {
            $message->to($request->email)->subject('Password Reset Request');
        });

        return response()->json(['message' => 'If an account exists, an OTP was sent.'], 200);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email', 
            'otp' => 'required|numeric',
            'new_password' => ['required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/']
        ]);

        $cachedOtp = Cache::get('reset_otp_' . $request->email);

        if ($cachedOtp && $cachedOtp == $request->otp) {
            $user = User::where('email', $request->email)->first();
            $user->password = Hash::make($request->new_password);
            $user->save();
            
            Cache::forget('reset_otp_' . $request->email);
            return response()->json(['message' => 'Password reset successfully!'], 200);
        }

        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }
}