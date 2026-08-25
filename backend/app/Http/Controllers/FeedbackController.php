<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeedbackController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'message' => 'required|string|min:10|max:2000',
            'category' => 'nullable|string|in:general,bug,suggestion,other',
        ]);

        $id = DB::table('feedback')->insertGetId([
            'user_id'    => $request->user_id,
            'message'    => $request->message,
            'category'   => $request->category ?? 'general',
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Feedback submitted. Thank you!', 'id' => $id]);
    }

    public function index()
    {
        $rows = DB::table('feedback')
            ->join('users', 'feedback.user_id', '=', 'users.user_id')
            ->select(
                'feedback.id',
                'feedback.message',
                'feedback.category',
                'feedback.created_at',
                DB::raw("CONCAT(users.first_name, ' ', users.last_name) as full_name"),
                'users.username',
                'users.email'
            )
            ->orderByDesc('feedback.created_at')
            ->get();

        return response()->json($rows);
    }

    public function clear()
    {
        DB::table('feedback')->truncate();
        return response()->json(['message' => 'All feedback cleared.']);
    }

    public function export(Request $request)
    {
        $format = $request->query('format', 'csv');
        $rows = DB::table('feedback')
            ->join('users', 'feedback.user_id', '=', 'users.user_id')
            ->select(
                'feedback.id',
                'feedback.message',
                'feedback.category',
                'feedback.created_at',
                DB::raw("CONCAT(users.first_name, ' ', users.last_name) as full_name"),
                'users.username',
                'users.email'
            )
            ->orderByDesc('feedback.created_at')
            ->get();

        if ($format === 'json') {
            $filename = 'feedback_export_' . date('Y-m-d_His') . '.json';
            return response()->json($rows, 200, [
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Type' => 'application/json'
            ], JSON_PRETTY_PRINT);
        }

        // CSV export
        $filename = 'feedback_export_' . date('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        $callback = function () use ($rows) {
            $file = fopen('php://output', 'w');
            // Add UTF-8 BOM for Excel compatibility
            fputs($file, "\xEF\xBB\xBF");
            fputcsv($file, ['ID', 'Date & Time', 'Citizen Name', 'Username', 'Email', 'Category', 'Message']);
            foreach ($rows as $row) {
                fputcsv($file, [
                    $row->id,
                    $row->created_at,
                    $row->full_name,
                    $row->username,
                    $row->email,
                    ucfirst($row->category ?? 'General'),
                    $row->message
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
