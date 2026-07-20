<?php

namespace Tests\Feature;

use App\Models\ExchangeRate;
use App\Models\PaymentMilestone;
use App\Services\Imports\PaymentMilestoneImportService;
use App\Services\Imports\ProjectImportService;
use App\Services\Reports\IncomeCashFlowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashFlowReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_income_report_is_generated_from_imported_files(): void
    {
        app(ProjectImportService::class)->import(
            base_path('../Importaciones/SP Proyectos Producción 06-07-2026 7-21-18.xlsx'),
            'SP Proyectos Producción 06-07-2026 7-21-18.xlsx',
        );

        app(PaymentMilestoneImportService::class)->import(
            base_path('../Importaciones/Hito de pago de proyectos 06-07-2026 7-21-42.xlsx'),
            'Hito de pago de proyectos 06-07-2026 7-21-42.xlsx',
        );

        $report = app(IncomeCashFlowService::class)->buildMonthlyReport(2026, 7);

        $this->assertSame(1016, PaymentMilestone::count());
        $this->assertCount(5, $report['periodos']);
        $this->assertNotEmpty($report['filas']);
        $this->assertGreaterThan(0, $report['totalGeneralPen']);
        $this->assertSame(10, ExchangeRate::count());
    }
}
