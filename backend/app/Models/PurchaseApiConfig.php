<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseApiConfig extends Model
{
    protected $fillable = [
        'provider',
        'base_url',
        'public_token',
        'connection_status',
        'connection_message',
        'last_checked_at',
    ];

    protected function casts(): array
    {
        return [
            'public_token' => 'encrypted',
            'last_checked_at' => 'datetime',
        ];
    }
}
