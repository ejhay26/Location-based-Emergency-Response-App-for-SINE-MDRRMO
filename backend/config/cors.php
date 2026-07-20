<?php

return [
    // storage-proxy/* is included so the CORS middleware adds
    // Access-Control-Allow-Origin to both the OPTIONS preflight and the
    // actual GET response for profile picture / ID proof fetches.
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*', 'storage-proxy/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,
];
