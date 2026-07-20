<?php

namespace App\Services\Imports;

use App\Models\ImportBatch;
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

    public function __construct(
        private readonly WorkbookReader $reader,
    ) {
    }

    public function import(string $absolutePath, string $originalFileName): ImportBatch
    {
        $payload = $this->reader->read($absolutePath, self::HEADERS, ['SP Proyectos Producción']);

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
                'errors' => [],
                'imported_at' => now(),
            ]);

            $inserted = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];

            foreach ($payload['rows'] as $index => $row) {
                $externalUuid = $row['(No modificar) Proyecto'];
                $identifier = $row['Identificador'];

                if (! $externalUuid || ! $identifier) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).': faltan identificadores obligatorios.';
                    continue;
                }

                [$projectCode, $projectName] = $this->splitIdentifier((string) $identifier);

                if (! $projectCode) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).': no se pudo extraer el código del proyecto.';
                    continue;
                }

                $project = Project::firstOrNew(['external_uuid' => (string) $externalUuid]);
                $isNew = ! $project->exists;

                $project->fill([
                    'import_batch_id' => $batch->id,
                    'row_checksum' => (string) ($row['(No modificar) Suma de comprobación de fila'] ?? ''),
                    'source_modified_at' => $this->parseDateTime($row['(No modificar) Fecha de modificación']),
                    'awarded_at' => $this->parseDate($row['Fecha de adjudicación']),
                    'project_code' => $projectCode,
                    'project_name' => $projectName,
                    'source_identifier_text' => (string) $identifier,
                    'client_name' => $row['Cliente contratante'],
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

                $isNew ? $inserted++ : $updated++;
            }

            $batch->update([
                'inserted_rows' => $inserted,
                'updated_rows' => $updated,
                'skipped_rows' => $skipped,
                'errors' => $errors,
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

    private function normalizeCurrency(mixed $currency): string
    {
        return str_contains(mb_strtolower((string) $currency), 'sol') ? 'PEN' : 'USD';
    }

    private function parseDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
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
