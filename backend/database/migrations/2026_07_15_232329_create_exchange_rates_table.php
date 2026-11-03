<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_flow_period_id')->constrained()->cascadeOnDelete();
            $table->char('currency_code', 3);
            $table->decimal('rate_to_pen', 10, 4);
            $table->timestamps();

            $table->unique(['cash_flow_period_id', 'currency_code']);
            $table->index('currency_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};
