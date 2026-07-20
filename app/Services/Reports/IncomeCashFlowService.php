<?php

namespace App\Services\Reports;

use App\Models\CashFlowPeriod;
use App\Models\PaymentMilestone;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class IncomeCashFlowService
{
    public function __construct(
        private readonly CashFlowPeriodService $periodService,
    ) {
    }

    public function buildMonthlyReport(int $year, int $month): array
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
}
