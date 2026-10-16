<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BankBalance;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Cuentas bancarias y sus saldos (por fecha de corte) para el saldo inicial del flujo de caja.
 */
class BankAccountController extends Controller
{
    public function index()
    {
        $accounts = BankAccount::query()
            ->with(['balances' => fn ($query) => $query->orderByDesc('balance_date')])
            ->orderByDesc('is_active')
            ->orderBy('currency_code')
            ->orderBy('bank_name')
            ->orderBy('account_name')
            ->get();

        return response()->json([
            'data' => $accounts->map(fn (BankAccount $account) => $this->present($account))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $account = BankAccount::query()->create($this->validateAccount($request));

        return response()->json(['data' => $this->present($account->load('balances'))], 201);
    }

    public function update(Request $request, BankAccount $bankAccount)
    {
        $bankAccount->update($this->validateAccount($request));

        return response()->json(['data' => $this->present($bankAccount->load('balances'))]);
    }

    public function destroy(BankAccount $bankAccount)
    {
        $bankAccount->delete();

        return response()->json(['message' => 'Cuenta eliminada.']);
    }

    /**
     * Registra el saldo de una cuenta a una fecha; si ya existe para esa fecha, lo reemplaza.
     */
    public function storeBalance(Request $request, BankAccount $bankAccount)
    {
        $data = $request->validate([
            'balance_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'between:-9999999999999,9999999999999'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $balance = BankBalance::query()->updateOrCreate(
            [
                'bank_account_id' => $bankAccount->id,
                'balance_date' => substr((string) $data['balance_date'], 0, 10),
            ],
            [
                'amount' => $data['amount'],
                'notes' => $data['notes'] ?? null,
            ],
        );

        return response()->json(['data' => $this->presentBalance($balance)], 201);
    }

    public function destroyBalance(BankBalance $bankBalance)
    {
        $bankBalance->delete();

        return response()->json(['message' => 'Saldo eliminado.']);
    }

    private function validateAccount(Request $request): array
    {
        $data = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_name' => ['required', 'string', 'max:150'],
            'account_number' => ['nullable', 'string', 'max:50'],
            'currency_code' => ['required', Rule::in(['PEN', 'USD'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return [
            ...$data,
            'bank_name' => trim($data['bank_name']),
            'account_name' => trim($data['account_name']),
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : null,
        ];
    }

    private function present(BankAccount $account): array
    {
        return [
            'id' => $account->id,
            'banco' => $account->bank_name,
            'cuenta' => $account->account_name,
            'numero' => $account->account_number,
            'moneda' => $account->currency_code,
            'activa' => $account->is_active,
            'saldos' => $account->balances->map(fn (BankBalance $balance) => $this->presentBalance($balance))->values(),
        ];
    }

    private function presentBalance(BankBalance $balance): array
    {
        return [
            'id' => $balance->id,
            'fecha' => $balance->balance_date->toDateString(),
            'monto' => (float) $balance->amount,
            'notas' => $balance->notes,
        ];
    }
}
