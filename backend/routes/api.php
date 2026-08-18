<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\CitizenController;
use App\Http\Controllers\Admin\DispatcherController;
use App\Http\Controllers\Emergency\SosController;
use App\Http\Controllers\Emergency\DispatchController;
use App\Http\Controllers\Emergency\HazardController;
use App\Http\Controllers\Emergency\BroadcastController;
use App\Http\Controllers\Emergency\AnalyticsController;
use App\Http\Controllers\UserSettingsController;
use App\Http\Controllers\FeedbackController;

// ── Public routes (no token required) ────────────────────────────────────────
Route::post('/register',        [AuthController::class, 'register']);
Route::post('/login',           [AuthController::class, 'login']);
Route::post('/login-send-otp',   [AuthController::class, 'loginSendOtp'])->middleware('throttle:3,1');
Route::post('/login-verify-otp', [AuthController::class, 'loginVerifyOtp'])->middleware('throttle:5,1');
Route::post('/verify-otp',      [AuthController::class, 'verifyOtp']);
Route::post('/resend-registration-otp', [AuthController::class, 'resendRegistrationOtp'])->middleware('throttle:3,1');
Route::post('/check-verification-status', [AuthController::class, 'checkVerificationStatus'])->middleware('throttle:10,1');
Route::get('/check-username',   [AuthController::class, 'checkUsername']);
Route::get('/check-email',      [AuthController::class, 'checkEmail']);
Route::post('/forgot-password',  [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/verify-reset-otp', [AuthController::class, 'verifyResetOtp'])->middleware('throttle:5,1');
Route::post('/reset-password',   [AuthController::class, 'resetPassword']);

// ── Sanctum-protected routes ──────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Read-only feeds — moved behind auth. These are only ever reached after
    // a frontend route guard has already confirmed login (app is online-only,
    // no offline/pre-login screens use them), so the client always holds a
    // token by the time it calls these.
    Route::get('/active-emergencies',   [SosController::class, 'getActiveEmergencies']);
    Route::get('/active-hazards',       [HazardController::class, 'getActiveHazards']);
    Route::get('/active-broadcast',     [BroadcastController::class, 'getActiveBroadcast']);
    Route::get('/dispatch-assets',      [DispatchController::class, 'getDispatchAssets']);
    Route::get('/analytics',            [AnalyticsController::class, 'getAnalytics']);
    Route::get('/archived-emergencies', [SosController::class, 'getArchivedEmergencies']);

    // Session
    Route::post('/logout', [AuthController::class, 'logout']);

    // Profile & account
    Route::post('/update-profile-picture',     [ProfileController::class, 'updateProfilePicture']);
    Route::post('/update-password',            [PasswordController::class, 'updatePassword']);
    Route::post('/send-password-change-otp',   [PasswordController::class, 'sendPasswordChangeOtp']);
    Route::post('/verify-password-change-otp', [PasswordController::class, 'verifyPasswordChangeOtp']);
    Route::post('/update-medical-profile',     [ProfileController::class, 'updateMedicalProfile']);
    Route::post('/complete-account-setup',     [ProfileController::class, 'completeAccountSetup']);

    // Settings
    Route::get('/settings/{user_id}', [UserSettingsController::class, 'get']);
    Route::post('/settings',          [UserSettingsController::class, 'set']);

    // Push notifications
    Route::post('/save-push-token',   [ProfileController::class, 'savePushToken']);
    Route::post('/delete-push-token', [ProfileController::class, 'deletePushToken']);

    // Citizen actions
    Route::post('/submit-sos',                 [SosController::class, 'submitSos'])->middleware('throttle:5,1');
    Route::post('/cancel-sos',                 [SosController::class, 'cancelEmergency']);
    Route::post('/submit-hazard',              [HazardController::class, 'submitHazard'])->middleware('throttle:5,1');
    Route::get('/my-emergencies/{user_id}',    [SosController::class, 'getMyEmergencies']);

    // Feedback
    Route::post('/feedback',         [FeedbackController::class, 'store']);

    // Admin-only account & verification management
    // (admin tokens hold ['admin','dispatcher','citizen']; dispatcher/citizen
    // tokens lack 'admin' and are now rejected with 403 instead of allowed through)
    Route::middleware('ability:admin')->group(function () {
        Route::post('/create-dispatcher',     [DispatcherController::class, 'createDispatcher']);
        Route::get('/pending-verifications',  [CitizenController::class, 'getPendingVerifications']);
        Route::get('/dispatchers',            [DispatcherController::class, 'getDispatchers']);
        Route::post('/update-dispatcher',     [DispatcherController::class, 'updateDispatcher']);
        Route::post('/deactivate-dispatcher', [DispatcherController::class, 'deactivateDispatcher']);
        Route::post('/approve-user',          [CitizenController::class, 'approveUser']);
        Route::post('/reject-user',           [CitizenController::class, 'rejectUser']);
        Route::get('/citizens',               [CitizenController::class, 'getCitizens']);
        Route::post('/suspend-citizen',       [CitizenController::class, 'suspendCitizen']);
        Route::post('/reactivate-citizen',    [CitizenController::class, 'reactivateCitizen']);
        Route::get('/feedback',               [FeedbackController::class, 'index']);
        Route::post('/feedback/clear',        [FeedbackController::class, 'clear']);
        Route::get('/feedback/export',        [FeedbackController::class, 'export']);
    });

    // Dispatcher-operational actions (admin tokens include the 'dispatcher'
    // ability too, so admins can still perform these)
    Route::middleware('ability:dispatcher')->group(function () {
        Route::post('/dispatch-emergency',    [DispatchController::class, 'dispatchEmergency']);
        Route::post('/resolve-emergency',     [DispatchController::class, 'resolveEmergency']);
        Route::post('/mark-false-alarm',      [DispatchController::class, 'markFalseAlarm']);
        Route::post('/resolve-hazard',        [HazardController::class, 'resolveHazard']);
        Route::post('/create-broadcast',      [BroadcastController::class, 'createBroadcast']);
        Route::post('/clear-broadcast',       [BroadcastController::class, 'clearBroadcast']);
    });
});
