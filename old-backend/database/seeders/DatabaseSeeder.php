<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's reference database with initial required data.
     * Run with: php artisan db:seed (or php artisan migrate --seed)
     */
    public function run(): void
    {
        // ── 1. Barangays (San Isidro, Nueva Ecija) ───────────────────────────
        $barangays = [
            ['barangay_id' => 1, 'barangay_name' => 'Alua'],
            ['barangay_id' => 2, 'barangay_name' => 'Calaba'],
            ['barangay_id' => 3, 'barangay_name' => 'Malapit'],
            ['barangay_id' => 4, 'barangay_name' => 'Mangga'],
            ['barangay_id' => 5, 'barangay_name' => 'Poblacion'],
            ['barangay_id' => 6, 'barangay_name' => 'Pulo'],
            ['barangay_id' => 7, 'barangay_name' => 'San Roque'],
            ['barangay_id' => 8, 'barangay_name' => 'Santo Cristo'],
            ['barangay_id' => 9, 'barangay_name' => 'Tabon'],
        ];
        foreach ($barangays as $b) {
            DB::table('barangays')->updateOrInsert(['barangay_id' => $b['barangay_id']], $b);
        }

        // ── 2. Incident Types ────────────────────────────────────────────────
        $incidentTypes = [
            ['incident_type_id' => 1, 'incident_name' => 'Fire'],
            ['incident_type_id' => 2, 'incident_name' => 'Flood'],
            ['incident_type_id' => 3, 'incident_name' => 'Medical'],
            ['incident_type_id' => 4, 'incident_name' => 'Crime'],
            ['incident_type_id' => 5, 'incident_name' => 'Others'],
        ];
        foreach ($incidentTypes as $t) {
            DB::table('incident_types')->updateOrInsert(['incident_type_id' => $t['incident_type_id']], $t);
        }

        // ── 3. Default Admin & Dispatcher Accounts ───────────────────────────
        $defaultUsers = [
            [
                'email'               => 'admin_user@sine.gov.ph',
                'password'            => Hash::make(env('DEFAULT_ADMIN_PASSWORD', 'Admin123!')),
                'role'                => 'admin',
                'account_status'      => 'active',
                'false_alarm_strikes' => 0,
                'profile'             => [
                    'first_name'      => 'Admin',
                    'last_name'       => 'MDRRMO',
                    'username'        => 'admin',
                    'phone'           => '09123456789',
                    'setup_completed' => 1,
                    'barangay_id'     => 5,
                ],
            ],
            [
                'email'               => 'dis@mail.com',
                'password'            => Hash::make(env('DEFAULT_DISPATCHER_PASSWORD', 'Dispatcher123!')),
                'role'                => 'dispatcher',
                'account_status'      => 'active',
                'false_alarm_strikes' => 0,
                'profile'             => [
                    'first_name'      => 'Dispatcher',
                    'last_name'       => 'One',
                    'username'        => 'dispatcher1',
                    'phone'           => '09123456789',
                    'setup_completed' => 1,
                    'barangay_id'     => 5,
                ],
            ],
        ];

        foreach ($defaultUsers as $u) {
            $profileData = $u['profile'];
            unset($u['profile']);

            DB::table('users')->updateOrInsert(['email' => $u['email']], $u);
            $userId = DB::table('users')->where('email', $u['email'])->value('user_id');

            if ($userId) {
                DB::table('user_profiles')->updateOrInsert(
                    ['user_id' => $userId],
                    array_merge($profileData, ['user_id' => $userId])
                );
            }
        }
    }
}
