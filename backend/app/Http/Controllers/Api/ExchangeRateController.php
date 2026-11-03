<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRate;
use App\Services\Reports\CashFlowPeriodService;
use Illuminate\Http\Request;

class ExchangeRateController extends Controller
{
    public function __construct(
        private readonly CashFlowPeriodService $periodService,
    ) {
    }

    public function index(Request $request)
    {
        $year = (int) $request->integer('year', now()->year);
        $month = (int) $request->integer('month', now()->month);

        return response()->json(
            $this->periodService->ensurePeriods($year, $month)
                ->map(fn ($period) => [
                    'id' => $period->id,
                    'reportYear' => $period->report_year,
                    'reportMonth' => $period->report_month,
                    'sequence' => $period->sequence,
                    'label' => $period->label,
                    'startDate' => $period->start_date,
                    'endDate' => $period->end_date,
                    'rates' => $period->exchangeRates->map(fn ($rate) => [
                        'id' => $rate->id,
                        'currencyCode' => $rate->currency_code,
                        'rateToPen' => (float) $rate->rate_to_pen,
                    ])->values(),
                ])->values()
        );
    }

    public function update(Request $request, ExchangeRate $exchangeRate)
    {
        $data = $request->validate([
            'rate_to_pen' => ['required', 'numeric', 'min:0.0001'],
        ]);

        $exchangeRate->update($data);

        return response()->json($exchangeRate->fresh());
    }
}
