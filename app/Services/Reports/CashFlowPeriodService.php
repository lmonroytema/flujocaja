<?php

namespace App\Services\Reports;

use App\Models\CashFlowPeriod;
use App\Models\ExchangeRate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CashFlowPeriodService
{
    /**
     * @return Collection<int, CashFlowPeriod>
     */
    public function ensurePeriods(int $year, int $month, float $defaultUsdRate = 3.75): Collection
    {
        return DB::transaction(function () use ($year, $month, $defaultUsdRate) {
            $firstDay = CarbonImmutable::create($year, $month, 1)->startOfDay();
            $lastDay = $firstDay->endOfMonth();
            $cursor = $firstDay->startOfWeek(CarbonImmutable::MONDAY);
            $validIds = [];
            $sequence = 1;

            while ($cursor->lte($lastDay->endOfWeek(CarbonImmutable::FRIDAY))) {
                $start = $cursor;
                $end = $cursor->addDays(4);

                if ($end->lt($firstDay) || $start->gt($lastDay)) {
                    $cursor = $cursor->addWeek();
                    continue;
                }

                $period = CashFlowPeriod::query()->updateOrCreate(
                    [
                        'report_year' => $year,
                        'report_month' => $month,
                        'sequence' => $sequence,
                    ],
                    [
                        'start_date' => $start->toDateString(),
                        'end_date' => $end->toDateString(),
                        'label' => sprintf('%d AL %d', $start->day, $end->day),
                    ]
                );

                $validIds[] = $period->id;
                $sequence++;
                $cursor = $cursor->addWeek();
            }

            CashFlowPeriod::query()
                ->where('report_year', $year)
                ->where('report_month', $month)
                ->whereNotIn('id', $validIds)
                ->delete();

            $periods = CashFlowPeriod::query()
                ->with('exchangeRates')
                ->where('report_year', $year)
                ->where('report_month', $month)
                ->orderBy('sequence')
                ->get();

            foreach ($periods as $period) {
                ExchangeRate::query()->firstOrCreate(
                    [
                        'cash_flow_period_id' => $period->id,
                        'currency_code' => 'PEN',
                    ],
                    [
                        'rate_to_pen' => 1,
                    ]
                );

                ExchangeRate::query()->firstOrCreate(
                    [
                        'cash_flow_period_id' => $period->id,
                        'currency_code' => 'USD',
                    ],
                    [
                        'rate_to_pen' => $defaultUsdRate,
                    ]
                );
            }

            return CashFlowPeriod::query()
                ->with('exchangeRates')
                ->where('report_year', $year)
                ->where('report_month', $month)
                ->orderBy('sequence')
                ->get();
        });
    }
}
