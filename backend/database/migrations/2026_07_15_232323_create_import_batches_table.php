<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('source_type', 30);
            $table->string('original_file_name');
            $table->string('sheet_name', 150);
            $table->string('stored_file_path')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('inserted_rows')->default(0);
            $table->unsignedInteger('updated_rows')->default(0);
            $table->unsignedInteger('skipped_rows')->default(0);
            $table->json('errors')->nullable();
            $table->timestamp('imported_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('source_type');
            $table->index('imported_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};
