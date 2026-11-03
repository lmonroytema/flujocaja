<?php

namespace Tests\Feature;

use App\Models\PaymentMilestone;
use App\Models\User;
use App\Services\Imports\PaymentMilestoneImportService;
use App\Services\Imports\ProjectImportService;
use App\Services\Reports\WeeklyCashFlowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WeeklyCashFlowReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(ProjectImportService::class)->import(
            base_path('../Importaciones/SP Proyectos Producción 06-07-2026 7-21-18.xlsx'),
            'SP Proyectos Producción 06-07-2026 7-21-18.xlsx',
        );
        app(PaymentMilestoneImportService::class)->import(
            base_path('../Importaciones/Hito de pago de proyectos 06-07-2026 7-21-42.xlsx'),
            'Hito de pago de proyectos 06-07-2026 7-21-42.xlsx',
        );
    }

    public function test_weeks_belong_to_the_month_of_their_monday(): void
    {
        $report = app(WeeklyCashFlowService::class)->build(['from' => '2026-06', 'to' => '2026-07']);

        $june = array_column($report['meses'][0]['semanas'], 'clave');
        $july = array_column($report['meses'][1]['semanas'], 'clave');

        // Lunes 29/06/2026 pertenece a junio aunque su viernes sea 03/07.
        $this->assertSame(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'], $june);
        $this->assertSame(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'], $july);
        $this->assertSame(9, $report['totalSemanas']);
    }

    public function test_one_row_per_project_with_amounts_split_by_currency(): void
    {
        $report = app(WeeklyCashFlowService::class)->build(['scope' => 'all'], ['include_undated' => false]);

        $codes = array_column($report['filas'], 'codigoProyecto');
        $this->assertSame(count($codes), count(array_unique($codes)));

        $expectedUsd = round((float) PaymentMilestone::query()->whereNotNull('cash_date')->where('currency_code', 'USD')->sum('valued_amount'), 2);
        $expectedPen = round((float) PaymentMilestone::query()->whereNotNull('cash_date')->where('currency_code', 'PEN')->sum('valued_amount'), 2);

        $this->assertEqualsWithDelta($expectedUsd, $report['totales']['general']['USD'], 0.05);
        $this->assertEqualsWithDelta($expectedPen, $report['totales']['general']['PEN'], 0.05);
        $this->assertSame('2019-09', $report['desde']);
        $this->assertSame('todo', $report['alcance']);
    }

    public function test_undated_milestones_are_reported_in_sin_fecha(): void
    {
        $report = app(WeeklyCashFlowService::class)->build(['from' => '2026-07', 'to' => '2026-07']);

        $undatedMilestones = collect($report['filas'])->sum(fn (array $row) => count($row['sinFecha']['hitos']));

        $this->assertSame(251, $undatedMilestones);
        $this->assertGreaterThan(0, $report['totales']['sinFecha']['USD'] + $report['totales']['sinFecha']['PEN']);
    }

    public function test_project_scope_covers_the_whole_project_and_filters(): void
    {
        $report = app(WeeklyCashFlowService::class)->build(['scope' => 'all'], ['code' => '61795']);

        $this->assertCount(1, $report['filas']);
        $this->assertGreaterThan(40, count($report['meses']));

        $mismatches = app(WeeklyCashFlowService::class)->build(['scope' => 'all'], ['mismatch' => true]);
        $this->assertSame(16, $mismatches['discrepancias']);
    }

    public function test_weekly_endpoint_responds(): void
    {
        User::factory()->create([
            'email' => 'weekly@example.com',
            'password' => 'password',
            'profile' => 'finanzas',
        ]);
        $plain = $this->postJson('/api/auth/login', [
            'email' => 'weekly@example.com',
            'password' => 'password',
        ])->json('token');

        $this->withHeader('Authorization', 'Bearer '.$plain)
            ->getJson('/api/flujo-caja/ingresos/semanal?from=2026-07&to=2026-09&per_page=10')
            ->assertOk()
            ->assertJsonStructure(['meses', 'filas', 'meta', 'totales' => ['general', 'sinFecha', 'porSemana'], 'estados']);
    }
}
