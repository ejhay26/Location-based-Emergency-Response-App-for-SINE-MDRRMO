<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->integer('vehicle_id')->autoIncrement();
            $table->integer('responder_id')->nullable();
            $table->string('name', 100)->nullable();
            $table->string('type', 50)->nullable();
            $table->string('plate', 50)->nullable();
            $table->string('status', 50)->nullable();

            $table->foreign('responder_id')->references('responder_id')->on('responders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
