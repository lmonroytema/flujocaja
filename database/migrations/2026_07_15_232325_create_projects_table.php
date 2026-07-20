<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('external_uuid')->unique();
            $table->text('row_checksum');
            $table->timestamp('source_modified_at');
            $table->date('awarded_at')->nullable();
            $table->string('project_code', 30)->unique();
            $table->string('project_name');
            $table->string('source_identifier_text');
            $table->string('client_name')->nullable();
            $table->string('status_reason', 50);
            $table->string('business_unit');
            $table->char('currency_code', 3);
            $table->decimal('estimated_sale_price', 15, 2)->nullable();
            $table->decimal('progress_percent', 8, 2)->nullable();
            $table->decimal('real_margin_percent', 8, 2)->nullable();
            $table->string('real_margin_category', 10)->nullable();
            $table->decimal('estimated_margin_percent', 8, 2)->nullable();
            $table->string('estimated_margin_category', 10)->nullable();
            $table->decimal('total_hours_deviation_percent', 8, 2)->nullable();
            $table->decimal('inventory_amount', 15, 2)->nullable();
            $table->decimal('inventory_percent', 8, 2)->nullable();
            $table->string('project_coordinator', 150)->nullable();
            $table->string('inventory_types')->nullable();
            $table->timestamps();

            $table->index('status_reason');
            $table->index('business_unit');
            $table->index('currency_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
