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

        return response()->json(
            $this->incomeCashFlowService->buildMonthlyReport($year, $month)
        );
    }

    public function export(Request $request)
    {
        $year = (int) $request->integer('year', now()->year);
        $month = (int) $request->integer('month', now()->month);
        $report = $this->incomeCashFlowService->buildMonthlyReport($year, $month);

        return Excel::download(
            new IncomeCashFlowExport($report),
            sprintf('flujo-caja-ingresos-%d-%02d.xlsx', $year, $month)
        );
    }
}
