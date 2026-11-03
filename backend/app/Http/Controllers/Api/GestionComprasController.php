<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Integrations\GestionComprasApiService;
use Illuminate\Http\Request;

class GestionComprasController extends Controller
{
    public function __construct(
        private readonly GestionComprasApiService $gestionComprasApiService,
    ) {
    }

    public function categories()
    {
        return response()->json(
            $this->gestionComprasApiService->getCategories()
        );
    }

    public function weeklySpend(Request $request)
    {
        $filters = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'categoria_id' => ['nullable', 'integer'],
            'proyecto_codigo' => ['nullable', 'string'],
            'etapa' => ['nullable', 'in:COMPROMISO,FACTURADO,PAGADO'],
        ]);

        return response()->json(
            $this->gestionComprasApiService->getWeeklySpend($filters)
        );
    }

    public function orderFinance(string $orderNumber)
    {
        return response()->json(
            $this->gestionComprasApiService->getOrderFinance($orderNumber)
        );
    }

    public function storeInvoiced(Request $request, string $orderNumber)
    {
        $payload = $request->validate([
            'fecha' => ['required', 'date'],
            'importe' => ['required', 'numeric', 'gt:0'],
            'numero_factura' => ['required', 'string'],
        ]);

        return response()->json(
            $this->gestionComprasApiService->createInvoiced($orderNumber, $payload)
        );
    }

    public function storePaid(Request $request, string $orderNumber)
    {
        $payload = $request->validate([
            'fecha' => ['required', 'date'],
            'importe' => ['required', 'numeric', 'gt:0'],
        ]);

        return response()->json(
            $this->gestionComprasApiService->createPaid($orderNumber, $payload)
        );
    }

    public function updateFinance(Request $request, string $financeId)
    {
        $payload = $request->validate([
            'fecha' => ['required', 'date'],
            'importe' => ['required', 'numeric', 'gt:0'],
            'numero_factura' => ['nullable', 'string'],
        ]);

        return response()->json(
            $this->gestionComprasApiService->updateFinance($financeId, $payload)
        );
    }

    public function deleteFinance(string $financeId)
    {
        return response()->json(
            $this->gestionComprasApiService->deleteFinance($financeId)
        );
    }
}
