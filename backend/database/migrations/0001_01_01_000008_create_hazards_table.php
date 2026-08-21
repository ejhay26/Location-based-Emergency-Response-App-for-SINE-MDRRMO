<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hazards', function (Blueprint $table) {
            $table->integer('hazard_id')->autoIncrement();
            $table->integer('user_id')->nullable();
            $table->string('description', 255)->nullable();
            $table->string('hazard_type', 50)->nullable();
            $table->longText('proof_files')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->integer('barangay_id')->nullable();
            $table->string('status', 50)->default('Active')->nullable();
            $table->timestamp('created_at')->useCurrent()->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->nullable();

            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
            $table->foreign('barangay_id')->references('barangay_id')->on('barangays')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
