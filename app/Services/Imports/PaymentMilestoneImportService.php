<?php

namespace App\Services\Imports;

use App\Models\ImportBatch;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Support\WorkbookReader;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class PaymentMilestoneImportService
{
    private const HEADERS = [
        '(No modificar) Hito de pago de proyecto',
        '(No modificar) Suma de comprobación de fila',
        '(No modificar) Fecha de modificación',
        'Proyecto',
        'Identificador',
        'Monto Valorizado',
        'Estado Alerta de Facturación',
        'Estatus',
        'Fecha Estimada de Facturación',
        'Fecha Real de Valorización',
        'Fecha Real de Facturación',
        'Fecha Estimada de Pago',
        'No. Factura',
        'Moneda',
        'Fecha Real de Cobro',
    ];

    public function __construct(
        private readonly WorkbookReader $reader,
    ) {
    }

    public function import(string $absolutePath, string $originalFileName): ImportBatch
    {
        $payload = $this->reader->read($absolutePath, self::HEADERS, ['Hito de pago de proyectos']);

        return DB::transaction(function () use ($absolutePath, $originalFileName, $payload) {
            $batch = ImportBatch::create([
                'source_type' => 'milestones',
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

            $projectsByCode = Project::query()->get()->keyBy('project_code');
            $inserted = 0;
            $updated = 0;
            $skipped = 0;
            $errors = [];

            foreach ($payload['rows'] as $index => $row) {
                $externalUuid = $row['(No modificar) Hito de pago de proyecto'];
                $sourceProjectText = $row['Proyecto'];
                $identifier = $row['Identificador'];

                if (! $externalUuid || ! $sourceProjectText || ! $identifier) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).': faltan datos obligatorios del hito.';
                    continue;
                }

                [$projectCode] = $this->splitProjectIdentifier((string) $sourceProjectText);
                $project = $projectsByCode->get($projectCode);

                if (! $project) {
                    $skipped++;
                    $errors[] = 'Fila '.($index + 2).": no existe el proyecto {$projectCode} para vincular el hito.";
                    continue;
                }

                [$milestoneCode, $milestoneName] = $this->splitMilestoneIdentifier((string) $identifier);

                $milestone = PaymentMilestone::firstOrNew(['external_uuid' => (string) $externalUuid]);
                $isNew = ! $milestone->exists;

                $milestone->fill([
                    'import_batch_id' => $batch->id,
                    'project_id' => $project->id,
                    'row_checksum' => (string) ($row['(No modificar) Suma de comprobación de fila'] ?? ''),
                    'source_modified_at' => $this->parseDateTime($row['(No modificar) Fecha de modificación']),
                    'source_project_text' => (string) $sourceProjectText,
                    'source_identifier_text' => (string) $identifier,
                    'milestone_code' => $milestoneCode,
                    'milestone_name' => $milestoneName,
                    'valued_amount' => $this->parseDecimal($row['Monto Valorizado']) ?? 0,
                    'billing_alert_status' => (string) ($row['Estado Alerta de Facturación'] ?? 'N/A'),
                    'milestone_status' => (string) ($row['Estatus'] ?? ''),
                    'estimated_billing_date' => $this->parseDate($row['Fecha Estimada de Facturación']),
                    'actual_valuation_date' => $this->parseDate($row['Fecha Real de Valorización']),
                    'actual_billing_date' => $this->parseDate($row['Fecha Real de Facturación']),
                    'estimated_payment_date' => $this->parseDate($row['Fecha Estimada de Pago']),
                    'invoice_number' => $row['No. Factura'],
                    'currency_code' => $this->normalizeCurrency($row['Moneda']),
                    'actual_collection_date' => $this->parseDate($row['Fecha Real de Cobro']),
                ]);
                $milestone->save();

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
    private function splitProjectIdentifier(string $value): array
    {
        $parts = array_map('trim', explode(';', $value, 2));

        return [$parts[0] ?: null, $parts[1] ?? $value];
    }

    /**
     * @return array{0: string|null, 1: string}
     */
    private function splitMilestoneIdentifier(string $value): array
    {
        $parts = array_map('trim', explode(':', $value, 2));

        return [$parts[0] ?: null, $parts[1] ?? $value];
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
