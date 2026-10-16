<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PaymentMilestone extends Model
{
    protected $fillable = [
        'import_batch_id',
        'project_id',
        'external_uuid',
        'row_checksum',
        'source_modified_at',
        'source_project_text',
        'source_identifier_text',
        'milestone_code',
        'milestone_name',
        'valued_amount',
        'billing_alert_status',
        'milestone_status',
        'estimated_billing_date',
        'actual_valuation_date',
        'actual_billing_date',
        'estimated_payment_date',
        'invoice_number',
        'currency_code',
        'actual_collection_date',
        'estimated_valuation_date',
        'valuation_approval_date',
        'invoice_received_date',
        'derived_status',
        'status_owner',
        'status_mismatch',
        'cash_date',
    ];

    protected $casts = [
        'source_modified_at' => 'datetime',
        'valued_amount' => 'decimal:2',
        'estimated_billing_date' => 'date',
        'actual_valuation_date' => 'date',
        'actual_billing_date' => 'date',
        'estimated_payment_date' => 'date',
        'actual_collection_date' => 'date',
        'estimated_valuation_date' => 'date',
        'valuation_approval_date' => 'date',
        'invoice_received_date' => 'date',
        'cash_date' => 'date',
        'status_mismatch' => 'boolean',
    ];

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
