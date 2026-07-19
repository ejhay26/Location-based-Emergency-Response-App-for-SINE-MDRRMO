<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmergencyController;
use App\Http\Controllers\UserSettingsController;

// ── Public routes (no token required) ────────────────────────────────────────
Route::post('/register',        [AuthController::class, 'register']);
Route::post('/login',           [AuthController::class, 'login']);
Route::post('/verify-otp',      [AuthController::class, 'verifyOtp']);
Route::get('/check-username',   [AuthController::class, 'checkUsername']);
Route::get('/check-email',      [AuthController::class, 'checkEmail']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

// Public read-only feeds
Route::get('/active-emergencies',   [EmergencyController::class, 'getActiveEmergencies']);
Route::get('/active-hazards',       [EmergencyController::class, 'getActiveHazards']);
Route::get('/active-broadcast',     [EmergencyController::class, 'getActiveBroadcast']);
Route::get('/dispatch-assets',      [EmergencyController::class, 'getDispatchAssets']);
Route::get('/analytics',            [EmergencyController::class, 'getAnalytics']);
Route::get('/archived-emergencies', [EmergencyController::class, 'getArchivedEmergencies']);

// ── Sanctum-protected routes ──────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Session
    Route::post('/logout', [AuthController::class, 'logout']);

    // Profile & account
    Route::post('/update-profile-picture',     [AuthController::class, 'updateProfilePicture']);
    Route::post('/update-password',            [AuthController::class, 'updatePassword']);
    Route::post('/send-password-change-otp',   [AuthController::class, 'sendPasswordChangeOtp']);
    Route::post('/verify-password-change-otp', [AuthController::class, 'verifyPasswordChangeOtp']);
    Route::post('/update-medical-profile',     [AuthController::class, 'updateMedicalProfile']);

    // Settings
    Route::get('/settings/{user_id}', [UserSettingsController::class, 'get']);
    Route::post('/settings',          [UserSettingsController::class, 'set']);

    // Push notifications
    Route::post('/save-push-token', [AuthController::class, 'savePushToken']);

    // Citizen actions
    Route::post('/submit-sos',              [EmergencyController::class, 'submitSos'])->middleware('throttle:5,1');
    Route::post('/cancel-sos',              [EmergencyController::class, 'cancelEmergency']);
    Route::post('/submit-hazard',           [EmergencyController::class, 'submitHazard'])->middleware('throttle:5,1');
    Route::get('/my-emergencies/{user_id}', [EmergencyController::class, 'getMyEmergencies']);

    // Feedback
    Route::post('/feedback',         [App\Http\Controllers\FeedbackController::class, 'store']);

    // Admin / dispatcher only
    Route::post('/create-dispatcher',     [AuthController::class, 'createDispatcher']);
    Route::get('/pending-verifications',  [AuthController::class, 'getPendingVerifications']);
    Route::get('/dispatchers',            [AuthController::class, 'getDispatchers']);
    Route::post('/approve-user',          [AuthController::class, 'approveUser']);
    Route::post('/reject-user',           [AuthController::class, 'rejectUser']);
    Route::get('/citizens',               [AuthController::class, 'getCitizens']);
    Route::post('/suspend-citizen',       [AuthController::class, 'suspendCitizen']);
    Route::post('/reactivate-citizen',    [AuthController::class, 'reactivateCitizen']);
    Route::post('/dispatch-emergency',    [EmergencyController::class, 'dispatchEmergency']);
    Route::post('/resolve-emergency',     [EmergencyController::class, 'resolveEmergency']);
    Route::post('/mark-false-alarm',      [EmergencyController::class, 'markFalseAlarm']);
    Route::post('/resolve-hazard',        [EmergencyController::class, 'resolveHazard']);
    Route::post('/create-broadcast',      [EmergencyController::class, 'createBroadcast']);
    Route::post('/clear-broadcast',       [EmergencyController::class, 'clearBroadcast']);
    Route::get('/feedback',               [App\Http\Controllers\FeedbackController::class, 'index']);
    Route::post('/feedback/clear',        [App\Http\Controllers\FeedbackController::class, 'clear']);
    Route::get('/feedback/export',        [App\Http\Controllers\FeedbackController::class, 'export']);
});
