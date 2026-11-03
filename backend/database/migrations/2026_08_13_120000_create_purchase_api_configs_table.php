<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_api_configs', function (Blueprint $table): void {
            $table->id();
            $table->string('provider')->unique();
            $table->string('base_url');
            $table->text('public_token');
            $table->string('connection_status', 20)->nullable();
            $table->text('connection_message')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_api_configs');
    }
};
