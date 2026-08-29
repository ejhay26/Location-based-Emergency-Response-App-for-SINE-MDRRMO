<?php

namespace App\Http\Controllers\Admin;

use App\Events\UserVerified;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Mail\WelcomeMail;
use App\Mail\VerificationDeclinedMail;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/**
 * Admin actions on citizen accounts: search/list, suspend/reactivate,
 * and verification-queue approve/reject for new signups.
 */
class CitizenController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function getCitizens(Request $request)
    {
        $query = User::where('role', 'citizen');
        if ($request->filled('search')) {
            $term = $request->query('search');
            $query->where(function ($q) use ($term) {
                $q->where('email', 'like', "%{$term}%")
                  ->orWhereHas('profile', function ($pq) use ($term) {
                      $pq->where('first_name', 'like', "%{$term}%")
                        ->orWhere('last_name',  'like', "%{$term}%")
                        ->orWhere('username',   'like', "%{$term}%")
                        ->orWhere('phone',      'like', "%{$term}%");
                  });
            });
        }
        if ($request->filled('status')) {
            $query->where('account_status', $request->query('status'));
        }
        return response()->json(
            $query->orderBy('created_at', 'desc')->get()
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

        broadcast(new UserVerified('suspended', $user->user_id));

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

        broadcast(new UserVerified('reinstated', $user->user_id));

        return response()->json(['message' => 'Account reactivated.', 'user' => $user->fresh()]);
    }

    public function issueStrike(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'reason'  => 'required|string|max:500',
        ]);
        $user = User::where('user_id', $request->user_id)->where('role', 'citizen')->first();
        if (!$user) return response()->json(['message' => 'Citizen not found.'], 404);

        $user->increment('false_alarm_strikes');
        $strikes = $user->false_alarm_strikes;
        $reason  = $request->reason;

        if ($strikes >= 3) {
            $user->update([
                'account_status' => 'banned',
                'ban_reason'     => "Automatically suspended after 3 false alarm strikes. (Reason: {$reason})",
                'banned_at'      => now(),
            ]);
            $user->tokens()->delete();

            $this->notifications->notifyUser(
                $user->user_id,
                'Account Suspended (3 False Alarm Strikes)',
                "Your account has been suspended due to repeated false alarm reports. Stated reason: {$reason}",
                ['type' => 'suspended']
            );

            if (!empty($user->email)) {
                try {
                    Mail::to($user->email)->send(new \App\Mail\FalseAlarmStrikeMail(
                        $user->first_name,
                        $user->email,
                        $strikes,
                        3,
                        $reason,
                        'banned'
                    ));
                } catch (\Throwable $e) {
                    Log::error('CitizenController: failed to send FalseAlarmStrikeMail on suspension.', [
                        'user_id' => $user->user_id,
                        'error'   => $e->getMessage(),
                    ]);
                }
            }

            broadcast(new UserVerified('suspended', $user->user_id));

            return response()->json([
                'message'             => 'Citizen received Strike 3 and account has been suspended.',
                'false_alarm_strikes' => $strikes,
                'account_status'     => 'banned',
                'user'               => $user->fresh(),
            ]);
        }

        $remaining = 3 - $strikes;
        $this->notifications->notifyUser(
            $user->user_id,
            "False Alarm Strike {$strikes} of 3",
            "A false alarm strike was recorded on your account. Reason: {$reason}. {$remaining} more strike(s) will result in automatic suspension.",
            ['type' => 'false_alarm_strike']
        );

        if (!empty($user->email)) {
            try {
                Mail::to($user->email)->send(new \App\Mail\FalseAlarmStrikeMail(
                    $user->first_name,
                    $user->email,
                    $strikes,
                    3,
                    $reason,
                    'active'
                ));
            } catch (\Throwable $e) {
                Log::error('CitizenController: failed to send FalseAlarmStrikeMail on strike.', [
                    'user_id' => $user->user_id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }

        broadcast(new UserVerified('updated', $user->user_id));

        return response()->json([
            'message'             => "Strike {$strikes} of 3 recorded. {$remaining} more will result in automatic suspension.",
            'false_alarm_strikes' => $strikes,
            'account_status'     => $user->account_status,
            'user'               => $user->fresh(),
        ]);
    }

    public function resetStrikes(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'reason'  => 'nullable|string|max:500',
        ]);
        $user = User::where('user_id', $request->user_id)->where('role', 'citizen')->first();
        if (!$user) return response()->json(['message' => 'Citizen not found.'], 404);

        $wasBanned = $user->account_status === 'banned';
        $user->false_alarm_strikes = 0;
        if ($wasBanned) {
            $user->account_status = 'active';
            $user->ban_reason     = null;
            $user->banned_at      = null;
        }
        $user->save();

        $this->notifications->notifyUser(
            $user->user_id,
            'False Alarm Strikes Cleared',
            'Your false alarm strikes have been reset to 0 by MDRRMO administration.',
            ['type' => 'strikes_cleared']
        );

        broadcast(new UserVerified('reinstated', $user->user_id));

        return response()->json([
            'message'             => 'False alarm strikes reset to 0. Account record cleared.',
            'false_alarm_strikes' => 0,
            'account_status'     => $user->account_status,
            'user'               => $user->fresh(),
        ]);
    }

    public function getPendingVerifications()
    {
        return response()->json(
            User::where('account_status', 'unverified')
                ->with('verification')
                ->orderBy('created_at', 'desc')
                ->get()
        );
    }

    public function approveUser(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        $user = User::where('user_id', $request->user_id)->where('role', 'citizen')->first();
        if (!$user) return response()->json(['message' => 'Citizen not found.'], 404);

        $user->account_status = 'active';
        $user->save();

        if ($user->verification) {
            $user->verification->update([
                'verification_status' => 'approved',
                'reviewed_by'         => auth()->id() ?? null,
                'reviewed_at'         => now(),
            ]);
        }

        broadcast(new UserVerified('approved', $user->user_id));

        // Best-effort welcome notification — a failure here must not undo
        // the approval that already succeeded above.
        try {
            Mail::to($user->email)->send(new WelcomeMail($user));
        } catch (\Throwable $e) {
            Log::error('CitizenController: failed to send WelcomeMail on approval.', [
                'user_id' => $user->user_id,
                'error'   => $e->getMessage(),
            ]);
        }
        try {
            $this->notifications->notifyUser(
                $user->user_id,
                'Welcome to MDRRMO San Isidro!',
                "Hi {$user->first_name}, your account has been approved. You're all set to use the app."
            );
        } catch (\Throwable $e) {
            Log::error('CitizenController: failed to send welcome push notification.', [
                'user_id' => $user->user_id,
                'error'   => $e->getMessage(),
            ]);
        }

        return response()->json(['message' => 'User approved successfully.', 'user' => $user->fresh()]);
    }

    public function rejectUser(Request $request)
    {
        $request->validate(['user_id' => 'required|integer']);
        $user = User::where('user_id', $request->user_id)->first();
        if ($user) {
            $userEmail = $user->email;
            $userFirstName = $user->first_name;

            // Send polite rejection email before deleting record
            if (!empty($userEmail)) {
                try {
                    Mail::to($userEmail)->send(new VerificationDeclinedMail($userFirstName, $userEmail));
                } catch (\Throwable $e) {
                    Log::error('CitizenController: failed to send VerificationDeclinedMail on reject.', [
                        'user_id' => $user->user_id,
                        'email'   => $userEmail,
                        'error'   => $e->getMessage(),
                    ]);
                }
            }

            if ($user->valid_id_proof) {
                Storage::disk('public')->deleteDirectory('verification_ids/' . $user->username);
            }
            $userId = $user->user_id;
            $user->delete();
            broadcast(new UserVerified('rejected', $userId));
        }
        return response()->json(['message' => 'User request rejected and deleted.']);
    }
}
