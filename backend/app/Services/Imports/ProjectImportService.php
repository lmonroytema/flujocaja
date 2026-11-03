<?php

namespace App\Services\Imports;

use App\Models\ImportBatch;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Support\WorkbookReader;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ProjectImportService
{
    private const HEADERS = [
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

    /**
     * Columnas agregadas al final del Excel de Project Hub. Si vienen llenas se usan en lugar de
     * separar el «Identificador»; en archivos antiguos (sin ellas) se mantiene el comportamiento previo.
     */
    public const OPTIONAL_HEADERS = [
        'Código del proyecto',
        'Cliente',
        'Nombre del proyecto',
        'Proyecto origen',
        'Precio de coste real',
    ];

    public function __construct(
        private readonly WorkbookReader $reader,
    ) {
    }

    public function import(string $absolutePath, string $originalFileName): ImportBatch
    {
        $payload = $this->reader->read(
            $absolutePath,
            self::HEADERS,
            ['SP Proyectos Producción'],
            self::OPTIONAL_HEADERS,
        );

        return DB::transaction(function () use ($absolutePath, $originalFileName, $payload) {
            $batch = ImportBatch::create([
                'source_type' => 'projects',
                'original_file_name' => $originalFileName,
                'sheet_name' => $payload['sheet_name'],
                'stored_file_path' => $absolutePath,
                'total_rows' => count($payload['rows']),
                'inserted_rows' => 0,
                'updated_rows' => 0,
                'skipped_rows' => 0,
                'deleted_rows' => 0,
                'errors' => [],
                'imported_at' => now(),
            ]);

            $inserted = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];
            $seenCodes = [];
            $keptIds = [];

            foreach ($payload['rows'] as $index => $row) {
                $externalUuid = $row['(No modificar) Proyecto'];
                $identifier = $row['Identificador'];

                $explicitCode = $this->nullableText($row['Código del proyecto'] ?? null);

                if (! $externalUuid || (! $identifier && ! $explicitCode)) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).': faltan identificadores obligatorios.';
                    continue;
                }

                [$identifierCode, $identifierName] = $this->splitIdentifier((string) $identifier);
                $projectCode = $explicitCode ?? $identifierCode;
                $projectName = $this->nullableText($row['Nombre del proyecto'] ?? null) ?? $identifierName;
                [$parentCode, $parentName] = $this->splitParentProject($row['Proyecto origen'] ?? null);

                if (! $projectCode) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).': no se pudo extraer el código del proyecto.';
                    continue;
                }

                if (isset($seenCodes[$projectCode])) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).": el código de proyecto {$projectCode} está duplicado en el archivo.";
                    continue;
                }

                // Se reutiliza el registro existente (por UUID o por código) para conservar su id y no
                // romper la relación con los hitos (payment_milestones.project_id con borrado en cascada).
                $project = Project::query()->where('external_uuid', (string) $externalUuid)->first()
                    ?? Project::query()->where('project_code', $projectCode)->first()
                    ?? new Project();
                $isNew = ! $project->exists;
                $project->external_uuid = (string) $externalUuid;

                $project->fill([
                    'import_batch_id' => $batch->id,
                    'row_checksum' => (string) ($row['(No modificar) Suma de comprobación de fila'] ?? ''),
                    'source_modified_at' => $this->parseDateTime($row['(No modificar) Fecha de modificación']),
                    'awarded_at' => $this->parseDate($row['Fecha de adjudicación']),
                    'project_code' => $projectCode,
                    'project_name' => $projectName,
                    'source_identifier_text' => (string) ($identifier ?? $projectCode.'; '.$projectName),
                    'client_name' => $this->nullableText($row['Cliente'] ?? null) ?? $row['Cliente contratante'],
                    'parent_project_code' => $parentCode,
                    'parent_project_name' => $parentName,
                    'actual_cost_price' => $this->parseDecimal($row['Precio de coste real'] ?? null),
                    'status_reason' => (string) ($row['Razón para el estado'] ?? ''),
                    'business_unit' => (string) ($row['Unidad de negocio propietaria'] ?? ''),
                    'currency_code' => $this->normalizeCurrency($row['Moneda']),
                    'estimated_sale_price' => $this->parseDecimal($row['Precio de venta estimado']),
                    'progress_percent' => $this->parseDecimal($row['Avance a la fecha %']),
                    'real_margin_percent' => $this->parseDecimal($row['Margen real (%)']),
                    'real_margin_category' => $row['Categoria Margen Real'],
                    'estimated_margin_percent' => $this->parseDecimal($row['Margen estimado (%)']),
                    'estimated_margin_category' => $row['Categoria Margen Estimado'],
                    'total_hours_deviation_percent' => $this->parseDecimal($row['% Desviación Horas Totales']),
                    'inventory_amount' => $this->parseDecimal($row['Existencias']),
                    'inventory_percent' => $this->parseDecimal($row['Existencias (%)']),
                    'project_coordinator' => $row['Coordinador de Proyecto'],
                    'inventory_types' => $row['Tipos de Existencias'],
                ]);
                $project->save();

                $seenCodes[$projectCode] = true;
                $keptIds[] = $project->id;
                $isNew ? $inserted++ : $updated++;
            }

            if ($keptIds === []) {
                throw new \InvalidArgumentException('El archivo no contiene proyectos válidos; no se reemplazó la información.');
            }

            // Reemplazo total: los proyectos que ya no vienen en el archivo se eliminan
            // (sus hitos se eliminan en cascada por la llave foránea).
            $removedMilestones = PaymentMilestone::query()->whereNotIn('project_id', $keptIds)->count();
            $deleted = Project::query()->whereNotIn('id', $keptIds)->delete();

            $batch->update([
                'inserted_rows' => $inserted,
                'updated_rows' => $updated,
                'skipped_rows' => $skipped,
                'deleted_rows' => $deleted,
                'errors' => $errors,
                'summary' => [
                    'modo' => 'reemplazo_total',
                    'proyectosEliminados' => $deleted,
                    'hitosEliminadosEnCascada' => $removedMilestones,
                ],
            ]);

            return $batch->fresh();
        });
    }

    /**
     * @return array{0: string|null, 1: string}
     */
    private function splitIdentifier(string $identifier): array
    {
        $parts = array_map('trim', explode(';', $identifier, 2));

        return [$parts[0] ?: null, $parts[1] ?? $identifier];
    }

    /**
     * «Proyecto origen» llega como «63713; Evaluacion Ambiental Marina y Suelos» o vacío.
     *
     * @return array{0: string|null, 1: string|null}
     */
    private function splitParentProject(mixed $value): array
    {
        $text = $this->nullableText($value);

        if ($text === null) {
            return [null, null];
        }

        if (! str_contains($text, ';')) {
            return preg_match('/^\d+$/', $text) ? [$text, null] : [null, $text];
        }

        [$code, $name] = array_map('trim', explode(';', $text, 2));

        return [$code !== '' ? $code : null, $name !== '' ? $name : null];
    }

    private function nullableText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }

    private function normalizeCurrency(mixed $currency): string
    {
        return str_contains(mb_strtolower((string) $currency), 'sol') ? 'PEN' : 'USD';
    }

    private function parseDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value)) {
            // Celdas con formato de miles («12,345.60») llegan como texto.
            $value = str_replace(',', '', $value);
        }

        return round((float) $value, 2);
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value))->startOfDay();
        }

        return Carbon::parse((string) $value)->startOfDay();
    }

    private function parseDateTime(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value));
        }

        return Carbon::parse((string) $value);
    }
}
