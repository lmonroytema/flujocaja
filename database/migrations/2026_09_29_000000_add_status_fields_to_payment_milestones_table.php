<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_milestones', function (Blueprint $table) {
            $table->date('estimated_valuation_date')->nullable()->after('estimated_billing_date');
            $table->date('valuation_approval_date')->nullable()->after('actual_valuation_date');
            $table->date('invoice_received_date')->nullable()->after('actual_billing_date');
            $table->string('derived_status', 30)->nullable()->after('milestone_status');
            $table->string('status_owner', 30)->nullable()->after('derived_status');
            $table->boolean('status_mismatch')->default(false)->after('status_owner');
            $table->date('cash_date')->nullable()->after('actual_collection_date');

            $table->index('derived_status');
            $table->index('cash_date');
        });

        Schema::table('import_batches', function (Blueprint $table) {
            $table->unsignedInteger('deleted_rows')->default(0)->after('skipped_rows');
            $table->json('summary')->nullable()->after('errors');
        });
    }

    public function down(): void
    {
        Schema::table('payment_milestones', function (Blueprint $table) {
            $table->dropIndex(['derived_status']);
            $table->dropIndex(['cash_date']);
            $table->dropColumn([
                'estimated_valuation_date',
                'valuation_approval_date',
                'invoice_received_date',
                'derived_status',
                'status_owner',
                'status_mismatch',
                'cash_date',
            ]);
        });

        Schema::table('import_batches', function (Blueprint $table) {
            $table->dropColumn(['deleted_rows', 'summary']);
        });
    }
};
