<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\IncomeCashFlowExport;
use App\Services\Reports\IncomeCashFlowService;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

class CashFlowController extends Controller
{
    public function __construct(
        private readonly IncomeCashFlowService $incomeCashFlowService,
    ) {
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
