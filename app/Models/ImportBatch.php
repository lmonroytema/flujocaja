<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class ImportBatch extends Model
{
    protected $fillable = [
        'source_type',
        'original_file_name',
        'sheet_name',
        'stored_file_path',
        'total_rows',
        'inserted_rows',
        'updated_rows',
        'skipped_rows',
        'errors',
        'imported_at',
        'notes',
    ];

    protected $casts = [
        'errors' => 'array',
        'imported_at' => 'datetime',
    ];

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function paymentMilestones(): HasMany
    {
        return $this->hasMany(PaymentMilestone::class);
    }
}
