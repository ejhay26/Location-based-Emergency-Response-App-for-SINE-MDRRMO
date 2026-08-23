<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// SINE MDRRMO Automated Disaster Recovery Schedule
// Takes a compressed database snapshot on configurable interval if enabled
if (env('BACKUP_AUTO_ENABLED', true)) {
    $interval = (int) env('BACKUP_INTERVAL_HOURS', 2);
    if ($interval <= 1) {
        Schedule::command('backup create')->hourly();
    } elseif ($interval === 2) {
        Schedule::command('backup create')->everyTwoHours();
    } elseif ($interval === 3) {
        Schedule::command('backup create')->everyThreeHours();
    } elseif ($interval === 4) {
        Schedule::command('backup create')->everyFourHours();
    } elseif ($interval === 6) {
        Schedule::command('backup create')->everySixHours();
    } else {
        Schedule::command('backup create')->cron("0 */{$interval} * * *");
    }
}


