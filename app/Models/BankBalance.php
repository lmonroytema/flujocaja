<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankBalance extends Model
{
    protected $fillable = [
        'bank_account_id',
        'balance_date',
        'amount',
        'notes',
    ];

    protected $casts = [
        'balance_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }
}
