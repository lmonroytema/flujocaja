<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\IncomeCashFlowExport;
use App\Exports\WeeklyCashFlowExport;
use App\Services\Reports\CashFlowSummaryService;
use App\Services\Reports\IncomeCashFlowService;
use App\Services\Reports\WeeklyCashFlowService;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

class CashFlowController extends Controller
{
    public function __construct(
        private readonly IncomeCashFlowService $incomeCashFlowService,
        private readonly WeeklyCashFlowService $weeklyCashFlowService,
        private readonly CashFlowSummaryService $cashFlowSummaryService,
    ) {
    }

    /**
     * Flujo de caja consolidado en PEN por semana: saldo en bancos, ingresos y gastos.
     */
    public function summary(Request $request)
    {
        return response()->json(
            $this->cashFlowSummaryService->build($this->extractRange($request))
        );
    }

    /**
     * Flujo semanal por proyecto (rango de meses o todo el proyecto), montos separados por moneda.
     */
    public function weekly(Request $request)
    {
        $page = max($request->integer('page', 1), 1);
        $perPage = min(max($request->integer('per_page', 25), 5), 500);

        return response()->json(
            $this->weeklyCashFlowService->build(
                $this->extractRange($request),
                $this->extractWeeklyFilters($request),
                $page,
                $perPage,
            )
        );
    }

    public function weeklyExport(Request $request)
    {
        $report = $this->weeklyCashFlowService->build(
            $this->extractRange($request),
            $this->extractWeeklyFilters($request),
        );

        return Excel::download(
            new WeeklyCashFlowExport($report),
            sprintf('flujo-caja-semanal-%s-a-%s.xlsx', $report['desde'], $report['hasta'])
        );
    }

    private function extractRange(Request $request): array
    {
        return [
            'from' => $this->normalizeFilterValue($request->query('from')),
            'to' => $this->normalizeFilterValue($request->query('to')),
            'scope' => $this->normalizeFilterValue($request->query('scope')),
        ];
    }

    private function extractWeeklyFilters(Request $request): array
    {
        return [
            ...$this->extractFilters($request),
            'coordinator' => $this->normalizeFilterValue($request->query('coordinator')),
            'project_id' => $request->filled('project_id') ? $request->integer('project_id') : null,
            'mismatch' => $request->boolean('mismatch'),
            'include_undated' => $request->has('include_undated') ? $request->boolean('include_undated') : true,
        ];
    }

    public function income(Request $request)
    {
        $year = (int) $request->integer('year', now()->year);
        $month = (int) $request->integer('month', now()->month);
        $page = max($request->integer('page', 1), 1);
        $perPage = min(max($request->integer('per_page', 12), 5), 100);
        $filters = $this->extractFilters($request);

        return response()->json(
            $this->incomeCashFlowService->buildPaginatedMonthlyReport($year, $month, $filters, $page, $perPage)
        );
    }

    public function export(Request $request)
    {
        $year = (int) $request->integer('year', now()->year);
        $month = (int) $request->integer('month', now()->month);
        $filters = $this->extractFilters($request);
        $report = $this->incomeCashFlowService->buildFilteredMonthlyReport($year, $month, $filters);

        return Excel::download(
            new IncomeCashFlowExport($report),
            sprintf('flujo-caja-ingresos-%d-%02d.xlsx', $year, $month)
        );
    }

    private function extractFilters(Request $request): array
    {
        return [
            'code' => $this->normalizeFilterValue($request->query('code')),
            'project' => $this->normalizeFilterValue($request->query('project')),
            'client' => $this->normalizeFilterValue($request->query('client')),
            'business_unit' => $this->normalizeFilterValue($request->query('business_unit')),
            'status' => $this->normalizeFilterValue($request->query('status')),
            'concept' => $this->normalizeFilterValue($request->query('concept')),
        ];
    }

    private function normalizeFilterValue(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return $normalized !== '' ? $normalized : null;
    }
}
