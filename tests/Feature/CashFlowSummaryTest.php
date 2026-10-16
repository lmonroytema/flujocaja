<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\CashFlowPeriod;
use App\Models\ExchangeRate;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Models\PurchaseApiConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class CashFlowSummaryTest extends TestCase
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
    }

    private function seedIncome(): void
    {
        $project = Project::query()->create([
            'external_uuid' => (string) Str::uuid(),
            'row_checksum' => 'x',
            'source_modified_at' => now(),
            'project_code' => '26001',
            'project_name' => 'Proyecto flujo',
            'source_identifier_text' => '26001',
            'status_reason' => 'En curso',
            'business_unit' => 'Servicios',
            'currency_code' => 'PEN',
        ]);

        $milestone = fn (string $currency, float $amount, string $cashDate) => PaymentMilestone::query()->create([
            'project_id' => $project->id,
            'external_uuid' => (string) Str::uuid(),
            'row_checksum' => 'x',
            'source_modified_at' => now(),
            'source_project_text' => '26001',
            'source_identifier_text' => '26001',
            'milestone_code' => 'H-'.$cashDate,
            'milestone_name' => 'Hito '.$cashDate,
            'valued_amount' => $amount,
            'billing_alert_status' => 'OK',
            'milestone_status' => 'Facturado',
            'currency_code' => $currency,
            'estimated_payment_date' => $cashDate,
            'cash_date' => $cashDate,
        ]);

        $milestone('PEN', 1000, '2026-07-08');
        $milestone('USD', 100, '2026-07-22');

        foreach ([[1, '2026-07-06', 3.6], [3, '2026-07-20', 3.5]] as [$sequence, $start, $rate]) {
            $period = CashFlowPeriod::query()->create([
                'report_year' => 2026,
                'report_month' => 7,
                'sequence' => $sequence,
                'start_date' => $start,
                'end_date' => date('Y-m-d', strtotime($start.' +4 days')),
                'label' => $start,
            ]);
            ExchangeRate::query()->create(['cash_flow_period_id' => $period->id, 'currency_code' => 'USD', 'rate_to_pen' => $rate]);
        }
    }

    private function seedBanks(): void
    {
        $pen = BankAccount::query()->create(['bank_name' => 'BCP', 'account_name' => 'Corriente Soles', 'currency_code' => 'PEN']);
        $pen->balances()->create(['balance_date' => '2026-06-30', 'amount' => 5000]);
        $pen->balances()->create(['balance_date' => '2026-07-10', 'amount' => 9999]);

        $usd = BankAccount::query()->create(['bank_name' => 'BBVA', 'account_name' => 'Corriente Dólares', 'currency_code' => 'USD']);
        $usd->balances()->create(['balance_date' => '2026-07-15', 'amount' => 200]);

        $inactive = BankAccount::query()->create(['bank_name' => 'IBK', 'account_name' => 'Cerrada', 'currency_code' => 'PEN', 'is_active' => false]);
        $inactive->balances()->create(['balance_date' => '2026-06-01', 'amount' => 777]);
    }

    public function test_summary_combines_bank_balance_income_and_purchase_expenses_in_pen(): void
    {
        $this->authenticate();
        $this->seedIncome();
        $this->seedBanks();

        PurchaseApiConfig::query()->create([
            'provider' => 'gestion-compras',
            'base_url' => 'https://compras.test/api',
            'public_token' => 'stored-token',
        ]);

        $financeRow = fn (string $week, string $stage, float $amount, string $project = 'P-1') => [
            'week_start' => $week,
            'week_end' => date('Y-m-d', strtotime($week.' +4 days')),
            'categoria_id' => 3,
            'categoria_nombre' => 'Repuestos',
            'proyecto_codigo' => $project,
            'proyecto_nombre' => 'Proyecto '.$project,
            'etapa' => $stage,
            'monto_soles' => $amount,
        ];

        Http::fake([
            'https://compras.test/api/public/reports/spend-by-week-category*' => Http::response([
                'success' => true,
                'data' => [
                    'spend_rows' => [],
                    'finance_rows' => [
                        $financeRow('2026-07-06', 'PAGADO', 300),
                        $financeRow('2026-07-27', 'COMPROMISO', 200),
                        $financeRow('2026-07-20', 'FACTURADO', 999),
                        $financeRow('2026-08-03', 'PAGADO', 50),
                        $financeRow('2026-07-27', 'PAGADO', 40, 'P-2'),
                    ],
                ],
            ]),
        ]);

        $response = $this->getJson('/api/flujo-caja/resumen?from=2026-07&to=2026-07')->assertOk();

        // Tipo de cambio: el de la semana, o el último anterior.
        $response
            ->assertJsonPath('tiposCambio.2026-07-06', 3.6)
            ->assertJsonPath('tiposCambio.2026-07-13', 3.6)
            ->assertJsonPath('tiposCambio.2026-07-20', 3.5)
            ->assertJsonPath('tiposCambio.2026-07-27', 3.5);

        // Ingresos en PEN: 1000 PEN y 100 USD × 3.5.
        $response
            ->assertJsonPath('ingresos.porSemana.2026-07-06', 1000)
            ->assertJsonPath('ingresos.porSemana.2026-07-13', 0)
            ->assertJsonPath('ingresos.porSemana.2026-07-20', 350)
            ->assertJsonPath('ingresos.total', 1350);

        // Saldo inicial: BCP al 30/06 (5000) + BBVA solo tiene saldo posterior (200 USD × 3.6); la inactiva no cuenta.
        $response
            ->assertJsonPath('saldoInicial.fechaInicio', '2026-07-06')
            ->assertJsonPath('saldoInicial.totalPen', 5720)
            ->assertJsonCount(2, 'saldoInicial.cuentas')
            ->assertJsonPath('saldoInicial.cuentas.0.fecha', '2026-06-30')
            ->assertJsonPath('saldoInicial.cuentas.0.posteriorAlInicio', false)
            ->assertJsonPath('saldoInicial.cuentas.1.posteriorAlInicio', true);

        // Gastos: solo PAGADO y COMPROMISO dentro del rango.
        $response
            ->assertJsonPath('gastos.disponible', true)
            ->assertJsonPath('gastos.porSemana.2026-07-06.pagado', 300)
            ->assertJsonPath('gastos.porSemana.2026-07-27.compromiso', 200)
            ->assertJsonPath('gastos.porSemana.2026-07-27.total', 240)
            ->assertJsonPath('gastos.totales.total', 540)
            ->assertJsonCount(2, 'gastos.filas')
            ->assertJsonPath('gastos.filas.0.proyectoCodigo', 'P-1')
            ->assertJsonPath('gastos.filas.0.totales.pagado', 300)
            ->assertJsonPath('gastos.filas.0.totales.compromiso', 200);

        $this->assertArrayNotHasKey('2026-07-20', $response->json('gastos.porSemana'));

        Http::assertSent(fn ($request) => str_contains($request->url(), 'from=2026-07-06')
            && str_contains($request->url(), 'to=2026-08-02'));
    }

    public function test_summary_still_works_when_purchases_integration_is_not_configured(): void
    {
        $this->authenticate();
        $this->seedIncome();

        $this->getJson('/api/flujo-caja/resumen?from=2026-07&to=2026-07')
            ->assertOk()
            ->assertJsonPath('gastos.disponible', false)
            ->assertJsonPath('gastos.mensaje', 'Primero debes configurar la integración con Gestión de Compras.')
            ->assertJsonPath('gastos.totales.total', 0)
            ->assertJsonPath('ingresos.total', 1350)
            ->assertJsonPath('saldoInicial.totalPen', 0);
    }

    public function test_bank_accounts_and_balances_can_be_managed(): void
    {
        $this->authenticate();

        $accountId = $this->postJson('/api/bancos/cuentas', [
            'bank_name' => ' BCP ',
            'account_name' => 'Corriente Soles',
            'account_number' => '193-123',
            'currency_code' => 'PEN',
        ])->assertCreated()->assertJsonPath('data.banco', 'BCP')->json('data.id');

        $this->postJson('/api/bancos/cuentas', ['bank_name' => 'X', 'account_name' => 'Y', 'currency_code' => 'EUR'])
            ->assertUnprocessable();

        $this->postJson("/api/bancos/cuentas/{$accountId}/saldos", ['balance_date' => '2026-10-15', 'amount' => 1500.5])
            ->assertCreated();
        // Mismo día: reemplaza el saldo.
        $balanceId = $this->postJson("/api/bancos/cuentas/{$accountId}/saldos", ['balance_date' => '2026-10-15', 'amount' => 1600])
            ->assertCreated()
            ->json('data.id');
        $this->postJson("/api/bancos/cuentas/{$accountId}/saldos", ['balance_date' => '2026-10-16', 'amount' => -20])
            ->assertCreated();

        $this->getJson('/api/bancos/cuentas')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonCount(2, 'data.0.saldos')
            ->assertJsonPath('data.0.saldos.0.fecha', '2026-10-16')
            ->assertJsonPath('data.0.saldos.1.monto', 1600);

        $this->putJson("/api/bancos/cuentas/{$accountId}", [
            'bank_name' => 'BCP',
            'account_name' => 'Corriente Soles',
            'currency_code' => 'PEN',
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.activa', false);

        $this->deleteJson("/api/bancos/saldos/{$balanceId}")->assertOk();
        $this->assertDatabaseCount('bank_balances', 1);

        $this->deleteJson("/api/bancos/cuentas/{$accountId}")->assertOk();
        $this->assertDatabaseCount('bank_accounts', 0);
        $this->assertDatabaseCount('bank_balances', 0);
    }
}
