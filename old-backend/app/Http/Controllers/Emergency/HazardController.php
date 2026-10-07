<?php

namespace App\Http\Controllers\Emergency;

use App\Events\HazardUpdated;
use App\Http\Controllers\Controller;
use App\Services\BarangayResolver;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\NotificationService;

/** Citizen-reported hazards (non-emergency): submit, resolve, list active. */
class HazardController extends Controller
{
    use MediaHandling;

    public function __construct(
        private readonly BarangayResolver $barangayResolver,
        private readonly NotificationService $notificationService
    ) {
    }

    public function submitHazard(Request $request)
    {
        $userId = $request->user()?->user_id ?? $request->input('user_id');
        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $request->validate([
            'user_id'       => 'nullable|integer',
            'description'   => 'required|string',
            'latitude'      => 'required|numeric|between:-90,90',
            'longitude'     => 'required|numeric|between:-180,180',
            'proof_files'   => 'required|array|min:1|max:2',
            'proof_files.*' => 'string|max:20971520',
            'hazard_type'   => 'nullable|string|max:50',
        ]);

        $proofFilesJson = $this->processProofFiles($request->proof_files, $userId, 'hazard');

        // Server-side, authoritative barangay resolution — see
        // BarangayResolver's class doc for why this is never trusted from
        // the client. Null (unresolved) is a valid, expected outcome and
        // must never block submission.
        $barangayId = $this->barangayResolver->resolve((float) $request->latitude, (float) $request->longitude);

        $hazard = Hazard::create([
            'user_id'     => $userId,
            'description' => $request->description,
            'hazard_type' => $request->hazard_type,
            'proof_files' => $proofFilesJson,
            'latitude'    => $request->latitude,
            'longitude'   => $request->longitude,
            'barangay_id' => $barangayId,
            'status'      => 'Active',
        ]);

        broadcast(new HazardUpdated('submitted', $hazard->hazard_id))->toOthers();

        // Push notification directly to admins & dispatchers on mobile
        $this->notificationService->notifyAdminsAndDispatchers(
            '⚠️ Public Hazard Reported',
            'New public road hazard reported in San Isidro.',
            ['type' => 'hazard', 'hazard_id' => (string) $hazard->hazard_id]
        );

        return response()->json(['message' => 'Hazard reported successfully!']);
    }

    public function resolveHazard(Request $request)
    {
        $request->validate(['hazard_id' => 'required|integer']);
        Hazard::where('hazard_id', $request->hazard_id)->update(['status' => 'Resolved']);

        broadcast(new HazardUpdated('resolved', $request->hazard_id))->toOthers();

        return response()->json(['message' => 'Hazard removed from active monitoring.']);
    }

    public function getActiveHazards()
    {
        $hazards = DB::table('hazards')
            ->join('users', 'hazards.user_id', '=', 'users.user_id')
            ->leftJoin('user_profiles', 'users.user_id', '=', 'user_profiles.user_id')
            ->leftJoin('barangays', 'hazards.barangay_id', '=', 'barangays.barangay_id')
            ->where('hazards.status', 'Active')
            ->select('hazards.*', 'user_profiles.first_name', 'user_profiles.last_name', 'user_profiles.profile_picture', 'barangays.barangay_name')
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($hazards);
    }

    public function getMyHazards(Request $request, $user_id = null)
    {
        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $targetId = $user_id ? (int)$user_id : $authUser->user_id;
        if ($targetId !== $authUser->user_id && !$authUser->tokenCan('admin') && !$authUser->tokenCan('dispatcher')) {
            return response()->json(['message' => 'Unauthorized to view hazards for another user.'], 403);
        }

        $hazards = DB::table('hazards')
            ->leftJoin('barangays', 'hazards.barangay_id', '=', 'barangays.barangay_id')
            ->where('hazards.user_id', $targetId)
            ->orderBy('hazards.created_at', 'desc')
            ->select('hazards.*', DB::raw('hazards.created_at AS request_time'), 'barangays.barangay_name')
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));

        return response()->json($hazards);
    }
}
