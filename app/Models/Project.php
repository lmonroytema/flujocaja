<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'import_batch_id',
        'external_uuid',
        'row_checksum',
        'source_modified_at',
        'awarded_at',
        'project_code',
        'project_name',
        'source_identifier_text',
        'client_name',
        'status_reason',
        'business_unit',
        'currency_code',
        'estimated_sale_price',
        'progress_percent',
        'real_margin_percent',
        'real_margin_category',
        'estimated_margin_percent',
        'estimated_margin_category',
        'total_hours_deviation_percent',
        'inventory_amount',
        'inventory_percent',
        'project_coordinator',
        'inventory_types',
    ];

    protected $casts = [
        'source_modified_at' => 'datetime',
        'awarded_at' => 'date',
        'estimated_sale_price' => 'decimal:2',
        'progress_percent' => 'decimal:2',
        'real_margin_percent' => 'decimal:2',
        'estimated_margin_percent' => 'decimal:2',
        'total_hours_deviation_percent' => 'decimal:2',
        'inventory_amount' => 'decimal:2',
        'inventory_percent' => 'decimal:2',
    ];

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }

    public function paymentMilestones(): HasMany
    {
        return $this->hasMany(PaymentMilestone::class);
    }
}
