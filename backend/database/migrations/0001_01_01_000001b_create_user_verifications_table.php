<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_verifications', function (Blueprint $table) {
            $table->integer('verification_id')->autoIncrement();
            $table->integer('user_id');
            $table->string('valid_id_type', 50)->nullable();
            $table->string('valid_id_number', 100)->nullable();
            $table->date('valid_id_expiry')->nullable();
            $table->json('valid_id_details')->nullable();
            $table->string('valid_id_proof', 255)->nullable();
            $table->string('valid_id_proof_back', 255)->nullable();
            $table->string('selfie_with_id_proof', 255)->nullable();
            $table->enum('verification_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('rejection_reason', 500)->nullable();
            $table->integer('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('created_at')->useCurrent()->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->nullable();

            $table->foreign('user_id')->references('user_id')->on('users')->cascadeOnDelete();
            $table->foreign('reviewed_by')->references('user_id')->on('users')->nullOnDelete();
            $table->index('user_id');
            $table->index('verification_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_verifications');
    }
};
