<?php

namespace App\Services\Reports;

use App\Models\BankAccount;
use App\Models\BankBalance;
use App\Models\ExchangeRate;
use App\Services\Integrations\GestionComprasApiService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Flujo de caja consolidado en PEN, por semana (lunes a viernes; cada semana pertenece al mes de su lunes):
 * - Saldo en bancos: saldo inicial a partir de los saldos registrados por cuenta.
 * - Ingresos: hitos de pago ubicados en su fecha de caja (mismo criterio que WeeklyCashFlowService).
 * - Gastos: Gestión de Compras, lo PAGADO (fecha de pago) y los COMPROMISOS (fecha programada).
 * Los montos en USD se convierten con el tipo de cambio de la semana (pantalla Tipos de cambio).
 * La agrupación por mes, trimestre o año se hace en el frontend sumando semanas.
 */
class CashFlowSummaryService
{
    public const DEFAULT_USD_RATE = 3.75;

    /** Etapas de Gestión de Compras que cuentan como salida de caja. */
    public const EXPENSE_STAGES = ['PAGADO', 'COMPROMISO'];

    public function __construct(
        private readonly WeeklyCashFlowService $weeklyCashFlowService,
        private readonly GestionComprasApiService $gestionComprasApiService,
    ) {
    }

    /**
     * @param array{from?: ?string, to?: ?string, scope?: ?string} $range
     */
    public function build(array $range): array
    {
        $income = $this->weeklyCashFlowService->build($range, ['include_undated' => false]);
        $weeks = collect($income['meses'])->flatMap(fn (array $month) => $month['semanas'])->values();
        $weekKeys = $weeks->pluck('clave')->all();
        $rates = $this->resolveUsdRates($weekKeys);

        $incomeByWeek = [];
        foreach ($weekKeys as $key) {
            $amounts = ((array) $income['totales']['porSemana'])[$key] ?? null;
            $incomeByWeek[$key] = $amounts
                ? round(($amounts['PEN'] ?? 0) + ($amounts['USD'] ?? 0) * $rates[$key], 2)
                : 0.0;
        }

        $firstWeek = $weeks->first();
        $lastWeek = $weeks->last();
        $expenses = $firstWeek
            ? $this->buildExpenses(
                $firstWeek['fechaInicio'],
                CarbonImmutable::parse($lastWeek['fechaFin'])->addDays(2)->toDateString(),
                array_flip($weekKeys),
            )
            : $this->emptyExpenses();

        $openingRate = $firstWeek ? $rates[$firstWeek['clave']] : self::DEFAULT_USD_RATE;
        $opening = $this->buildOpeningBalance($firstWeek['fechaInicio'] ?? CarbonImmutable::now()->toDateString(), $openingRate);

        return [
            'desde' => $income['desde'],
            'hasta' => $income['hasta'],
            'alcance' => $income['alcance'],
            'monedaReporte' => 'PEN',
            'meses' => $income['meses'],
            'tiposCambio' => (object) $rates,
            'saldoInicial' => $opening,
            'ingresos' => [
                'porSemana' => (object) $incomeByWeek,
                'total' => round(array_sum($incomeByWeek), 2),
                'sinFecha' => $income['totales']['sinFecha'],
            ],
            'gastos' => $expenses,
        ];
    }

    /**
     * Tipo de cambio USD por semana: el del período de esa semana; si no existe, el último
     * registrado antes; si no hay ninguno anterior, el primero posterior o el valor por defecto.
     *
     * @param list<string> $weekKeys
     * @return array<string, float>
     */
    private function resolveUsdRates(array $weekKeys): array
    {
        if ($weekKeys === []) {
            return [];
        }

        $known = ExchangeRate::query()
            ->join('cash_flow_periods', 'cash_flow_periods.id', '=', 'exchange_rates.cash_flow_period_id')
            ->where('exchange_rates.currency_code', 'USD')
            ->orderBy('cash_flow_periods.start_date')
            ->get(['cash_flow_periods.start_date', 'cash_flow_periods.report_month', 'exchange_rates.rate_to_pen'])
            ->reduce(function (array $carry, $row) {
                $date = CarbonImmutable::parse($row->start_date);
                $key = $date->toDateString();

                // Una semana partida entre dos meses existe en ambos: manda la del mes de su lunes.
                if (! isset($carry[$key]) || (int) $row->report_month === $date->month) {
                    $carry[$key] = (float) $row->rate_to_pen;
                }

                return $carry;
            }, []);

        ksort($known);
        $fallback = $known === [] ? self::DEFAULT_USD_RATE : reset($known);
        $rates = [];

        foreach ($weekKeys as $key) {
            $rate = $known[$key] ?? null;

            if ($rate === null) {
                foreach ($known as $date => $value) {
                    if ($date > $key) {
                        break;
                    }
                    $rate = $value;
                }
            }

            $rates[$key] = $rate ?? $fallback;
        }

        return $rates;
    }

    /**
     * Saldo inicial: por cada cuenta activa, el saldo más reciente con fecha hasta el inicio del período;
     * si la cuenta no tiene saldo anterior, su primer saldo registrado.
     */
    private function buildOpeningBalance(string $startDate, float $usdRate): array
    {
        $accounts = BankAccount::query()
            ->where('is_active', true)
            ->orderBy('currency_code')
            ->orderBy('bank_name')
            ->get();

        $rows = [];

        foreach ($accounts as $account) {
            $balance = BankBalance::query()
                ->where('bank_account_id', $account->id)
                ->whereDate('balance_date', '<=', $startDate)
                ->orderByDesc('balance_date')
                ->first()
                ?? BankBalance::query()
                    ->where('bank_account_id', $account->id)
                    ->orderBy('balance_date')
                    ->first();

            if (! $balance) {
                continue;
            }

            $rate = $account->currency_code === 'USD' ? $usdRate : 1.0;
            $amount = (float) $balance->amount;

            $rows[] = [
                'cuentaId' => $account->id,
                'banco' => $account->bank_name,
                'cuenta' => $account->account_name,
                'moneda' => $account->currency_code,
                'fecha' => $balance->balance_date->toDateString(),
                'saldo' => $amount,
                'tipoCambio' => $rate,
                'saldoPen' => round($amount * $rate, 2),
                'posteriorAlInicio' => $balance->balance_date->toDateString() > $startDate,
            ];
        }

        return [
            'fechaInicio' => $startDate,
            'totalPen' => round(array_sum(array_column($rows, 'saldoPen')), 2),
            'cuentas' => $rows,
            'cuentasSinSaldo' => $accounts->count() - count($rows),
        ];
    }

    /**
     * @param array<string, int> $weekKeys
     */
    private function buildExpenses(string $from, string $to, array $weekKeys): array
    {
        try {
            $report = $this->gestionComprasApiService->getWeeklySpend(['from' => $from, 'to' => $to]);
        } catch (HttpResponseException $exception) {
            $message = data_get($exception->getResponse()->getData(true), 'message');

            return [
                ...$this->emptyExpenses(),
                'disponible' => false,
                'mensaje' => is_string($message) && $message !== ''
                    ? $message
                    : 'No se pudo consultar Gestión de Compras.',
            ];
        }

        $rows = [];
        $byWeek = [];

        foreach ((array) ($report['finance_rows'] ?? []) as $item) {
            $stage = Str::upper((string) data_get($item, 'etapa', ''));

            if (! in_array($stage, self::EXPENSE_STAGES, true) || ! data_get($item, 'week_start')) {
                continue;
            }

            $key = CarbonImmutable::parse((string) data_get($item, 'week_start'))
                ->startOfWeek(CarbonImmutable::MONDAY)
                ->toDateString();

            if (! isset($weekKeys[$key])) {
                continue;
            }

            $amount = round((float) data_get($item, 'monto_soles', 0), 2);
            $field = $stage === 'PAGADO' ? 'pagado' : 'compromiso';
            $projectCode = (string) (data_get($item, 'proyecto_codigo') ?: 'SIN-PROYECTO');
            $category = (string) (data_get($item, 'categoria_nombre') ?: 'Sin categoría');
            $rowKey = $projectCode.'|'.$category;

            $rows[$rowKey] ??= [
                'clave' => $rowKey,
                'proyectoCodigo' => $projectCode,
                'proyecto' => (string) (data_get($item, 'proyecto_nombre') ?: $projectCode),
                'categoria' => $category,
                'celdas' => [],
                'totales' => $this->emptyExpenseAmounts(),
            ];

            $rows[$rowKey]['celdas'][$key] ??= $this->emptyExpenseAmounts();
            $this->addExpense($rows[$rowKey]['celdas'][$key], $field, $amount);
            $this->addExpense($rows[$rowKey]['totales'], $field, $amount);

            $byWeek[$key] ??= $this->emptyExpenseAmounts();
            $this->addExpense($byWeek[$key], $field, $amount);
        }

        $rows = collect($rows)
            ->sortBy(fn (array $row) => [$row['proyectoCodigo'], $row['categoria']])
            ->map(function (array $row) {
                $row['celdas'] = (object) $row['celdas'];

                return $row;
            })
            ->values();

        return [
            'disponible' => true,
            'mensaje' => null,
            'porSemana' => (object) $byWeek,
            'totales' => $this->sumExpenses($rows),
            'filas' => $rows->all(),
        ];
    }

    private function addExpense(array &$target, string $field, float $amount): void
    {
        $target[$field] = round($target[$field] + $amount, 2);
        $target['total'] = round($target['total'] + $amount, 2);
    }

    private function sumExpenses(Collection $rows): array
    {
        $totals = $this->emptyExpenseAmounts();

        foreach ($rows as $row) {
            foreach (array_keys($totals) as $field) {
                $totals[$field] = round($totals[$field] + $row['totales'][$field], 2);
            }
        }

        return $totals;
    }

    private function emptyExpenses(): array
    {
        return [
            'disponible' => true,
            'mensaje' => null,
            'porSemana' => (object) [],
            'totales' => $this->emptyExpenseAmounts(),
            'filas' => [],
        ];
    }

    private function emptyExpenseAmounts(): array
    {
        return ['pagado' => 0.0, 'compromiso' => 0.0, 'total' => 0.0];
    }
}
