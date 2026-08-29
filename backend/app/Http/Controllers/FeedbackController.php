<?php

namespace App\Http\Controllers;

use App\Mail\TechnicalBugReportMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class FeedbackController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'user_id'     => 'required|integer',
            'message'     => 'required|string|min:5|max:2000',
            'category'    => 'nullable|string|in:general,bug,suggestion,other',
            'rating'      => 'nullable|integer|min:1|max:5',
            'device_info' => 'nullable|array',
        ]);

        $id = DB::table('feedback')->insertGetId([
            'user_id'     => $request->user_id,
            'message'     => $request->message,
            'category'    => $request->category ?? 'general',
            'rating'      => $request->rating ?? 5,
            'status'      => 'active',
            'device_info' => $request->has('device_info') ? json_encode($request->device_info) : null,
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Feedback submitted. Thank you!', 'id' => $id]);
    }

    public function index(Request $request)
    {
        $query = DB::table('feedback')
            ->join('users', 'feedback.user_id', '=', 'users.user_id')
            ->leftJoin('user_profiles', 'users.user_id', '=', 'user_profiles.user_id')
            ->select(
                'feedback.id',
                'feedback.message',
                'feedback.category',
                'feedback.rating',
                'feedback.status',
                'feedback.is_forwarded',
                'feedback.forwarded_at',
                'feedback.device_info',
                'feedback.created_at',
                'feedback.deleted_at',
                DB::raw("CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name"),
                'user_profiles.username',
                'users.email'
            );

        $rows = $query->orderByDesc('feedback.created_at')->get();

        // Parse JSON device_info if present
        $rows = $rows->map(function ($row) {
            if (isset($row->device_info) && is_string($row->device_info)) {
                $row->device_info = json_decode($row->device_info, true);
            }
            return $row;
        });

        return response()->json($rows);
    }

    public function forwardBug(Request $request, $id)
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $row = DB::table('feedback')
            ->join('users', 'feedback.user_id', '=', 'users.user_id')
            ->leftJoin('user_profiles', 'users.user_id', '=', 'user_profiles.user_id')
            ->where('feedback.id', $id)
            ->select(
                'feedback.*',
                DB::raw("CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name"),
                'user_profiles.username',
                'users.email'
            )
            ->first();

        if (!$row) {
            return response()->json(['error' => 'Feedback submission not found.'], 404);
        }

        $deviceInfo = [];
        if (!empty($row->device_info)) {
            $deviceInfo = is_string($row->device_info) ? json_decode($row->device_info, true) : (array) $row->device_info;
        }

        // Add client IP / user agent from the current request if not present
        if (empty($deviceInfo['user_agent'])) {
            $deviceInfo['user_agent'] = $request->header('User-Agent');
        }

        $devEmail = config('mail.dev_support_email', env('DEV_SUPPORT_EMAIL', 'ejcp2005@gmail.com'));

        try {
            Mail::to($devEmail)->send(new TechnicalBugReportMail(
                feedbackId: (int) $row->id,
                citizenName: (string) ($row->full_name ?: 'Citizen'),
                citizenUsername: (string) ($row->username ?: 'user'),
                citizenEmail: (string) ($row->email ?: 'no-email@sine-mdrrmo.gov.ph'),
                category: ucfirst($row->category ?? 'Bug Report'),
                rating: $row->rating ? (int) $row->rating : 5,
                messageContent: (string) $row->message,
                createdAt: (string) $row->created_at,
                deviceInfo: $deviceInfo,
                adminNotes: $request->admin_notes
            ));

            DB::table('feedback')->where('id', $id)->update([
                'is_forwarded' => true,
                'forwarded_at' => now(),
            ]);

            return response()->json([
                'message'      => "Technical bug report successfully forwarded to {$devEmail}.",
                'is_forwarded' => true,
                'forwarded_at' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            Log::error("Failed to forward technical bug report #{$id}: " . $e->getMessage());
            return response()->json([
                'error'   => 'Could not send bug report email. Please verify mail configuration.',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Soft-delete / Move all active feedback to Trash
     */
    public function clear()
    {
        DB::table('feedback')->where('status', '!=', 'archived')->update([
            'status'     => 'archived',
            'deleted_at' => now(),
        ]);
        return response()->json(['message' => 'All feedback moved to Trash Archive.']);
    }

    /**
     * Archive/trash a single feedback item
     */
    public function archiveItem($id)
    {
        DB::table('feedback')->where('id', $id)->update([
            'status'     => 'archived',
            'deleted_at' => now(),
        ]);
        return response()->json(['message' => 'Feedback moved to Trash.']);
    }

    /**
     * Restore a trashed feedback item back to active
     */
    public function restoreItem($id)
    {
        DB::table('feedback')->where('id', $id)->update([
            'status'     => 'active',
            'deleted_at' => null,
        ]);
        return response()->json(['message' => 'Feedback restored to active list.']);
    }

    /**
     * Permanently delete all archived/trash feedback items
     */
    public function purgeTrash()
    {
        $count = DB::table('feedback')->where('status', 'archived')->delete();
        return response()->json(['message' => "Permanently purged {$count} archived feedback items."]);
    }

    public function export(Request $request)
    {
        $rows = DB::table('feedback')
            ->join('users', 'feedback.user_id', '=', 'users.user_id')
            ->leftJoin('user_profiles', 'users.user_id', '=', 'user_profiles.user_id')
            ->select(
                'feedback.id',
                'feedback.message',
                'feedback.category',
                'feedback.rating',
                'feedback.status',
                'feedback.created_at',
                DB::raw("CONCAT(COALESCE(user_profiles.first_name, ''), ' ', COALESCE(user_profiles.last_name, '')) as full_name"),
                'user_profiles.username',
                'users.email'
            )
            ->orderByDesc('feedback.created_at')
            ->get();

        $filename = 'feedback_export_' . date('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function () use ($rows) {
            $file = fopen('php://output', 'w');
            // Add UTF-8 BOM for Excel compatibility
            fputs($file, "\xEF\xBB\xBF");
            fputcsv($file, ['ID', 'Date & Time', 'Citizen Name', 'Username', 'Email', 'Category', 'Rating (1-5)', 'Status', 'Message']);
            foreach ($rows as $row) {
                fputcsv($file, [
                    $row->id,
                    $row->created_at,
                    $row->full_name,
                    $row->username,
                    $row->email,
                    ucfirst($row->category ?? 'General'),
                    ($row->rating ?? 5) . ' / 5 Stars',
                    ucfirst($row->status ?? 'Active'),
                    $row->message
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}

