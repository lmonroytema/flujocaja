<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class CashFlowPeriod extends Model
{
    protected $fillable = [
        'report_year',
        'report_month',
        'sequence',
        'start_date',
        'end_date',
        'label',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function exchangeRates(): HasMany
    {
        return $this->hasMany(ExchangeRate::class);
    }
}
