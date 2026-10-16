<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('bank_name', 100);
            $table->string('account_name', 150);
            $table->string('account_number', 50)->nullable();
            $table->char('currency_code', 3);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('currency_code');
        });

        Schema::create('bank_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
            $table->date('balance_date');
            $table->decimal('amount', 15, 2);
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->unique(['bank_account_id', 'balance_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_balances');
        Schema::dropIfExists('bank_accounts');
    }
};
