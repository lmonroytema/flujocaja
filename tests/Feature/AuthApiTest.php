<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_and_access_protected_endpoint(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => 'password',
            'profile' => 'finanzas',
        ]);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $loginResponse
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'profile'],
            ]);

        $token = $loginResponse->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'test@example.com');
    }

    public function test_user_can_logout_and_token_becomes_invalid(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => 'password',
            'profile' => 'finanzas',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ])->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_user_must_reset_password_before_first_login(): void
    {
        User::factory()->create([
            'email' => 'sjamanca@tema.com.pe',
            'password' => 'Temporal2026!',
            'profile' => 'finanzas',
            'must_reset_password' => true,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'sjamanca@tema.com.pe',
            'password' => 'Temporal2026!',
        ])
            ->assertForbidden()
            ->assertJsonPath('requires_password_reset', true);
    }

    public function test_user_can_request_and_confirm_password_reset(): void
    {
        User::factory()->create([
            'email' => 'sjamanca@tema.com.pe',
            'password' => 'Temporal2026!',
            'profile' => 'finanzas',
            'must_reset_password' => true,
        ]);

        $requestResponse = $this->postJson('/api/auth/password-reset/request', [
            'email' => 'sjamanca@tema.com.pe',
        ]);

        $requestResponse
            ->assertOk()
            ->assertJsonStructure(['message', 'email']);

        $code = User::query()
            ->where('email', 'sjamanca@tema.com.pe')
            ->value('password_reset_code');

        $this->postJson('/api/auth/password-reset/confirm', [
            'email' => 'sjamanca@tema.com.pe',
            'code' => $code,
            'password' => 'NuevaClave2026!',
            'password_confirmation' => 'NuevaClave2026!',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'email' => 'sjamanca@tema.com.pe',
            'password' => 'NuevaClave2026!',
        ])->assertOk();
    }
}
