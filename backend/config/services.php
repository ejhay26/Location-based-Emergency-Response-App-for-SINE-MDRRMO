<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Semaphore retired in favor of PhilSMS (cheaper per-SMS rate).
    // Kept only as a comment for history — SemaphoreService.php can stay
    // in the repo unused, or be deleted once you're confident PhilSMS is
    // stable in production; nothing references config('services.semaphore')
    // anymore.
    'philsms' => [
        'token'  => env('PHILSMS_API_TOKEN'),
        'sender' => env('PHILSMS_SENDER_NAME', 'PhilSMS'),
    ],
    
    'firebase' => [
        'project_id'  => env('FIREBASE_PROJECT_ID'),
        'credentials' => env('FIREBASE_CREDENTIALS'),
    ],

];
