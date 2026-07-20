<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\Request;

Route::get('/', function () {
    return view('welcome');
});

/**
 * Storage proxy route — serves files from storage/app/public with explicit
 * CORS headers so cross-origin fetch() calls from the Ionic app succeed.
 *
 * This is needed because ngrok intercepts direct /storage/* requests before
 * Laravel's CORS middleware can add the required headers.
 *
 * Usage: GET /storage-proxy/profiles/file.png
 */
Route::get('/storage-proxy/{path}', function (Request $request, string $path) {
    // Prevent path traversal attacks.
    $safePath = ltrim(preg_replace('/\.\.+/', '', $path), '/');

    if (!Storage::disk('public')->exists($safePath)) {
        abort(404);
    }

    $file     = Storage::disk('public')->get($safePath);
    $mimeType = Storage::disk('public')->mimeType($safePath);

    return response($file, 200)
        ->header('Content-Type',                $mimeType)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Headers','*')
        ->header('Cache-Control',               'public, max-age=86400');
})->where('path', '.*');
