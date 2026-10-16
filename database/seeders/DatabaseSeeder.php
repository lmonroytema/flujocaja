<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => 'Susan Jamanca',
                'email' => 'sjamanca@tema.com.pe',
                'profile' => 'finanzas',
                'password' => 'Temporal2026!',
                'must_reset_password' => true,
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Sylvia Delgado',
                'email' => 'sdelgado@tema.com.pe',
                'profile' => 'finanzas',
                'password' => 'Temporal2026!',
                'must_reset_password' => true,
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Pere Milà',
                'email' => 'pmila@tema.es',
                'profile' => 'directivo',
                'password' => 'Temporal2026!',
                'must_reset_password' => true,
                'two_factor_enabled' => false,
            ],
            [
                'name' => 'Luis Monroy',
                'email' => 'lmonroy@tema.com.pe',
                'profile' => 'admin',
                'password' => 'Temporal2026!',
                'must_reset_password' => true,
                'two_factor_enabled' => true,
            ],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'profile' => $user['profile'],
                    'password' => $user['password'],
                    'must_reset_password' => $user['must_reset_password'],
                    'two_factor_enabled' => $user['two_factor_enabled'],
                    'password_reset_code' => 'TEMP01',
                    'password_reset_requested_at' => now(),
                    'password_reset_expires_at' => now()->addDays(30),
                ]
            );
        }
    }
}
