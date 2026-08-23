<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// SINE MDRRMO Automated Disaster Recovery Schedule
// Takes a compressed database snapshot every 2 hours and auto-prunes older snapshots
Schedule::command('backup create')->everyTwoHours();

