<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_reset_password')->default(false)->after('profile');
            $table->string('password_reset_code', 12)->nullable()->after('must_reset_password');
            $table->timestamp('password_reset_requested_at')->nullable()->after('password_reset_code');
            $table->timestamp('password_reset_expires_at')->nullable()->after('password_reset_requested_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'must_reset_password',
                'password_reset_code',
                'password_reset_requested_at',
                'password_reset_expires_at',
            ]);
        });
    }
};
