<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * Admin actions on citizen accounts: search/list, suspend/reactivate,
 * and verification-queue approve/reject for new signups.
 */
class CitizenController extends Controller
{
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
}
