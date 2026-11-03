<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\Imports\ProjectImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ProjectImportExtraColumnsTest extends TestCase
{
    use RefreshDatabase;

    private const BASE_HEADERS = [
        '(No modificar) Proyecto',
        '(No modificar) Suma de comprobación de fila',
        '(No modificar) Fecha de modificación',
        'Fecha de adjudicación',
        'Identificador',
        'Cliente contratante',
        'Razón para el estado',
        'Unidad de negocio propietaria',
        'Moneda',
        'Precio de venta estimado',
        'Avance a la fecha %',
        'Margen real (%)',
        'Categoria Margen Real',
        'Margen estimado (%)',
        'Categoria Margen Estimado',
        '% Desviación Horas Totales',
        'Existencias',
        'Existencias (%)',
        'Coordinador de Proyecto',
        'Tipos de Existencias',
    ];

    private const EXTRA_HEADERS = [
        'Código del proyecto',
        'Cliente',
        'Nombre del proyecto',
        'Proyecto origen',
        'Precio de coste real',
    ];

    /** @var array<int, string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            @unlink($file);
        }

        parent::tearDown();
    }

    public function test_new_columns_take_precedence_over_identifier(): void
    {
        $path = $this->makeWorkbook(true, [
            $this->baseRow('7861ac6f-f00f-4f45-8542-5be849929d12', '64037; Nombre antiguo', 'CONTRATANTE S.A.') + [
                20 => '64037',
                21 => 'REPSOL EXPLORACION PERU SUCURSAL DEL PERU',
                22 => 'REPEXSA - Estudio de Adaptabilidad',
                23 => null,
                24 => 15230.5,
            ],
            $this->baseRow('cd014162-d378-49ba-900b-df2bf9f58676', '99999; Identificador desfasado', null) + [
                20 => '64062',
                21 => 'CIA MINERA ANTAMINA',
                22 => 'NEBA PPL',
                23 => '63713; Evaluacion Ambiental Marina y Suelos',
                24 => null,
            ],
        ]);

        $batch = app(ProjectImportService::class)->import($path, 'nuevo.xlsx');

        $this->assertSame(2, $batch->inserted_rows);
        $this->assertSame(0, $batch->skipped_rows);

        $first = Project::query()->where('project_code', '64037')->firstOrFail();
        $this->assertSame('REPEXSA - Estudio de Adaptabilidad', $first->project_name);
        $this->assertSame('REPSOL EXPLORACION PERU SUCURSAL DEL PERU', $first->client_name);
        $this->assertNull($first->parent_project_code);
        $this->assertNull($first->parent_project_name);
        $this->assertSame('15230.50', $first->actual_cost_price);

        $second = Project::query()->where('project_code', '64062')->firstOrFail();
        $this->assertSame('NEBA PPL', $second->project_name);
        $this->assertSame('CIA MINERA ANTAMINA', $second->client_name);
        $this->assertSame('63713', $second->parent_project_code);
        $this->assertSame('Evaluacion Ambiental Marina y Suelos', $second->parent_project_name);
        $this->assertNull($second->actual_cost_price);
        $this->assertSame('99999; Identificador desfasado', $second->source_identifier_text);
        $this->assertFalse(Project::query()->where('project_code', '99999')->exists());
    }

    public function test_old_workbook_without_new_columns_still_imports(): void
    {
        $path = $this->makeWorkbook(false, [
            $this->baseRow('dca5a0d6-6000-4a83-8210-945700aa7896', '63918; Diagnostico EIA Amazonas Norte', 'CONCESIONARIA IIRSA NORTE S.A.'),
        ]);

        $batch = app(ProjectImportService::class)->import($path, 'antiguo.xlsx');

        $this->assertSame(1, $batch->inserted_rows);

        $project = Project::query()->where('project_code', '63918')->firstOrFail();
        $this->assertSame('Diagnostico EIA Amazonas Norte', $project->project_name);
        $this->assertSame('CONCESIONARIA IIRSA NORTE S.A.', $project->client_name);
        $this->assertNull($project->parent_project_code);
        $this->assertNull($project->parent_project_name);
        $this->assertNull($project->actual_cost_price);
    }

    public function test_empty_new_columns_fall_back_to_identifier(): void
    {
        $path = $this->makeWorkbook(true, [
            $this->baseRow('8cfd1224-b133-4a8e-ac01-b093bae11a87', '63882; ITS reubicacion lineas ESC1+ESC3', 'OLYMPIC PERU INC SUCURSAL DEL PERU') + [
                20 => null,
                21 => '   ',
                22 => '',
                23 => null,
                24 => null,
            ],
        ]);

        app(ProjectImportService::class)->import($path, 'vacias.xlsx');

        $project = Project::query()->where('project_code', '63882')->firstOrFail();
        $this->assertSame('ITS reubicacion lineas ESC1+ESC3', $project->project_name);
        $this->assertSame('OLYMPIC PERU INC SUCURSAL DEL PERU', $project->client_name);
        $this->assertNull($project->parent_project_code);
        $this->assertNull($project->actual_cost_price);
    }

    public function test_projects_api_exposes_new_fields(): void
    {
        $path = $this->makeWorkbook(true, [
            $this->baseRow('35ebeb2b-9d91-4501-81f3-670e91221e32', '64062; NEBA PPL', null) + [
                20 => '64062',
                21 => 'CIA MINERA ANTAMINA',
                22 => 'NEBA PPL',
                23 => '63713; Evaluacion Ambiental Marina y Suelos',
                24 => 980,
            ],
        ]);

        app(ProjectImportService::class)->import($path, 'api.xlsx');

        $this->actingAsApiUser()
            ->getJson('/api/proyectos?code=64062')
            ->assertOk()
            ->assertJsonPath('data.0.parent_project_code', '63713')
            ->assertJsonPath('data.0.parent_project_name', 'Evaluacion Ambiental Marina y Suelos')
            ->assertJsonPath('data.0.actual_cost_price', '980.00')
            ->assertJsonPath('data.0.client_name', 'CIA MINERA ANTAMINA');
    }

    public function test_real_workbook_with_new_columns_is_imported(): void
    {
        $path = base_path('../Importaciones/SP Proyectos Producción 16-10-2026 9-59-57.xlsx');

        if (! is_file($path)) {
            $this->markTestSkipped('No está el Excel real del 16/10/2026.');
        }

        $batch = app(ProjectImportService::class)->import($path, basename($path));

        $this->assertSame(408, $batch->total_rows);
        $this->assertSame(0, $batch->skipped_rows);

        $project = Project::query()->where('project_code', '64062')->firstOrFail();
        $this->assertSame('63713', $project->parent_project_code);
        $this->assertSame('Evaluacion Ambiental Marina y Suelos', $project->parent_project_name);
        $this->assertSame(46, Project::query()->whereNotNull('parent_project_code')->count());
    }

    private function actingAsApiUser(): static
    {
        User::factory()->create([
            'email' => 'analista@example.com',
            'password' => 'password',
            'profile' => 'admin',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'analista@example.com',
            'password' => 'password',
        ])->json('token');

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * @return array<int, mixed>
     */
    private function baseRow(string $uuid, ?string $identifier, ?string $contractingClient): array
    {
        return [
            $uuid,
            'checksum',
            '10/13/2026 19:48',
            '10/13/2026',
            $identifier,
            $contractingClient,
            'Oferta',
            'PE-TL | Seguridad',
            'Dólar de EE. UU.',
            null,
            null,
            '0.00',
            null,
            '45.00',
            null,
            null,
            '0.00',
            '0.00',
            'Coordinador Prueba',
            null,
        ];
    }

    /**
     * @param array<int, array<int, mixed>> $rows
     */
    private function makeWorkbook(bool $withExtraColumns, array $rows): string
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('SP Proyectos Producción');

        $headers = $withExtraColumns ? [...self::BASE_HEADERS, ...self::EXTRA_HEADERS] : self::BASE_HEADERS;
        $sheet->fromArray($headers, null, 'A1');

        foreach ($rows as $index => $row) {
            $sheet->fromArray(array_slice($row + array_fill(0, count($headers), null), 0, count($headers)), null, 'A'.($index + 2), true);
        }

        if ($withExtraColumns) {
            $sheet->getStyle('Y2:Y'.(count($rows) + 1))->getNumberFormat()->setFormatCode('#,##0.00');
        }

        $path = tempnam(sys_get_temp_dir(), 'proj').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);
        $this->tempFiles[] = $path;

        return $path;
    }
}
