<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Services\Reports\IncomeCashFlowService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class DashboardController extends Controller
{
    public function __construct(
        private readonly IncomeCashFlowService $incomeCashFlowService,
    ) {
    }

    public function __invoke()
    {
        $report = $this->incomeCashFlowService->buildMonthlyReport(now()->year, now()->month);

        $upcoming = PaymentMilestone::query()
            ->with('project')
            ->get()
            ->map(function (PaymentMilestone $milestone) {
                $baseDate = $this->resolveBaseDate($milestone);

                return [
                    'id' => $milestone->id,
                    'projectCode' => $milestone->project?->project_code,
                    'projectName' => $milestone->project?->project_name,
                    'milestoneName' => $milestone->milestone_name,
                    'status' => $milestone->derived_status ?: $milestone->milestone_status,
                    'alert' => $milestone->billing_alert_status,
                    'amount' => (float) $milestone->valued_amount,
                    'currencyCode' => $milestone->currency_code,
                    'baseDate' => $baseDate?->toDateString(),
                ];
            })
            ->filter(fn (array $item) => $item['baseDate'] !== null)
            ->sortBy('baseDate')
            ->take(8)
            ->values();

        return response()->json([
            'kpis' => [
                'ingresosMesPen' => $report['totalGeneralPen'],
                'proyectosConIngreso' => count($report['filas']),
                'proyectosActivos' => Project::query()->whereIn('status_reason', ['Oferta', 'Ejecución', 'Plan'])->count(),
                'hitosUrgentes' => PaymentMilestone::query()->where('billing_alert_status', '!=', 'N/A')->count(),
                'hitosCobrados' => PaymentMilestone::query()
                    ->whereRaw('COALESCE(derived_status, milestone_status) = ?', ['Cobrado'])
                    ->count(),
            ],
            'proximosCobros' => $upcoming,
            'distribucionPorEstado' => PaymentMilestone::query()
                ->selectRaw('COALESCE(derived_status, milestone_status) as milestone_status, COUNT(*) as total')
                ->groupByRaw('COALESCE(derived_status, milestone_status)')
                ->get(),
        ]);
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
}
