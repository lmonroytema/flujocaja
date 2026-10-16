<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('parent_project_code', 30)->nullable()->after('project_name');
            $table->string('parent_project_name')->nullable()->after('parent_project_code');
            $table->decimal('actual_cost_price', 15, 2)->nullable()->after('estimated_sale_price');

            $table->index('parent_project_code');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['parent_project_code']);
            $table->dropColumn(['parent_project_code', 'parent_project_name', 'actual_cost_price']);
        });
    }
};
