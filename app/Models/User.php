<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'name',
    'email',
    'password',
    'profile',
    'must_reset_password',
    'password_reset_code',
    'password_reset_requested_at',
    'password_reset_expires_at',
    'two_factor_enabled',
    'two_factor_code',
    'two_factor_code_requested_at',
    'two_factor_code_expires_at',
])]
#[Hidden(['password', 'remember_token', 'password_reset_code', 'two_factor_code'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_reset_password' => 'boolean',
            'password_reset_requested_at' => 'datetime',
            'password_reset_expires_at' => 'datetime',
            'two_factor_enabled' => 'boolean',
            'two_factor_code_requested_at' => 'datetime',
            'two_factor_code_expires_at' => 'datetime',
        ];
    }

    public function apiAccessTokens(): HasMany
    {
        return $this->hasMany(ApiAccessToken::class);
    }

    public function isAdmin(): bool
    {
        return $this->profile === 'admin';
    }
}
