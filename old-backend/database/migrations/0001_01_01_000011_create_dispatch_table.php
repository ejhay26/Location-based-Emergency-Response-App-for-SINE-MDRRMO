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
            $table->string('agency', 100)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('dispatch_time')->nullable();
            $table->dateTime('arrival_time')->nullable();
            $table->string('status', 50)->nullable();

            $table->foreign('request_id')->references('request_id')->on('emergency_requests')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
