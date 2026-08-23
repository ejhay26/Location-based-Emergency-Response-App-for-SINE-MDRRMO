<?php

return [
    // storage-proxy/* is included so the CORS middleware adds
    // Access-Control-Allow-Origin to both the OPTIONS preflight and the
    // actual GET response for profile picture / ID proof fetches.
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*', 'storage-proxy/*'],

    'allowed_methods' => ['*'],

    // Allow Capacitor mobile apps (Android & iOS) and Electron desktop
    'allowed_origins' => [
        'http://localhost',
        'https://localhost',
        'capacitor://localhost',
        'ionic://localhost',
        'http://127.0.0.1',
        'https://127.0.0.1',
    ],

    // Allows ionic serve dev servers (any port e.g. :8100, :4200) and native file/capacitor protocols
    'allowed_origins_patterns' => [
        '#^http(s)?://(localhost|127\.0\.0\.1)(:\d+)?$#',
        '#^capacitor://#',
        '#^ionic://#',
        '#^file://#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Length', 'Content-Range'],

    'max_age' => 86400,

    'supports_credentials' => false,
];

