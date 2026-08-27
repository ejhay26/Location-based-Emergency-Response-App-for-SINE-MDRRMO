<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\UserProfile;
use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Hash;

/** Admin management of dispatcher accounts. */
class DispatcherController extends Controller
{
    public function getDispatchers()
    {
        return response()->json(
            User::where('role', 'dispatcher')->orderBy('created_at', 'desc')->get()
        );
    }

    public function createDispatcher(Request $request)
    {
        $request->validate([
            'first_name'  => 'required|string',
            'last_name'   => 'required|string',
            'phone'       => 'required|string',
            'username'    => 'required|string|unique:user_profiles,username',
            'email'       => 'required|email|unique:users,email',
            'password'    => 'required|min:6',
            'barangay_id' => 'required|integer',
        ]);
        $normalizedPhone = PhoneNumber::normalize($request->phone);
        if ($normalizedPhone === null) {
            return response()->json(['message' => 'Please enter a valid Philippine mobile number.'], 422);
        }

        $user = User::create([
            'email'          => $request->email,
            'password'       => Hash::make($request->password),
            'role'           => 'dispatcher',
            'account_status' => 'active',
        ]);

        UserProfile::create([
            'user_id'         => $user->user_id,
            'first_name'      => $request->first_name,
            'last_name'       => $request->last_name,
            'phone'           => $normalizedPhone,
            'username'        => $request->username,
            'barangay_id'     => $request->barangay_id,
            'setup_completed' => true,
        ]);

        return response()->json(['message' => 'Dispatcher created successfully!'], 201);
    }

    public function updateDispatcher(Request $request)
    {
        $request->validate([
            'user_id'     => 'required|integer',
            'first_name'  => 'required|string',
            'last_name'   => 'required|string',
            'phone'       => 'required|string',
            'email'       => 'required|email|unique:users,email,' . $request->user_id . ',user_id',
            'barangay_id' => 'required|integer',
        ]);
        $normalizedPhone = PhoneNumber::normalize($request->phone);
        if ($normalizedPhone === null) {
            return response()->json(['message' => 'Please enter a valid Philippine mobile number.'], 422);
        }
        $dispatcher = User::where('user_id', $request->user_id)->where('role', 'dispatcher')->first();
        if (!$dispatcher) return response()->json(['message' => 'Dispatcher not found.'], 404);

        $dispatcher->update([
            'email' => $request->email,
        ]);

        $dispatcher->profile()->updateOrCreate(
            ['user_id' => $dispatcher->user_id],
            [
                'first_name'  => $request->first_name,
                'last_name'   => $request->last_name,
                'phone'       => $normalizedPhone,
                'barangay_id' => $request->barangay_id,
            ]
        );

        return response()->json(['message' => 'Dispatcher updated successfully!', 'user' => $dispatcher->fresh()]);
    }

    public function deactivateDispatcher(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        $dispatcher = User::where('user_id', $request->user_id)->where('role', 'dispatcher')->first();
        if (!$dispatcher) return response()->json(['message' => 'Dispatcher not found.'], 404);
        $dispatcher->account_status = 'banned';
        $dispatcher->ban_reason     = $request->reason ?? 'Deactivated by admin.';
        $dispatcher->banned_at      = now();
        $dispatcher->save();
        $dispatcher->tokens()->delete();
        return response()->json(['message' => 'Dispatcher deactivated.', 'user' => $dispatcher->fresh()]);
    }
}
