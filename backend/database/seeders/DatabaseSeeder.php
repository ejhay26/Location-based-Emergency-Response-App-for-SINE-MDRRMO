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

        // ── 3. Responders ────────────────────────────────────────────────────
        $responders = [
            ['responder_id' => 1, 'name' => 'San Isidro BFP',           'role' => 'Firefighter', 'contact' => '09111111111', 'status' => 'Available'],
            ['responder_id' => 2, 'name' => 'San Isidro PNP',           'role' => 'Police',      'contact' => '09222222222', 'status' => 'Available'],
            ['responder_id' => 3, 'name' => 'MDRRMO Rescue Team',      'role' => 'Rescue',      'contact' => '09333333333', 'status' => 'Available'],
            ['responder_id' => 4, 'name' => 'Rural Health Unit (RHU)', 'role' => 'Medical',     'contact' => '09444444444', 'status' => 'Available'],
        ];
        foreach ($responders as $r) {
            DB::table('responders')->updateOrInsert(['responder_id' => $r['responder_id']], $r);
        }

        // ── 4. Vehicles ──────────────────────────────────────────────────────
        $vehicles = [
            ['vehicle_id' => 1, 'responder_id' => 1, 'name' => 'Firetruck 01',        'type' => 'Truck',     'plate' => 'SFP-123', 'status' => 'Available'],
            ['vehicle_id' => 2, 'responder_id' => 2, 'name' => 'Police Patrol Alpha', 'type' => 'Car',       'plate' => 'PNP-456', 'status' => 'Available'],
            ['vehicle_id' => 3, 'responder_id' => 4, 'name' => 'Rescue Ambulance A',  'type' => 'Ambulance', 'plate' => 'MDR-789', 'status' => 'Available'],
            ['vehicle_id' => 4, 'responder_id' => 3, 'name' => 'Rescue Boat 1',       'type' => 'Boat',      'plate' => 'MDR-001', 'status' => 'Available'],
        ];
        foreach ($vehicles as $v) {
            DB::table('vehicles')->updateOrInsert(['vehicle_id' => $v['vehicle_id']], $v);
        }

        // ── 5. Default Admin & Dispatcher Accounts ───────────────────────────
        $defaultUsers = [
            [
                'first_name'          => 'Admin',
                'last_name'           => 'MDRRMO',
                'username'            => 'admin',
                'email'               => 'admin_user@sine.gov.ph',
                'phone'               => '09123456789',
                'password'            => Hash::make('Admin123!'),
                'role'                => 'admin',
                'account_status'      => 'active',
                'setup_completed'     => 1,
                'barangay_id'         => 5,
                'false_alarm_strikes' => 0,
            ],
            [
                'first_name'          => 'Dispatcher',
                'last_name'           => 'One',
                'username'            => 'dispatcher1',
                'email'               => 'dis@mail.com',
                'phone'               => '09123456789',
                'password'            => Hash::make('Dispatcher123!'),
                'role'                => 'dispatcher',
                'account_status'      => 'active',
                'setup_completed'     => 1,
                'barangay_id'         => 5,
                'false_alarm_strikes' => 0,
            ],
        ];

        foreach ($defaultUsers as $u) {
            DB::table('users')->updateOrInsert(['email' => $u['email']], $u);
        }
    }
}
