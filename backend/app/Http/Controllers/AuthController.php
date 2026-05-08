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

        // Rate Limiting: Lock out by IP address
        $throttleKey = 'login_attempts|' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) { // Max 5 tries
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json(['message' => "Too many attempts. Please try again in {$seconds} seconds."], 429);
        }

        $fieldType = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $user = User::where($fieldType, $request->login)->first();

        // Check if user is banned
        if ($user && $user->account_status === 'banned') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, 60); // Adds 60 seconds of penalty per failure
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        RateLimiter::clear($throttleKey); // Success! Clear the penalty.

        return response()->json([
            'message' => 'Login successful',
            'user' => clone $user,
            'role' => $user->role
        ]);
    }

    public function register(Request $request)
    {
        // 1. Validate the incoming multi-step data
        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'phone' => 'required|string',
            'birthdate' => 'required|date',
            'username' => 'required|string|unique:users',
            'email' => 'required|email|unique:users',
            'password' => [
                'required',
                'min:8',             // Minimum 8 characters
                'regex:/[a-z]/',     // At least one lowercase letter
                'regex:/[A-Z]/',     // At least one uppercase letter
                'regex:/[0-9]/',     // At least one number
                'regex:/[@$!%*#?&]/' // At least one special symbol
            ],
            'barangay_id' => 'required|integer'
        ]);

        // 2. Generate a 4-digit OTP
        $otp = rand(1000, 9999);

        // 3. Save OTP to cache for 10 minutes, linked to their email
        Cache::put('otp_' . $request->email, $otp, now()->addMinutes(10));

        // 4. Send the Email (Using Laravel's raw mail closure for simplicity)
        Mail::raw("Your SINE MDRRMO Verification Code is: {$otp}. It will expire in 10 minutes.", function ($message) use ($request) {
            $message->to($request->email)
                    ->subject('MDRRMO Account Verification');
        });

        // 5. Create the inactive user
        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'phone' => $request->phone,
            'birthdate' => $request->birthdate, 
            'username' => $request->username, // FIXED: Now it successfully saves to the database
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'barangay_id' => $request->barangay_id,
            'role' => 'citizen' 
        ]);

        return response()->json(['message' => 'OTP sent to email', 'email' => $user->email], 200);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|numeric'
        ]);

        $cachedOtp = Cache::get('otp_' . $request->email);

        if ($cachedOtp && $cachedOtp == $request->otp) {
            // OTP is correct. Clear it and return success.
            Cache::forget('otp_' . $request->email);
            
            $user = User::where('email', $request->email)->first();
            
            return response()->json([
                'message' => 'Verification successful',
                'user' => clone $user,
                'role' => $user->role
            ], 200);
        }

        return response()->json(['message' => 'Invalid or expired OTP'], 400);
    }

    public function createDispatcher(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'phone' => 'required|string',
            'username' => 'required|string|unique:users', // FIXED: Admin must provide a username for staff
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
            'barangay_id' => 'required|integer'
        ]);

        $dispatcher = clone User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'phone' => $request->phone,
            'username' => $request->username, // FIXED: Save the username
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'barangay_id' => $request->barangay_id,
            'role' => 'dispatcher' // Force the role!
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
            'new_password' => [
                'required', 'min:8', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'
            ]
        ]);

        $user = User::where('user_id', $request->user_id)->first();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 400);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json(['message' => 'Password updated successfully!']);
    }
}