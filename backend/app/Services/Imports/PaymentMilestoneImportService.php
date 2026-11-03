<?php

namespace App\Services\Imports;

use App\Models\ImportBatch;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Services\Milestones\MilestoneStatusResolver;
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

    /** Columnas que la matriz de estados usa pero que el export actual de Dataverse aún no trae. */
    public const OPTIONAL_HEADERS = [
        'Fecha Estimada de Valorización',
        'Fecha de Aprobación de la Valorización',
        'Fecha de recepción de factura',
    ];

    public function __construct(
        private readonly WorkbookReader $reader,
        private readonly MilestoneStatusResolver $statusResolver,
    ) {
    }

    /**
     * Importa el libro de hitos REEMPLAZANDO por completo los hitos existentes.
     * Todo ocurre dentro de una transacción: si algo falla no se pierde la información previa.
     */
    public function import(string $absolutePath, string $originalFileName): ImportBatch
    {
        $payload = $this->reader->read(
            $absolutePath,
            self::HEADERS,
            ['Hito de pago de proyectos'],
            self::OPTIONAL_HEADERS,
        );

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
                'deleted_rows' => 0,
                'errors' => [],
                'imported_at' => now(),
            ]);

            $deleted = PaymentMilestone::query()->delete();

            $projectsByCode = Project::query()->get()->keyBy('project_code');
            $inserted = 0;
            $skipped = 0;
            $errors = [];
            $seenUuids = [];
            $statusCounts = [];
            $mismatches = [];
            $mismatchCount = 0;
            $withoutDate = 0;

            foreach ($payload['rows'] as $index => $row) {
                $rowNumber = $index + 2;
                $externalUuid = $row['(No modificar) Hito de pago de proyecto'];
                $sourceProjectText = $row['Proyecto'];
                $identifier = $row['Identificador'];

                if (! $externalUuid || ! $sourceProjectText || ! $identifier) {
                    $skipped++;
                    $errors[] = "Fila {$rowNumber}: faltan datos obligatorios del hito.";
                    continue;
                }

                if (isset($seenUuids[(string) $externalUuid])) {
                    $skipped++;
                    $errors[] = "Fila {$rowNumber}: hito duplicado en el archivo ({$externalUuid}).";
                    continue;
                }

                [$projectCode] = $this->splitProjectIdentifier((string) $sourceProjectText);
                $project = $projectsByCode->get($projectCode);

                if (! $project) {
                    $skipped++;
                    $errors[] = "Fila {$rowNumber}: no existe el proyecto {$projectCode} para vincular el hito.";
                    continue;
                }

                [$milestoneCode, $milestoneName] = $this->splitMilestoneIdentifier((string) $identifier);

                $amount = $this->parseDecimal($row['Monto Valorizado']);

                if ($amount === null) {
                    $errors[] = "Fila {$rowNumber}: hito {$projectCode} {$milestoneCode} sin Monto Valorizado; se registra con 0.";
                }

                $dates = [
                    'estimated_billing_date' => $this->parseDate($row['Fecha Estimada de Facturación']),
                    'estimated_valuation_date' => $this->parseDate($row['Fecha Estimada de Valorización'] ?? null),
                    'actual_valuation_date' => $this->parseDate($row['Fecha Real de Valorización']),
                    'valuation_approval_date' => $this->parseDate($row['Fecha de Aprobación de la Valorización'] ?? null),
                    'actual_billing_date' => $this->parseDate($row['Fecha Real de Facturación']),
                    'invoice_received_date' => $this->parseDate($row['Fecha de recepción de factura'] ?? null),
                    'estimated_payment_date' => $this->parseDate($row['Fecha Estimada de Pago']),
                    'actual_collection_date' => $this->parseDate($row['Fecha Real de Cobro']),
                ];
                $invoiceNumber = $row['No. Factura'] !== null ? (string) $row['No. Factura'] : null;
                $sourceStatus = $row['Estatus'] !== null ? (string) $row['Estatus'] : '';

                $resolution = $this->statusResolver->resolve(
                    [...$dates, 'invoice_number' => $invoiceNumber],
                    $sourceStatus,
                );
                $cashDate = $this->statusResolver->cashDate($dates);

                PaymentMilestone::create([
                    'import_batch_id' => $batch->id,
                    'project_id' => $project->id,
                    'external_uuid' => (string) $externalUuid,
                    'row_checksum' => (string) ($row['(No modificar) Suma de comprobación de fila'] ?? ''),
                    'source_modified_at' => $this->parseDateTime($row['(No modificar) Fecha de modificación']) ?? now(),
                    'source_project_text' => (string) $sourceProjectText,
                    'source_identifier_text' => (string) $identifier,
                    'milestone_code' => $milestoneCode,
                    'milestone_name' => $milestoneName,
                    'valued_amount' => $amount ?? 0,
                    'billing_alert_status' => (string) ($row['Estado Alerta de Facturación'] ?? 'N/A'),
                    'milestone_status' => $sourceStatus,
                    'derived_status' => $resolution['status'],
                    'status_owner' => $resolution['owner'],
                    'status_mismatch' => $resolution['mismatch'],
                    ...$dates,
                    'invoice_number' => $invoiceNumber,
                    'currency_code' => $this->normalizeCurrency($row['Moneda']),
                    'cash_date' => $cashDate,
                ]);

                $seenUuids[(string) $externalUuid] = true;
                $inserted++;
                $statusCounts[$resolution['status']] = ($statusCounts[$resolution['status']] ?? 0) + 1;

                if (! $cashDate) {
                    $withoutDate++;
                }

                if ($resolution['mismatch']) {
                    $mismatchCount++;

                    if (count($mismatches) < 200) {
                        $mismatches[] = [
                            'fila' => $rowNumber,
                            'proyecto' => $projectCode,
                            'hito' => $milestoneCode,
                            'estadoExcel' => $sourceStatus,
                            'estadoCalculado' => $resolution['status'],
                        ];
                    }
                }
            }

            if ($inserted === 0) {
                throw new \InvalidArgumentException('El archivo no contiene hitos válidos; no se reemplazó la información.');
            }

            uksort(
                $statusCounts,
                fn ($a, $b) => MilestoneStatusResolver::rank($a) <=> MilestoneStatusResolver::rank($b)
            );

            $batch->update([
                'inserted_rows' => $inserted,
                'updated_rows' => 0,
                'skipped_rows' => $skipped,
                'deleted_rows' => $deleted,
                'errors' => $errors,
                'summary' => [
                    'modo' => 'reemplazo_total',
                    'columnasOpcionalesPresentes' => $payload['optional_headers_present'] ?? [],
                    'estados' => $statusCounts,
                    'hitosSinFecha' => $withoutDate,
                    'discrepancias' => $mismatchCount,
                    'detalleDiscrepancias' => $mismatches,
                ],
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

        return round((float) str_replace(',', '', (string) $value), 2);
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value))->startOfDay();
        }

        $text = trim((string) $value);

        // El export de Dataverse entrega fechas con formato m/d/Y.
        if (preg_match('#^\d{1,2}/\d{1,2}/\d{4}$#', $text) === 1) {
            return Carbon::createFromFormat('!n/j/Y', $text);
        }

        return Carbon::parse($text)->startOfDay();
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
