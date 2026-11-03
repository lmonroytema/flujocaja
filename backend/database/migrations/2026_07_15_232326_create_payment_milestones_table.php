<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->uuid('external_uuid')->unique();
            $table->text('row_checksum');
            $table->timestamp('source_modified_at');
            $table->string('source_project_text');
            $table->string('source_identifier_text', 500);
            $table->string('milestone_code', 255)->nullable();
            $table->string('milestone_name', 500);
            $table->decimal('valued_amount', 15, 2)->default(0);
            $table->string('billing_alert_status', 50);
            $table->string('milestone_status', 50);
            $table->date('estimated_billing_date')->nullable();
            $table->date('actual_valuation_date')->nullable();
            $table->date('actual_billing_date')->nullable();
            $table->date('estimated_payment_date')->nullable();
            $table->string('invoice_number', 50)->nullable();
            $table->char('currency_code', 3);
            $table->date('actual_collection_date')->nullable();
            $table->timestamps();

            $table->index('project_id');
            $table->index('milestone_status');
            $table->index('estimated_payment_date');
            $table->index('actual_collection_date');
            $table->index('currency_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_milestones');
    }
};
