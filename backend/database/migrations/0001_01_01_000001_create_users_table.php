<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->integer('user_id')->autoIncrement();
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('username', 50)->nullable()->unique();
            $table->string('phone', 20)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('profile_picture', 255)->default('https://ionicframework.com/docs/img/demos/avatar.svg')->nullable();
            $table->string('email', 100)->nullable()->unique();
            $table->string('password', 255)->nullable();
            $table->enum('role', ['citizen', 'dispatcher', 'admin'])->default('citizen');
            $table->enum('account_status', ['unverified', 'active', 'banned'])->default('active');
            $table->boolean('setup_completed')->default(false);
            $table->integer('barangay_id')->nullable();
            $table->timestamp('created_at')->useCurrent()->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->nullable();
            $table->softDeletes();
            $table->string('valid_id_proof', 255)->nullable();
            $table->string('valid_id_proof_back', 255)->nullable();
            $table->string('valid_id_type', 50)->nullable();
            $table->string('selfie_with_id_proof', 255)->nullable();
            $table->string('blood_type', 10)->nullable();
            $table->text('allergies')->nullable();
            $table->text('medical_conditions')->nullable();
            $table->string('pwd_status', 100)->nullable();
            $table->string('ban_reason', 500)->nullable();
            $table->timestamp('banned_at')->nullable();
            $table->unsignedTinyInteger('false_alarm_strikes')->default(0);

            $table->foreign('barangay_id')->references('barangay_id')->on('barangays')->nullOnDelete();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
