<?php

namespace App\Http\Controllers\Emergency;

use App\Events\HazardUpdated;
use App\Http\Controllers\Controller;
use App\Services\BarangayResolver;
use App\Traits\MediaHandling;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Hazard;

/** Citizen-reported hazards (non-emergency): submit, resolve, list active. */
class HazardController extends Controller
{
    use MediaHandling;

    public function __construct(private readonly BarangayResolver $barangayResolver)
    {
    }

    public function submitHazard(Request $request)
    {
        $request->validate([
            'user_id'       => 'required|integer',
            'description'   => 'required|string',
            'latitude'      => 'required|numeric',
            'longitude'     => 'required|numeric',
            'proof_files'   => 'required|array|min:1|max:2',
            'proof_files.*' => 'string|max:20971520',
            'hazard_type'   => 'nullable|string|max:50',
        ]);

        $proofFilesJson = $this->processProofFiles($request->proof_files, $request->user_id, 'hazard');

        // Server-side, authoritative barangay resolution — see
        // BarangayResolver's class doc for why this is never trusted from
        // the client. Null (unresolved) is a valid, expected outcome and
        // must never block submission.
        $barangayId = $this->barangayResolver->resolve((float) $request->latitude, (float) $request->longitude);

        $hazard = Hazard::create([
            'user_id'     => $request->user_id,
            'description' => $request->description,
            'hazard_type' => $request->hazard_type,
            'proof_files' => $proofFilesJson,
            'latitude'    => $request->latitude,
            'longitude'   => $request->longitude,
            'barangay_id' => $barangayId,
            'status'      => 'Active',
        ]);

        broadcast(new HazardUpdated('submitted', $hazard->hazard_id))->toOthers();

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
            ->leftJoin('barangays', 'hazards.barangay_id', '=', 'barangays.barangay_id')
            ->where('hazards.status', 'Active')
            ->select('hazards.*', 'users.first_name', 'users.last_name', 'users.profile_picture', 'barangays.barangay_name')
            ->get()
            ->map(fn($r) => $this->decodeProofFiles($r));
        return response()->json($hazards);
    }
}
