<?php

namespace Tests\Feature;

use App\Models\PurchaseApiConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseIntegrationConfigTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => 'password',
            'profile' => 'admin',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token);
    }

    private function saveConfig(): void
    {
        $this->putJson('/api/integraciones/compras/configuracion', [
            'base_url' => 'https://compras.test/api/',
            'public_token' => 'stored-token',
        ])->assertOk()->assertJsonPath('config.has_token', true);
    }

    public function test_testing_after_save_with_empty_token_uses_stored_config_and_marks_it_valid(): void
    {
        $this->actingAsAdmin();
        $this->saveConfig();

        Http::fake(['https://compras.test/api/public/categorias' => Http::response([['id' => 1], ['id' => 2]])]);

        $this->postJson('/api/integraciones/compras/configuracion/probar', [
            'base_url' => 'https://compras.test/api',
            'public_token' => '',
        ])
            ->assertOk()
            ->assertJsonPath('config.connection_status', 'valid')
            ->assertJsonPath('categories_count', 2);

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Public-Token', 'stored-token'));
        $this->assertSame('valid', PurchaseApiConfig::query()->first()->connection_status);
    }

    public function test_testing_with_no_payload_uses_stored_config(): void
    {
        $this->actingAsAdmin();
        $this->saveConfig();

        Http::fake(['*' => Http::response([])]);

        $this->postJson('/api/integraciones/compras/configuracion/probar', [])
            ->assertOk()
            ->assertJsonPath('config.connection_status', 'valid');

        $this->assertSame('valid', PurchaseApiConfig::query()->first()->connection_status);
    }

    public function test_testing_a_new_base_url_with_empty_token_reuses_stored_token_without_persisting(): void
    {
        $this->actingAsAdmin();
        $this->saveConfig();

        Http::fake(['https://otra.test/api/public/categorias' => Http::response([])]);

        $this->postJson('/api/integraciones/compras/configuracion/probar', [
            'base_url' => 'https://otra.test/api',
            'public_token' => '',
        ])
            ->assertOk()
            ->assertJsonPath('config.base_url', 'https://otra.test/api');

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Public-Token', 'stored-token'));
        $this->assertNull(PurchaseApiConfig::query()->first()->connection_status);
    }

    public function test_testing_without_stored_token_still_requires_token(): void
    {
        $this->actingAsAdmin();
        Http::fake();

        $this->postJson('/api/integraciones/compras/configuracion/probar', [
            'base_url' => 'https://compras.test/api',
            'public_token' => '',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Debes indicar la Base URL y el Public Token para probar la conexión.');

        Http::assertNothingSent();
    }

    public function test_testing_a_base_url_that_returns_html_fails_and_marks_config_as_error(): void
    {
        $this->actingAsAdmin();
        $this->saveConfig();

        // Base URL sin /api: el servidor devuelve la SPA de gestion-compras con 200.
        Http::fake(['*' => Http::response('<!doctype html><html lang="es"><head></head></html>', 200, ['Content-Type' => 'text/html'])]);

        $this->postJson('/api/integraciones/compras/configuracion/probar', [])
            ->assertStatus(502)
            ->assertJsonPath('message', fn (string $message) => str_contains($message, '/api'));

        $config = PurchaseApiConfig::query()->first();
        $this->assertSame('error', $config->connection_status);
        $this->assertStringContainsString('/api', $config->connection_message);
    }
}
