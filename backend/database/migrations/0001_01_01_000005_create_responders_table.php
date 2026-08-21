<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('responders', function (Blueprint $table) {
            $table->integer('responder_id')->autoIncrement();
            $table->string('name', 100)->nullable();
            $table->string('role', 50)->nullable();
            $table->string('contact', 20)->nullable();
            $table->string('status', 50)->nullable();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
