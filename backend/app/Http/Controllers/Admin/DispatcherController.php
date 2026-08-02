<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/** Admin management of dispatcher accounts. */
class DispatcherController extends Controller
{
    public function getDispatchers()
    {
        return response()->json(
            User::where('role', 'dispatcher')->orderBy('created_at', 'desc')
                ->get(['user_id','first_name','last_name','username','email',
                       'phone','barangay_id','account_status','created_at','profile_picture'])
        );
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
        $dispatcher = User::where('user_id', $request->user_id)->where('role', 'dispatcher')->first();
        if (!$dispatcher) return response()->json(['message' => 'Dispatcher not found.'], 404);
        $dispatcher->update([
            'first_name'  => $request->first_name,
            'last_name'   => $request->last_name,
            'phone'       => $request->phone,
            'email'       => $request->email,
            'barangay_id' => $request->barangay_id,
        ]);
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
