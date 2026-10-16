<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Integrations\GestionComprasApiService;
use Illuminate\Http\Request;

class PurchaseIntegrationConfigController extends Controller
{
    public function __construct(
        private readonly GestionComprasApiService $gestionComprasApiService,
    ) {
    }

    public function show()
    {
        return response()->json(
            $this->gestionComprasApiService->getConfigSummary()
        );
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'base_url' => ['required', 'url'],
            'public_token' => ['nullable', 'string'],
        ]);

        return response()->json([
            'message' => 'Configuración guardada correctamente.',
            'config' => $this->gestionComprasApiService->saveConfig($data),
        ]);
    }

    public function test(Request $request)
    {
        $data = $request->validate([
            'base_url' => ['nullable', 'url'],
            'public_token' => ['nullable', 'string'],
        ]);

        $override = filled($data['base_url'] ?? null) || filled($data['public_token'] ?? null)
            ? $data
            : null;

        return response()->json(
            $this->gestionComprasApiService->testConnection($override)
        );
    }
}
