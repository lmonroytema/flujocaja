<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Services\Imports\ProjectImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_projects_workbook_is_imported_successfully(): void
    {
        $service = app(ProjectImportService::class);
        $path = base_path('../Importaciones/SP Proyectos Producción 06-07-2026 7-21-18.xlsx');
        $batch = $service->import($path, 'SP Proyectos Producción 06-07-2026 7-21-18.xlsx');

        $this->assertSame(343, Project::count());
        $this->assertSame(343, $batch->total_rows);
        $this->assertSame(343, $batch->inserted_rows);
        $this->assertSame('63890', Project::query()->where('project_code', '63890')->value('project_code'));
    }
}
