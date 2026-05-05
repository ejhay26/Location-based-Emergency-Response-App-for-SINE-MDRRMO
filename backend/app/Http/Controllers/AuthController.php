<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        // 1. Create the user in the database
        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'phone' => $request->phone,
            'email' => $request->email,
            'password' => Hash::make($request->password), // Encrypt the password!
            'barangay_id' => $request->barangay_id,
        ]);

        // 2. Send a success JSON message back to Ionic
        return response()->json([
            'message' => 'Citizen registered successfully',
            'user' => $user
        ], 201);
    }

    public function login(Request $request)
    {
        // 1. Check if it's an Admin trying to log in (using username)
        $admin = \Illuminate\Support\Facades\DB::table('admins')
            ->where('username', $request->email) // The input field is called 'email', but they typed a username
            ->first();

        if ($admin && \Illuminate\Support\Facades\Hash::check($request->password, $admin->password)) {
            return response()->json([
                'message' => 'Admin login successful',
                'user' => $admin,
                'role' => 'admin' // Send the role back!
            ], 200);
        }

        // 2. If not an admin, check if it's a normal Citizen (using email)
        $user = User::where('email', $request->email)->first();

        if ($user && \Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Citizen login successful',
                'user' => $user,
                'role' => 'citizen' // Send the role back!
            ], 200);
        }

        // 3. If neither matches, reject them
        return response()->json(['message' => 'Invalid credentials'], 401);
    }
}