<?php

namespace App\Services\Reports;

use App\Models\CashFlowPeriod;
use App\Models\PaymentMilestone;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class IncomeCashFlowService
{
    public function __construct(
        private readonly CashFlowPeriodService $periodService,
    ) {
    }

    public function buildMonthlyReport(int $year, int $month): array
    {
        return $this->buildBaseMonthlyReport($year, $month);
    }

    public function buildFilteredMonthlyReport(int $year, int $month, array $filters = []): array
    {
        $report = $this->buildBaseMonthlyReport($year, $month);
        $filteredRows = $this->applyRowFilters(collect($report['filas']), $filters)->values();
        $filteredTotal = $this->sumRows($filteredRows);

        return [
            ...$report,
            'filas' => $filteredRows->all(),
            'totalGeneralPen' => $filteredTotal,
            'totalGeneralPenOriginal' => $report['totalGeneralPen'],
            'totalFiltradoPen' => $filteredTotal,
            'totalFilas' => $filteredRows->count(),
            'filterOptions' => $this->buildFilterOptions(collect($report['filas'])),
        ];
    }

    public function buildPaginatedMonthlyReport(
        int $year,
        int $month,
        array $filters = [],
        int $page = 1,
        int $perPage = 15,
    ): array {
        $report = $this->buildBaseMonthlyReport($year, $month);
        $allRows = collect($report['filas']);
        $filteredRows = $this->applyRowFilters($allRows, $filters)->values();
        $filteredTotal = $this->sumRows($filteredRows);
        $currentPage = max($page, 1);
        $perPage = max($perPage, 1);
        $paginator = new LengthAwarePaginator(
            $filteredRows->forPage($currentPage, $perPage)->values()->all(),
            $filteredRows->count(),
            $perPage,
            $currentPage,
            [
                'path' => LengthAwarePaginator::resolveCurrentPath(),
                'pageName' => 'page',
            ],
        );

        return [
            ...$report,
            'filas' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'filterOptions' => $this->buildFilterOptions($allRows),
            'totalGeneralPen' => $filteredTotal,
            'totalGeneralPenOriginal' => $report['totalGeneralPen'],
            'totalFiltradoPen' => $filteredTotal,
            'totalFilas' => $filteredRows->count(),
        ];
    }

    private function buildBaseMonthlyReport(int $year, int $month): array
    {
        $periods = $this->periodService->ensurePeriods($year, $month);
        $periodIds = $periods->pluck('id')->all();
        $start = $periods->min('start_date');
        $end = $periods->max('end_date');

        $rows = [];
        $totalGeneralPen = 0.0;

        $milestones = PaymentMilestone::query()
            ->with('project')
            ->where(function ($query) use ($start, $end) {
                $query
                    ->whereBetween('actual_collection_date', [$start, $end])
                    ->orWhereBetween('estimated_payment_date', [$start, $end])
                    ->orWhereBetween('actual_billing_date', [$start, $end])
                    ->orWhereBetween('estimated_billing_date', [$start, $end]);
            })
            ->get();

        foreach ($milestones as $milestone) {
            $baseDate = $this->resolveBaseDate($milestone);

            if (! $baseDate) {
                continue;
            }

            /** @var CashFlowPeriod|null $period */
            $period = $periods->first(
                fn (CashFlowPeriod $item) => $baseDate->betweenIncluded(
                    CarbonImmutable::parse($item->start_date),
                    CarbonImmutable::parse($item->end_date),
                )
            );

            if (! $period || ! $milestone->project) {
                continue;
            }

            if (str_starts_with((string) $milestone->project->project_code, '10')) {
                continue;
            }

            $rate = $this->resolveRate($period, $milestone->currency_code);
            $amountOrigin = (float) $milestone->valued_amount;
            $amountPen = round($amountOrigin * $rate, 2);

            $projectKey = (string) $milestone->project_id;

            if (! isset($rows[$projectKey])) {
                $rows[$projectKey] = [
                    'projectId' => $milestone->project_id,
                    'codigoProyecto' => $milestone->project->project_code,
                    'proyecto' => $milestone->project->project_name,
                    'unidadNegocio' => $milestone->project->business_unit,
                    'cliente' => $milestone->project->client_name,
                    'estado' => null,
                    'concepto' => $milestone->project->project_name,
                    'hitos' => collect($periodIds)->mapWithKeys(fn ($periodId) => [$periodId => [
                        'periodoId' => $periodId,
                        'etiqueta' => $periods->firstWhere('id', $periodId)?->label,
                        'monedaOrigen' => 'PEN',
                        'montoOrigen' => 0,
                        'tipoCambioAplicado' => 1,
                        'montoPen' => 0,
                        'fechaBase' => null,
                        'estadoHito' => null,
                        'detalleHitos' => [],
                    ]])->all(),
                    'totalPen' => 0,
                ];
            }

            $cell = &$rows[$projectKey]['hitos'][$period->id];
            $cell['monedaOrigen'] = $milestone->currency_code;
            $cell['montoOrigen'] = round($cell['montoOrigen'] + $amountOrigin, 2);
            $cell['tipoCambioAplicado'] = $rate;
            $cell['montoPen'] = round($cell['montoPen'] + $amountPen, 2);
            $cell['fechaBase'] = $baseDate->toDateString();
            $cell['estadoHito'] = $milestone->milestone_status;
            $rows[$projectKey]['estado'] = $this->mergeStatuses(
                $rows[$projectKey]['estado'],
                $milestone->milestone_status,
            );
            $cell['detalleHitos'][] = [
                'codigo' => $milestone->milestone_code,
                'nombre' => $milestone->milestone_name,
                'montoOrigen' => $amountOrigin,
                'montoPen' => $amountPen,
                'monedaOrigen' => $milestone->currency_code,
                'fechaBase' => $baseDate->toDateString(),
                'estadoHito' => $milestone->milestone_status,
            ];
            $rows[$projectKey]['totalPen'] = round($rows[$projectKey]['totalPen'] + $amountPen, 2);
            $totalGeneralPen = round($totalGeneralPen + $amountPen, 2);
        }

        usort($rows, fn (array $left, array $right) => strcmp($left['codigoProyecto'], $right['codigoProyecto']));

        return [
            'anio' => $year,
            'mes' => $month,
            'monedaReporte' => 'PEN',
            'periodos' => $periods->map(fn (CashFlowPeriod $period) => [
                'id' => $period->id,
                'anio' => $period->report_year,
                'mes' => $period->report_month,
                'indice' => $period->sequence,
                'etiqueta' => $period->label,
                'fechaInicio' => CarbonImmutable::parse($period->start_date)->toDateString(),
                'fechaFin' => CarbonImmutable::parse($period->end_date)->toDateString(),
                'tipoCambioUsd' => $this->resolveRate($period, 'USD'),
            ])->values(),
            'filas' => array_values($rows),
            'totalGeneralPen' => $totalGeneralPen,
        ];
    }

    private function resolveBaseDate(PaymentMilestone $milestone): ?CarbonImmutable
    {
        foreach ([
            $milestone->actual_collection_date,
            $milestone->estimated_payment_date,
            $milestone->actual_billing_date,
            $milestone->estimated_billing_date,
        ] as $candidate) {
            if ($candidate) {
                return CarbonImmutable::parse($candidate);
            }
        }

        return null;
    }

    private function resolveRate(CashFlowPeriod $period, string $currencyCode): float
    {
        if ($currencyCode === 'PEN') {
            return 1.0;
        }

        $rate = $period->exchangeRates->firstWhere('currency_code', $currencyCode);

        return $rate ? (float) $rate->rate_to_pen : 1.0;
    }

    private function applyRowFilters(Collection $rows, array $filters): Collection
    {
        $normalizedFilters = [
            'code' => $this->normalizeFilterValue($filters['code'] ?? null),
            'project' => $this->normalizeFilterValue($filters['project'] ?? null),
            'client' => $this->normalizeFilterValue($filters['client'] ?? null),
            'business_unit' => $this->normalizeFilterValue($filters['business_unit'] ?? null),
            'status' => $this->normalizeFilterValue($filters['status'] ?? null),
            'concept' => $this->normalizeFilterValue($filters['concept'] ?? null),
        ];

        return $rows->filter(function (array $row) use ($normalizedFilters): bool {
            return $this->matchesFilter($row['codigoProyecto'] ?? null, $normalizedFilters['code'])
                && $this->matchesFilter($row['proyecto'] ?? null, $normalizedFilters['project'])
                && $this->matchesFilter($row['cliente'] ?? null, $normalizedFilters['client'])
                && $this->matchesFilter($row['unidadNegocio'] ?? null, $normalizedFilters['business_unit'])
                && $this->matchesFilter($row['estado'] ?? null, $normalizedFilters['status'])
                && $this->matchesFilter($row['concepto'] ?? null, $normalizedFilters['concept']);
        });
    }

    private function buildFilterOptions(Collection $rows): array
    {
        return [
            'businessUnits' => $this->collectUniqueValues($rows, 'unidadNegocio'),
            'clients' => $this->collectUniqueValues($rows, 'cliente'),
            'statuses' => $this->collectUniqueValues($rows, 'estado'),
            'concepts' => $this->collectUniqueValues($rows, 'concepto'),
        ];
    }

    private function collectUniqueValues(Collection $rows, string $key): array
    {
        return $rows
            ->map(fn (array $row) => $row[$key] ?? null)
            ->filter(fn ($value) => filled($value))
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function matchesFilter(?string $value, ?string $filter): bool
    {
        if (! $filter) {
            return true;
        }

        return str_contains(
            mb_strtolower(trim((string) $value)),
            mb_strtolower($filter),
        );
    }

    private function normalizeFilterValue(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return $normalized !== '' ? $normalized : null;
    }

    private function sumRows(Collection $rows): float
    {
        return round(
            $rows->sum(fn (array $row) => (float) ($row['totalPen'] ?? 0)),
            2,
        );
    }

    private function mergeStatuses(?string $current, ?string $incoming): ?string
    {
        $normalizedIncoming = $this->normalizeFilterValue($incoming);

        if (! $normalizedIncoming) {
            return $current;
        }

        $statuses = collect(explode(' | ', (string) $current))
            ->map(fn (string $status) => trim($status))
            ->filter()
            ->push($normalizedIncoming)
            ->unique()
            ->values();

        return $statuses->isNotEmpty() ? $statuses->implode(' | ') : null;
    }
}
