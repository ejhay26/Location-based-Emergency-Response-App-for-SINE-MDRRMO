<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch', function (Blueprint $table) {
            $table->integer('dispatch_id')->autoIncrement();
            $table->integer('request_id')->nullable();
            $table->integer('responder_id')->nullable();
            $table->integer('vehicle_id')->nullable();
            $table->dateTime('dispatch_time')->nullable();
            $table->dateTime('arrival_time')->nullable();
            $table->string('status', 50)->nullable();

            $table->foreign('request_id')->references('request_id')->on('emergency_requests')->nullOnDelete();
            $table->foreign('responder_id')->references('responder_id')->on('responders')->nullOnDelete();
            $table->foreign('vehicle_id')->references('vehicle_id')->on('vehicles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
