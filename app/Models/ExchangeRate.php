<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    protected $fillable = [
        'cash_flow_period_id',
        'currency_code',
        'rate_to_pen',
    ];

    protected $casts = [
        'rate_to_pen' => 'decimal:4',
    ];

    public function cashFlowPeriod(): BelongsTo
    {
        return $this->belongsTo(CashFlowPeriod::class);
    }
}
