<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->use([
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        // Sanctum ships these classes but Laravel's new bootstrap/app.php
        // style requires explicit aliasing — neither was registered anywhere
        // in this app before, so token abilities ('admin', 'dispatcher',
        // 'citizen') set at login were never actually enforced on any route.
        $middleware->alias([
            'ability'   => \Laravel\Sanctum\Http\Middleware\CheckForAnyAbility::class, // ANY of the listed abilities
            'abilities' => \Laravel\Sanctum\Http\Middleware\CheckAbilities::class,      // ALL of the listed abilities
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
