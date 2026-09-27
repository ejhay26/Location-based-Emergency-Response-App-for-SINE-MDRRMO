<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            });
        }

        // Extend enum to include 'pending_otp' for new registrations awaiting OTP verification
        DB::statement("ALTER TABLE users MODIFY COLUMN account_status ENUM('pending_otp', 'unverified', 'active', 'banned') NOT NULL DEFAULT 'pending_otp'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN account_status ENUM('unverified', 'active', 'banned') NOT NULL DEFAULT 'unverified'");

        if (Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('email_verified_at');
            });
        }
    }
};
