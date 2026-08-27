<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('broadcasts', function (Blueprint $table) {
            $table->integer('broadcast_id')->autoIncrement();
            $table->string('title', 255)->nullable();
            $table->text('message')->nullable();
            $table->longText('media_files')->nullable();
            $table->boolean('is_active')->default(true)->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('created_at')->useCurrent()->nullable();
        });
    }

    public function down(): void
    {
        // Intentionally omitted dropIfExists to protect database tables from accidental deletion
    }
};
