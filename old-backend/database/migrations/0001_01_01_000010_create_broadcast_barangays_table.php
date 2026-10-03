<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('broadcast_barangays', function (Blueprint $table) {
            $table->integer('broadcast_id');
            $table->integer('barangay_id');

            $table->primary(['broadcast_id', 'barangay_id']);
            $table->foreign('broadcast_id')->references('broadcast_id')->on('broadcasts')->cascadeOnDelete();
            $table->foreign('barangay_id')->references('barangay_id')->on('barangays')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
