<?php

namespace Tests\Feature;

use App\Models\PurchaseApiConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PurchasesWeeklySpendTest extends TestCase
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

    public function test_weekly_spend_maps_wrapped_report_rows_by_week_project_and_category(): void
    {
        $this->authenticate();

        // Formato real de ExternalAnalyticsController::spendByWeekCategory en gestion-compras.
        Http::fake([
            'https://compras.test/api/public/reports/spend-by-week-category*' => Http::response([
                'success' => true,
                'data' => [
                    'spend_summary' => ['compras_soles' => 150.0, 'servicios_soles' => 400.0, 'total_soles' => 550.0],
                    'finance_summary' => ['compromiso_soles' => 185.5, 'facturado_soles' => 185.5, 'pagado_soles' => 0, 'total_soles' => 371.0],
                    'spend_rows' => [
                        [
                            'week_start' => '2026-07-20', 'week_end' => '2026-07-24',
                            'categoria_id' => 3, 'categoria_nombre' => 'Repuestos',
                            'proyecto_codigo' => 'P-047', 'proyecto_nombre' => 'Proyecto 47',
                            'compras_soles' => 100.0, 'servicios_soles' => 400.0, 'total_soles' => 500.0,
                        ],
                        [
                            'week_start' => '2026-07-27', 'week_end' => '2026-07-31',
                            'categoria_id' => 4, 'categoria_nombre' => 'Servicios',
                            'proyecto_codigo' => 'SIN-PROYECTO', 'proyecto_nombre' => 'Sin proyecto',
                            'compras_soles' => 50.0, 'servicios_soles' => 0.0, 'total_soles' => 50.0,
                        ],
                    ],
                    'spend_weeks' => [],
                    'finance_rows' => [
                        [
                            'week_start' => '2026-07-20', 'week_end' => '2026-07-24',
                            'categoria_id' => 3, 'categoria_nombre' => 'Repuestos',
                            'proyecto_codigo' => 'P-047', 'proyecto_nombre' => 'Proyecto 47',
                            'etapa' => 'FACTURADO', 'monto_soles' => 185.5,
                        ],
                        [
                            'week_start' => '2026-07-27', 'week_end' => '2026-07-31',
                            'categoria_id' => 3, 'categoria_nombre' => 'Repuestos',
                            'proyecto_codigo' => 'P-047', 'proyecto_nombre' => 'Proyecto 47',
                            'etapa' => 'COMPROMISO', 'monto_soles' => 185.5,
                        ],
                    ],
                    'finance_weeks' => [],
                ],
            ]),
        ]);

        $response = $this->getJson('/api/integraciones/compras/gastos-semanales?from=2026-07-01&to=2026-09-01')
            ->assertOk()
            ->assertJsonPath('spend_summary.total_soles', 550)
            ->assertJsonPath('finance_summary.facturado_soles', 185.5)
            ->assertJsonCount(2, 'spend_rows')
            ->assertJsonCount(3, 'display_rows');

        $this->assertSame([
            [
                'week_start' => '2026-07-20', 'week_end' => '2026-07-24',
                'project_code' => 'P-047', 'category' => 'Repuestos', 'etapa' => 'FACTURADO',
                'compras' => 100, 'servicios' => 400, 'compromiso' => 0, 'facturado' => 185.5, 'pagado' => 0,
            ],
            [
                'week_start' => '2026-07-27', 'week_end' => '2026-07-31',
                'project_code' => 'P-047', 'category' => 'Repuestos', 'etapa' => 'COMPROMISO',
                'compras' => 0, 'servicios' => 0, 'compromiso' => 185.5, 'facturado' => 0, 'pagado' => 0,
            ],
            [
                'week_start' => '2026-07-27', 'week_end' => '2026-07-31',
                'project_code' => 'SIN-PROYECTO', 'category' => 'Servicios', 'etapa' => '',
                'compras' => 50, 'servicios' => 0, 'compromiso' => 0, 'facturado' => 0, 'pagado' => 0,
            ],
        ], $response->json('display_rows'));

        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Public-Token', 'stored-token')
            && str_contains($request->url(), 'from=2026-07-01'));
    }

    public function test_weekly_spend_fails_clearly_when_base_url_returns_html(): void
    {
        $this->authenticate();

        Http::fake(['*' => Http::response('<!doctype html><html></html>', 200, ['Content-Type' => 'text/html'])]);

        $this->getJson('/api/integraciones/compras/gastos-semanales?from=2026-07-01&to=2026-09-01')
            ->assertStatus(502)
            ->assertJsonPath('message', fn (string $message) => str_contains($message, '/api'));
    }
}
