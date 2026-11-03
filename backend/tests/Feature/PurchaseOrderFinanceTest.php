<?php

namespace Tests\Feature;

use App\Models\PurchaseApiConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PurchaseOrderFinanceTest extends TestCase
{
    use RefreshDatabase;

    private function authenticate(): void
    {
        User::factory()->create([
            'email' => 'finanzas@example.com',
            'password' => 'password',
            'profile' => 'finanzas',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'finanzas@example.com',
            'password' => 'password',
        ])->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token);

        PurchaseApiConfig::query()->create([
            'provider' => 'gestion-compras',
            'base_url' => 'https://compras.test/api',
            'public_token' => 'stored-token',
        ]);
    }

    public function test_order_finance_unwraps_data_from_gestion_compras(): void
    {
        $this->authenticate();

        // Formato real de ExternalOrderFinanceController::show en gestion-compras.
        Http::fake([
            'https://compras.test/api/public/orders/OS-26-2658/finanzas' => Http::response([
                'success' => true,
                'data' => [
                    'order_id' => 1945,
                    'order_number' => 'OS-26-2658',
                    'order_date' => '2026-07-23',
                    'order_total' => 185.5,
                    'compromisos' => [
                        ['id' => 10, 'etapa' => 'COMPROMISO', 'fecha' => '2026-07-31', 'importe' => 185.5, 'numero_factura' => null],
                    ],
                    'facturados' => [
                        ['id' => 11, 'etapa' => 'FACTURADO', 'fecha' => '2026-07-25', 'importe' => 185.5, 'numero_factura' => 'F001-0017024'],
                    ],
                    'pagados' => [],
                    'summary' => [
                        'comprometido' => 185.5,
                        'facturado' => 185.5,
                        'pagado' => 0,
                        'saldo_por_facturar' => 0,
                        'saldo_por_pagar' => 185.5,
                    ],
                ],
            ]),
        ]);

        $this->getJson('/api/integraciones/compras/ordenes/OS-26-2658/finanzas')
            ->assertOk()
            ->assertJsonPath('order_number', 'OS-26-2658')
            ->assertJsonCount(1, 'compromisos')
            ->assertJsonCount(1, 'facturados')
            ->assertJsonCount(0, 'pagados')
            ->assertJsonPath('facturados.0.numero_factura', 'F001-0017024')
            ->assertJsonPath('summary.saldo_por_pagar', 185.5)
            ->assertJsonMissingPath('success')
            ->assertJsonMissingPath('data');
    }

    public function test_order_finance_always_returns_lists_and_summary(): void
    {
        $this->authenticate();

        Http::fake(['*' => Http::response(['success' => true, 'data' => ['order_number' => 'OC-26-1617']])]);

        $this->getJson('/api/integraciones/compras/ordenes/OC-26-1617/finanzas')
            ->assertOk()
            ->assertJsonPath('compromisos', [])
            ->assertJsonPath('facturados', [])
            ->assertJsonPath('pagados', [])
            ->assertJsonPath('summary.comprometido', 0);
    }
}
