<?php
// GENERATE THIS FILE WITH:
//   php artisan make:migration create_user_settings_table
// Then replace its content with this, then run:
//   php artisan migrate
//
// Settings keys currently used:
//   dark_mode            "true" | "false"  — sync dark mode across devices
//   location_auto_fetch  "true" | "false"  — auto-pan report map to user on open
//
// All values are strings — add new keys without schema changes.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    { 
        if (!Schema::hasTable('user_settings')) {
        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->string('key', 64);
            $table->string('value', 255)->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['user_id', 'key']);
            $table->foreign('user_id')
                  ->references('user_id')
                  ->on('users')
                  ->onDelete('cascade');
        });
        }
    }

    public function down(): void
    {
        // Schema::dropIfExists('user_settings');
    }
};