<?php

namespace App\Http\Controllers\Emergency;

use App\Events\EmergencyUpdated;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\EmergencyRequest;
use App\Models\Dispatch;
use App\Models\Responder;
use App\Models\Vehicle;
use App\Models\User;
use App\Services\NotificationService;

/** Dispatcher/admin actions: assign responders/vehicles, resolve, and false-alarm strikes. */
class DispatchController extends Controller
{
    public function __construct(private NotificationService $notifications)
    {
    }

    public function getDispatchAssets()
    {
        return response()->json([
            'responders' => Responder::where('status', 'Available')->get(),
            'vehicles'   => Vehicle::where('status', 'Available')->get(),
        ]);
    }

    public function dispatchEmergency(Request $request)
    {
        $request->validate([
            'request_id'   => 'required|integer',
            'responder_id' => 'required|integer',
            'vehicle_id'   => 'required|integer',
        ]);
        Dispatch::create([
            'request_id'    => $request->request_id,
            'responder_id'  => $request->responder_id,
            'vehicle_id'    => $request->vehicle_id,
            'dispatch_time' => now(),
            'status'        => 'En Route',
        ]);
        EmergencyRequest::where('request_id', $request->request_id)
            ->update(['status' => 'Dispatched']);
        $req = EmergencyRequest::find($request->request_id);
        if ($req) {
            $this->notifications->notifyUser($req->user_id, 'Responders Dispatched', 'Help is on the way to your location.', ['type' => 'dispatched']);
        }

        broadcast(new EmergencyUpdated('dispatched', $request->request_id))->toOthers();

        return response()->json(['message' => 'Units dispatched successfully!']);
    }

    public function resolveEmergency(Request $request)
    {
        $request->validate(['request_id' => 'required|integer']);
        EmergencyRequest::where('request_id', $request->request_id)
            ->update(['status' => 'Resolved']);
        Dispatch::where('request_id', $request->request_id)
            ->update(['status' => 'Completed', 'arrival_time' => now()]);
        $req = EmergencyRequest::find($request->request_id);
        if ($req) {
            $this->notifications->notifyUser($req->user_id, 'Emergency Resolved', 'Your report has been resolved. Stay safe.', ['type' => 'resolved']);
        }

        broadcast(new EmergencyUpdated('resolved', $request->request_id))->toOthers();

        return response()->json(['message' => 'Emergency resolved and archived.']);
    }

    public function markFalseAlarm(Request $request)
    {
        $request->validate(['request_id' => 'required|integer']);
        $emergency = EmergencyRequest::find($request->request_id);
        if (!$emergency) return response()->json(['message' => 'Emergency not found.'], 404);
        if (in_array($emergency->status, ['Pending', 'Dispatched'])) {
            return response()->json(['message' => 'Cannot mark an active emergency as a false alarm.'], 400);
        }
        if ($emergency->is_false_alarm) {
            return response()->json(['message' => 'Already marked as a false alarm.'], 400);
        }
        EmergencyRequest::where('request_id', $request->request_id)
            ->update(['is_false_alarm' => 1]);
        $user = User::where('user_id', $emergency->user_id)->first();
        $user->increment('false_alarm_strikes');
        $strikes = $user->false_alarm_strikes;
        if ($strikes >= 3) {
            $user->update([
                'account_status' => 'banned',
                'ban_reason'     => 'Automatically suspended after 3 false alarm strikes.',
                'banned_at'      => now(),
            ]);
            DB::table('personal_access_tokens')->where('tokenable_id', $emergency->user_id)->delete();
            $this->notifications->notifyUser($emergency->user_id, 'Account Suspended', 'Your account has been suspended due to repeated false emergency reports.', ['type' => 'suspended']);

            if (!empty($user->email)) {
                try {
                    \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\FalseAlarmStrikeMail(
                        $user->first_name,
                        $user->email,
                        $strikes,
                        3,
                        'Emergency report marked as false alarm during responder on-site verification.',
                        'banned'
                    ));
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('DispatchController: failed to send FalseAlarmStrikeMail on ban.', [
                        'user_id' => $user->user_id,
                        'error'   => $e->getMessage(),
                    ]);
                }
            }

            broadcast(new EmergencyUpdated('false_alarm', $request->request_id))->toOthers();

            return response()->json(['message' => 'User suspended after reaching 3 false alarm strikes.', 'false_alarm_strikes' => $strikes, 'account_status' => 'banned']);
        }
        $remaining = 3 - $strikes;
        $this->notifications->notifyUser(
            $emergency->user_id,
            'False Alarm Strike ' . $strikes . ' of 3',
            "This report was marked as a false alarm by MDRRMO. {$remaining} more strike(s) will result in account suspension.",
            ['type' => 'false_alarm_strike']
        );

        if (!empty($user->email)) {
            try {
                \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\FalseAlarmStrikeMail(
                    $user->first_name,
                    $user->email,
                    $strikes,
                    3,
                    'Emergency report marked as false alarm during responder on-site verification.',
                    'active'
                ));
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('DispatchController: failed to send FalseAlarmStrikeMail on strike.', [
                    'user_id' => $user->user_id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }

        broadcast(new EmergencyUpdated('false_alarm', $request->request_id))->toOthers();

        return response()->json(['message' => "Strike {$strikes} recorded. {$remaining} more will result in automatic suspension.", 'false_alarm_strikes' => $strikes, 'account_status' => $user->account_status]);
    }
}
