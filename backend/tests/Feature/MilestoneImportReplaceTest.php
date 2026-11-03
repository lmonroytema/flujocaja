<?php

namespace Tests\Feature;

use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Services\Imports\PaymentMilestoneImportService;
use App\Services\Imports\ProjectImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneImportReplaceTest extends TestCase
{
    use RefreshDatabase;

    private const PROJECTS_FILE = 'SP Proyectos Producción 06-07-2026 7-21-18.xlsx';

    private const MILESTONES_FILE = 'Hito de pago de proyectos 06-07-2026 7-21-42.xlsx';

    private function importAll(): void
    {
        app(ProjectImportService::class)->import(base_path('../Importaciones/'.self::PROJECTS_FILE), self::PROJECTS_FILE);
        app(PaymentMilestoneImportService::class)->import(base_path('../Importaciones/'.self::MILESTONES_FILE), self::MILESTONES_FILE);
    }

    public function test_import_derives_status_and_flags_mismatches(): void
    {
        $this->importAll();

        $counts = PaymentMilestone::query()
            ->selectRaw('derived_status, COUNT(*) as total')
            ->groupBy('derived_status')
            ->pluck('total', 'derived_status')
            ->map(fn ($value) => (int) $value)
            ->all();

        $this->assertSame(515, $counts['Cobrado']);
        $this->assertSame(230, $counts['Facturado']);
        $this->assertSame(20, $counts['Valorizado']);
        $this->assertSame(1, $counts['En curso']);
        // 12 hitos con Estatus "En Curso" sin FEF ni FEP pasan a No iniciado (con discrepancia), según la matriz.
        $this->assertSame(250, $counts['No iniciado']);
        $this->assertSame(16, PaymentMilestone::query()->where('status_mismatch', true)->count());
        // 250 hitos sin ninguna fecha + 1 que solo tiene Fecha Real de Valorización.
        $this->assertSame(251, PaymentMilestone::query()->whereNull('cash_date')->count());

        $collected = PaymentMilestone::query()->whereNotNull('actual_collection_date')->first();
        $this->assertTrue($collected->cash_date->equalTo($collected->actual_collection_date));
        $this->assertSame('Julissa', $collected->status_owner);
    }

    public function test_reimport_replaces_all_milestones(): void
    {
        $this->importAll();

        $project = Project::query()->first();
        PaymentMilestone::query()->create([
            'project_id' => $project->id,
            'external_uuid' => '00000000-0000-0000-0000-000000000001',
            'row_checksum' => 'x',
            'source_modified_at' => now(),
            'source_project_text' => 'x',
            'source_identifier_text' => 'H99: obsoleto',
            'milestone_name' => 'obsoleto',
            'valued_amount' => 1,
            'billing_alert_status' => 'N/A',
            'milestone_status' => 'No Iniciado',
            'currency_code' => 'PEN',
        ]);
        PaymentMilestone::query()->where('id', '>', 0)->limit(1)->update(['valued_amount' => 999999]);

        $batch = app(PaymentMilestoneImportService::class)->import(
            base_path('../Importaciones/'.self::MILESTONES_FILE),
            self::MILESTONES_FILE,
        );

        $this->assertSame(1016, PaymentMilestone::count());
        $this->assertSame(1017, $batch->deleted_rows);
        $this->assertSame(1016, $batch->inserted_rows);
        $this->assertFalse(PaymentMilestone::query()->where('external_uuid', '00000000-0000-0000-0000-000000000001')->exists());
        $this->assertFalse(PaymentMilestone::query()->where('valued_amount', 999999)->exists());
        $this->assertSame(16, $batch->summary['discrepancias']);
    }

    public function test_project_reimport_keeps_milestones_and_removes_missing_projects(): void
    {
        $this->importAll();

        $obsolete = Project::query()->create([
            'external_uuid' => '00000000-0000-0000-0000-00000000abcd',
            'row_checksum' => 'x',
            'source_modified_at' => now(),
            'project_code' => '99999',
            'project_name' => 'Proyecto obsoleto',
            'source_identifier_text' => '99999; Proyecto obsoleto',
            'status_reason' => 'Plan',
            'business_unit' => 'X',
            'currency_code' => 'PEN',
        ]);

        $batch = app(ProjectImportService::class)->import(
            base_path('../Importaciones/'.self::PROJECTS_FILE),
            self::PROJECTS_FILE,
        );

        $this->assertSame(343, Project::count());
        $this->assertSame(1, $batch->deleted_rows);
        $this->assertFalse(Project::query()->whereKey($obsolete->id)->exists());
        $this->assertSame(1016, PaymentMilestone::count());
    }
}
