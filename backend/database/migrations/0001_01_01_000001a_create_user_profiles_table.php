<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->integer('profile_id')->autoIncrement();
            $table->integer('user_id')->unique();
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->string('username', 50)->nullable()->unique();
            $table->string('phone', 20)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('profile_picture', 255)->default('https://ionicframework.com/docs/img/demos/avatar.svg')->nullable();
            $table->integer('barangay_id')->nullable();
            $table->boolean('setup_completed')->default(false);
            $table->timestamp('created_at')->useCurrent()->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->nullable();

            $table->foreign('user_id')->references('user_id')->on('users')->cascadeOnDelete();
            $table->foreign('barangay_id')->references('barangay_id')->on('barangays')->nullOnDelete();
            $table->index('user_id');
            $table->index('username');
            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};
