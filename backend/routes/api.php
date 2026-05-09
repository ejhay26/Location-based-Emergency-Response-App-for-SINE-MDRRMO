<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmergencyController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Authentication & Account Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/create-dispatcher', [AuthController::class, 'createDispatcher']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/update-profile-picture', [AuthController::class, 'updateProfilePicture']);
Route::post('/update-password', [AuthController::class, 'updatePassword']);
Route::post('/update-medical-profile', [AuthController::class, 'updateMedicalProfile']);

// NEW: Password Recovery Routes
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// Emergency & Dispatch Routes
Route::post('/submit-sos', [EmergencyController::class, 'submitSos']);
Route::post('/cancel-sos', [EmergencyController::class, 'cancelEmergency']);
Route::get('/my-emergencies/{user_id}', [EmergencyController::class, 'getMyEmergencies']); 
Route::get('/active-emergencies', [EmergencyController::class, 'getActiveEmergencies']); 
Route::get('/dispatch-assets', [EmergencyController::class, 'getDispatchAssets']);
Route::post('/dispatch-emergency', [EmergencyController::class, 'dispatchEmergency']);
Route::post('/resolve-emergency', [EmergencyController::class, 'resolveEmergency']);
Route::get('/archived-emergencies', [EmergencyController::class, 'getArchivedEmergencies']);
Route::get('/analytics', [EmergencyController::class, 'getAnalytics']);

// Hazard & Broadcast Routes
Route::post('/submit-hazard', [EmergencyController::class, 'submitHazard']);
Route::get('/active-hazards', [EmergencyController::class, 'getActiveHazards']);
Route::post('/create-broadcast', [EmergencyController::class, 'createBroadcast']);
Route::get('/active-broadcast', [EmergencyController::class, 'getActiveBroadcast']);