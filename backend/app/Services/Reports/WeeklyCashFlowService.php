<?php

namespace App\Services\Reports;

use App\Models\PaymentMilestone;
use App\Services\Milestones\MilestoneStatusResolver;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Flujo de caja de ingresos por proyecto con columnas semanales (lunes a viernes) agrupadas por mes.
 * - Una fila por proyecto.
 * - Cada semana pertenece al mes de su lunes (aparece una sola vez).
 * - Montos separados por moneda (USD / PEN), sin conversión.
 * - El monto del hito se ubica en su fecha de caja: FRC, si no FEP, si no FEF.
 * - Las demás fechas del hito se muestran como marcadores en su semana.
 * - Los hitos sin fecha de caja (sin FRC, FEP ni FEF) se agrupan en la columna "Sin fecha".
 */
class WeeklyCashFlowService
{
    public const CURRENCIES = ['USD', 'PEN'];

    public const MIN_MONTH = '2019-01';

    /** Marcadores de fecha: código => [columna, etiqueta]. */
    public const MARKERS = [
        'FEV' => ['estimated_valuation_date', 'Fecha Estimada de Valorización'],
        'FEF' => ['estimated_billing_date', 'Fecha Estimada de Facturación'],
        'FRV' => ['actual_valuation_date', 'Fecha Real de Valorización'],
        'FAV' => ['valuation_approval_date', 'Fecha de Aprobación de la Valorización'],
        'FRF' => ['actual_billing_date', 'Fecha Real de Facturación'],
        'FRecF' => ['invoice_received_date', 'Fecha de recepción de factura'],
        'FEP' => ['estimated_payment_date', 'Fecha Estimada de Pago'],
        'FRC' => ['actual_collection_date', 'Fecha Real de Cobro'],
    ];

    private const MONTH_NAMES = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril', 5 => 'Mayo', 6 => 'Junio',
        7 => 'Julio', 8 => 'Agosto', 9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];

    /**
     * @param array{from?: ?string, to?: ?string, scope?: ?string} $range
     */
    public function build(array $range, array $filters = [], int $page = 1, int $perPage = 0): array
    {
        $projects = $this->loadProjects();
        $projects = $this->applyFilters($projects, $filters);

        [$fromMonth, $toMonth, $scope] = $this->resolveRange($range, $projects);
        $months = $this->buildMonths($fromMonth, $toMonth);
        $weekKeys = collect($months)->flatMap(fn (array $month) => array_column($month['semanas'], 'clave'))->flip();

        $includeUndated = ! array_key_exists('include_undated', $filters) || $filters['include_undated'] !== false;

        $rows = $projects
            ->map(fn (array $project) => $this->buildRow($project, $weekKeys))
            ->filter(fn (array $row) => $row['tieneMovimiento'] || ($includeUndated && $row['sinFecha']['hitos'] !== []))
            ->sortBy('codigoProyecto', SORT_NATURAL)
            ->values();

        $totals = $this->buildTotals($rows);
        $total = $rows->count();
        $perPage = $perPage > 0 ? $perPage : max($total, 1);
        $lastPage = max((int) ceil($total / $perPage), 1);
        $currentPage = min(max($page, 1), $lastPage);
        $pageRows = $rows->forPage($currentPage, $perPage)->values();
        $from = $total === 0 ? null : ($currentPage - 1) * $perPage + 1;

        return [
            'desde' => $fromMonth->format('Y-m'),
            'hasta' => $toMonth->format('Y-m'),
            'alcance' => $scope,
            'monedas' => self::CURRENCIES,
            'meses' => $months,
            'totalSemanas' => $weekKeys->count(),
            'filas' => $pageRows->map(function (array $row) {
                unset($row['tieneMovimiento']);

                return $row;
            })->all(),
            'meta' => [
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $from,
                'to' => $from === null ? null : $from + $pageRows->count() - 1,
            ],
            'totales' => $totals,
            'totalFilas' => $total,
            'discrepancias' => $rows->sum('discrepancias'),
            'estados' => collect(MilestoneStatusResolver::ORDER)
                ->map(fn (int $order, string $status) => [
                    'estado' => $status,
                    'orden' => $order,
                    'responsable' => MilestoneStatusResolver::OWNERS[$status],
                ])
                ->values()
                ->all(),
            'marcadores' => collect(self::MARKERS)
                ->map(fn (array $marker, string $code) => ['codigo' => $code, 'etiqueta' => $marker[1]])
                ->values()
                ->all(),
            'filterOptions' => $this->buildFilterOptions($this->loadProjects()),
        ];
    }

    /** @var Collection<int, array>|null */
    private ?Collection $projectsCache = null;

    /**
     * Agrupa los hitos por proyecto (excluye códigos que empiezan con "10").
     *
     * @return Collection<int, array>
     */
    private function loadProjects(): Collection
    {
        if ($this->projectsCache !== null) {
            return $this->projectsCache;
        }

        $milestones = PaymentMilestone::query()
            ->with('project')
            ->whereHas('project', fn ($query) => $query->where('project_code', 'not like', '10%'))
            ->orderBy('milestone_code')
            ->get();

        return $this->projectsCache = $milestones
            ->groupBy('project_id')
            ->map(function (Collection $items) {
                $project = $items->first()->project;

                return [
                    'project' => $project,
                    'milestones' => $items->values(),
                    'statuses' => $items
                        ->map(fn (PaymentMilestone $item) => $this->statusOf($item))
                        ->unique()
                        ->values()
                        ->all(),
                    'mismatches' => $items->filter(fn (PaymentMilestone $item) => (bool) $item->status_mismatch)->count(),
                ];
            })
            ->values();
    }

    private function applyFilters(Collection $projects, array $filters): Collection
    {
        $text = fn (string $key) => $this->normalize($filters[$key] ?? null);
        $code = $text('code');
        $name = $text('project');
        $client = $text('client');
        $unit = $text('business_unit');
        $coordinator = $text('coordinator');
        $status = $text('status');
        $projectId = isset($filters['project_id']) ? (int) $filters['project_id'] : null;
        $mismatchOnly = (bool) ($filters['mismatch'] ?? false);

        return $projects->filter(function (array $item) use ($code, $name, $client, $unit, $coordinator, $status, $projectId, $mismatchOnly) {
            $project = $item['project'];

            return (! $projectId || $project->id === $projectId)
                && $this->contains($project->project_code, $code)
                && $this->contains($project->project_name, $name)
                && $this->contains($project->client_name, $client)
                && $this->contains($project->business_unit, $unit)
                && $this->contains($project->project_coordinator, $coordinator)
                && (! $status || collect($item['statuses'])->contains(fn ($value) => mb_strtolower($value) === mb_strtolower($status)))
                && (! $mismatchOnly || $item['mismatches'] > 0);
        })->values();
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: string}
     */
    private function resolveRange(array $range, Collection $projects): array
    {
        $minMonth = CarbonImmutable::createFromFormat('!Y-m', self::MIN_MONTH);
        $maxMonth = CarbonImmutable::now()->startOfMonth()->addYears(5);
        $current = CarbonImmutable::now()->startOfMonth();
        $scope = ($range['scope'] ?? null) === 'all' ? 'todo' : 'rango';

        if ($scope === 'todo') {
            $dates = $projects->flatMap(fn (array $item) => $item['milestones']->flatMap(
                fn (PaymentMilestone $milestone) => array_values(array_filter($this->allDates($milestone)))
            ));

            if ($dates->isEmpty()) {
                return [$current, $current, $scope];
            }

            $from = $this->weekStart(CarbonImmutable::parse($dates->min()))->startOfMonth();
            $to = $this->weekStart(CarbonImmutable::parse($dates->max()))->startOfMonth();
        } else {
            $from = $this->parseMonth($range['from'] ?? null) ?? $current;
            $to = $this->parseMonth($range['to'] ?? null) ?? $from;
        }

        if ($to->lt($from)) {
            [$from, $to] = [$to, $from];
        }

        $from = $from->lt($minMonth) ? $minMonth : ($from->gt($maxMonth) ? $maxMonth : $from);
        $to = $to->gt($maxMonth) ? $maxMonth : ($to->lt($minMonth) ? $minMonth : $to);

        return [$from, $to, $scope];
    }

    private function buildMonths(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $months = [];
        $cursor = $from->startOfMonth();

        while ($cursor->lte($to)) {
            $monday = $cursor->dayOfWeekIso === 1 ? $cursor : $cursor->next(CarbonImmutable::MONDAY);
            $weeks = [];
            $sequence = 1;

            while ($monday->month === $cursor->month) {
                $friday = $monday->addDays(4);
                $weeks[] = [
                    'clave' => $monday->toDateString(),
                    'indice' => $sequence++,
                    'fechaInicio' => $monday->toDateString(),
                    'fechaFin' => $friday->toDateString(),
                    'etiqueta' => $monday->month === $friday->month
                        ? sprintf('%d AL %d', $monday->day, $friday->day)
                        : sprintf('%d/%d AL %d/%d', $monday->day, $monday->month, $friday->day, $friday->month),
                ];
                $monday = $monday->addWeek();
            }

            $months[] = [
                'clave' => $cursor->format('Y-m'),
                'anio' => $cursor->year,
                'mes' => $cursor->month,
                'etiqueta' => self::MONTH_NAMES[$cursor->month].' '.$cursor->year,
                'semanas' => $weeks,
            ];
            $cursor = $cursor->addMonth();
        }

        return $months;
    }

    private function buildRow(array $item, Collection $weekKeys): array
    {
        $project = $item['project'];
        $cells = [];
        $undated = ['montos' => $this->emptyAmounts(), 'hitos' => []];
        $totals = $this->emptyAmounts();
        $hasMovement = false;
        $statusCounts = [];

        /** @var PaymentMilestone $milestone */
        foreach ($item['milestones'] as $milestone) {
            $status = $this->statusOf($milestone);
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
            $currency = in_array($milestone->currency_code, self::CURRENCIES, true) ? $milestone->currency_code : 'USD';
            $amount = (float) $milestone->valued_amount;
            $detail = $this->milestoneDetail($milestone, $status, $currency, $amount);
            $cashDate = $milestone->cash_date
                ?? $milestone->actual_collection_date
                ?? $milestone->estimated_payment_date
                ?? $milestone->estimated_billing_date;

            if ($cashDate) {
                $key = $this->weekStart(CarbonImmutable::parse($cashDate))->toDateString();

                if (isset($weekKeys[$key])) {
                    $cells[$key] ??= $this->emptyCell();
                    $cells[$key]['montos'][$currency] = round($cells[$key]['montos'][$currency] + $amount, 2);
                    $cells[$key]['hitos'][] = $detail;
                    $cells[$key]['estados'][$status] = true;
                    $totals[$currency] = round($totals[$currency] + $amount, 2);
                    $hasMovement = true;
                }
            }

            foreach (self::MARKERS as $code => [$column, $label]) {
                $date = $milestone->{$column};

                if (! $date) {
                    continue;
                }

                $key = $this->weekStart(CarbonImmutable::parse($date))->toDateString();

                if (! isset($weekKeys[$key])) {
                    continue;
                }

                $cells[$key] ??= $this->emptyCell();
                $cells[$key]['marcadores'][] = [
                    'tipo' => $code,
                    'etiqueta' => $label,
                    'fecha' => CarbonImmutable::parse($date)->toDateString(),
                    'hito' => $milestone->milestone_code,
                ];
                $hasMovement = true;
            }

            // Sin fecha de caja (sin FRC, FEP ni FEF): el monto no se puede ubicar en una semana.
            if (! $cashDate) {
                $undated['montos'][$currency] = round($undated['montos'][$currency] + $amount, 2);
                $undated['hitos'][] = $detail;
            }
        }

        foreach ($cells as $key => $cell) {
            $cells[$key]['estados'] = collect(array_keys($cell['estados']))
                ->sortBy(fn ($status) => MilestoneStatusResolver::rank($status))
                ->values()
                ->all();
        }

        uksort($statusCounts, fn ($a, $b) => MilestoneStatusResolver::rank($a) <=> MilestoneStatusResolver::rank($b));

        return [
            'projectId' => $project->id,
            'codigoProyecto' => $project->project_code,
            'proyecto' => $project->project_name,
            'unidadNegocio' => $project->business_unit,
            'cliente' => $project->client_name,
            'coordinador' => $project->project_coordinator,
            'estado' => $this->mainStatus(array_keys($statusCounts)),
            'estados' => $statusCounts,
            'discrepancias' => $item['mismatches'],
            'totalHitos' => $item['milestones']->count(),
            'celdas' => (object) $cells,
            'sinFecha' => $undated,
            'totales' => $totals,
            'tieneMovimiento' => $hasMovement,
        ];
    }

    private function buildTotals(Collection $rows): array
    {
        $general = $this->emptyAmounts();
        $undated = $this->emptyAmounts();
        $byWeek = [];

        foreach ($rows as $row) {
            foreach (self::CURRENCIES as $currency) {
                $general[$currency] = round($general[$currency] + $row['totales'][$currency], 2);
                $undated[$currency] = round($undated[$currency] + $row['sinFecha']['montos'][$currency], 2);
            }

            foreach ((array) $row['celdas'] as $key => $cell) {
                $byWeek[$key] ??= $this->emptyAmounts();

                foreach (self::CURRENCIES as $currency) {
                    $byWeek[$key][$currency] = round($byWeek[$key][$currency] + $cell['montos'][$currency], 2);
                }
            }
        }

        return [
            'general' => $general,
            'sinFecha' => $undated,
            'porSemana' => (object) $byWeek,
        ];
    }

    private function buildFilterOptions(Collection $projects): array
    {
        $values = fn (string $attribute) => $projects
            ->map(fn (array $item) => trim((string) $item['project']->{$attribute}))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();

        return [
            'businessUnits' => $values('business_unit'),
            'clients' => $values('client_name'),
            'coordinators' => $values('project_coordinator'),
            'statuses' => array_keys(MilestoneStatusResolver::ORDER),
        ];
    }

    private function milestoneDetail(PaymentMilestone $milestone, string $status, string $currency, float $amount): array
    {
        $dates = [];

        foreach (self::MARKERS as $code => [$column]) {
            $dates[$code] = $milestone->{$column} ? CarbonImmutable::parse($milestone->{$column})->toDateString() : null;
        }

        return [
            'id' => $milestone->id,
            'codigo' => $milestone->milestone_code,
            'nombre' => $milestone->milestone_name,
            'monto' => $amount,
            'moneda' => $currency,
            'estado' => $status,
            'estadoExcel' => $milestone->milestone_status,
            'responsable' => $milestone->status_owner ?? (MilestoneStatusResolver::OWNERS[$status] ?? null),
            'discrepancia' => (bool) $milestone->status_mismatch,
            'factura' => $milestone->invoice_number,
            'alerta' => $milestone->billing_alert_status,
            'fechaCaja' => $milestone->cash_date ? CarbonImmutable::parse($milestone->cash_date)->toDateString() : null,
            'fechas' => $dates,
        ];
    }

    /**
     * Estado principal del proyecto: el más avanzado entre los hitos pendientes de cobro;
     * si todos están cobrados, "Cobrado".
     */
    private function mainStatus(array $statuses): ?string
    {
        $pending = array_values(array_filter($statuses, fn ($status) => $status !== MilestoneStatusResolver::COBRADO));

        if ($pending === []) {
            return $statuses === [] ? null : MilestoneStatusResolver::COBRADO;
        }

        usort($pending, fn ($a, $b) => MilestoneStatusResolver::rank($b) <=> MilestoneStatusResolver::rank($a));

        return $pending[0];
    }

    private function statusOf(PaymentMilestone $milestone): string
    {
        return $milestone->derived_status ?: (string) $milestone->milestone_status;
    }

    private function allDates(PaymentMilestone $milestone): array
    {
        return array_map(
            fn (array $marker) => $milestone->{$marker[0]}?->toDateString(),
            self::MARKERS,
        );
    }

    private function weekStart(CarbonImmutable $date): CarbonImmutable
    {
        return $date->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();
    }

    private function parseMonth(?string $value): ?CarbonImmutable
    {
        if (! $value || preg_match('/^\d{4}-\d{2}$/', $value) !== 1) {
            return null;
        }

        $month = (int) substr($value, 5, 2);

        return $month >= 1 && $month <= 12 ? CarbonImmutable::createFromFormat('!Y-m', $value) : null;
    }

    private function emptyAmounts(): array
    {
        return array_fill_keys(self::CURRENCIES, 0.0);
    }

    private function emptyCell(): array
    {
        return ['montos' => $this->emptyAmounts(), 'hitos' => [], 'marcadores' => [], 'estados' => []];
    }

    private function contains(?string $value, ?string $filter): bool
    {
        return ! $filter || str_contains(mb_strtolower(trim((string) $value)), mb_strtolower($filter));
    }

    private function normalize(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
