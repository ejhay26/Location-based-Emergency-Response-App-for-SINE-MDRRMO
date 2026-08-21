<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emergency_requests', function (Blueprint $table) {
            $table->integer('request_id')->autoIncrement();
            $table->integer('user_id')->nullable();
            $table->integer('incident_type_id')->nullable();
            $table->longText('proof_files')->nullable();
            $table->text('description')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->integer('barangay_id')->nullable();
            $table->string('status', 50)->nullable();
            $table->timestamp('request_time')->useCurrent();
            $table->timestamp('created_at')->useCurrent()->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->nullable();
            $table->softDeletes();
            $table->boolean('is_false_alarm')->default(false);

            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
            $table->foreign('incident_type_id')->references('incident_type_id')->on('incident_types')->nullOnDelete();
            $table->foreign('barangay_id')->references('barangay_id')->on('barangays')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
