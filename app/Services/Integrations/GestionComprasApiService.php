<?php

namespace App\Services\Integrations;

use App\Models\PurchaseApiConfig;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class GestionComprasApiService
{
    private const PROVIDER = 'gestion-compras';

    public function getConfigSummary(): array
    {
        $config = PurchaseApiConfig::query()
            ->where('provider', self::PROVIDER)
            ->first();

        return [
            'base_url' => $config?->base_url ?? '',
            'has_token' => filled($config?->public_token),
            'connection_status' => $config?->connection_status,
            'connection_message' => $config?->connection_message,
            'last_checked_at' => $config?->last_checked_at?->toIso8601String(),
        ];
    }

    public function saveConfig(array $data): array
    {
        $config = PurchaseApiConfig::query()->firstOrNew([
            'provider' => self::PROVIDER,
        ]);

        $config->base_url = rtrim($data['base_url'], '/');

        if (filled($data['public_token'] ?? null)) {
            $config->public_token = $data['public_token'];
        }

        if (! filled($config->public_token)) {
            $this->throwJsonError('Debes registrar el Public Token para habilitar la integración.', 422);
        }

        $config->save();

        return $this->getConfigSummary();
    }

    public function testConnection(?array $override = null): array
    {
        $override = $this->mergeOverrideWithStoredConfig($override);
        $usingOverride = $override !== null;
        $payload = $this->performRequest('GET', '/public/categorias', [
            'override' => $override,
            'persist_status' => ! $usingOverride,
        ]);

        if (! $usingOverride) {
            $config = $this->requireConfig();
            $config->forceFill([
                'connection_status' => 'valid',
                'connection_message' => 'Conexión validada correctamente.',
                'last_checked_at' => now(),
            ])->save();
        }

        return [
            'message' => 'Conexión validada correctamente.',
            'config' => $usingOverride ? [
                'base_url' => rtrim((string) ($override['base_url'] ?? ''), '/'),
                'has_token' => filled($override['public_token'] ?? null),
                'connection_status' => 'valid',
                'connection_message' => 'Conexión validada correctamente.',
                'last_checked_at' => now()->toIso8601String(),
            ] : $this->getConfigSummary(),
            'categories_count' => $this->countCollectionItems($payload),
        ];
    }

    public function getCategories(): array
    {
        $payload = $this->performRequest('GET', '/public/categorias');

        $categories = collect($payload)
            ->map(function ($item): array {
                return [
                    'id' => (int) data_get($item, 'id'),
                    'name' => (string) (
                        data_get($item, 'nombre')
                        ?? data_get($item, 'name')
                        ?? data_get($item, 'descripcion')
                        ?? 'Sin categoría'
                    ),
                ];
            })
            ->filter(fn (array $item): bool => $item['id'] > 0)
            ->values()
            ->all();

        return [
            'data' => $categories,
        ];
    }

    public function getWeeklySpend(array $filters): array
    {
        $payload = $this->performRequest(
            'GET',
            '/public/reports/spend-by-week-category',
            [
                'query' => array_filter([
                    'from' => $filters['from'],
                    'to' => $filters['to'],
                    'categoria_id' => $filters['categoria_id'] ?? null,
                    'proyecto_codigo' => $filters['proyecto_codigo'] ?? null,
                    'etapa' => $filters['etapa'] ?? null,
                ], fn ($value): bool => filled($value)),
            ],
        );

        $report = $this->unwrapData($payload);

        return [
            'spend_rows' => data_get($report, 'spend_rows', []),
            'spend_weeks' => data_get($report, 'spend_weeks', []),
            'finance_rows' => data_get($report, 'finance_rows', []),
            'finance_weeks' => data_get($report, 'finance_weeks', []),
            'spend_summary' => data_get($report, 'spend_summary', []),
            'finance_summary' => data_get($report, 'finance_summary', []),
            'display_rows' => $this->buildWeeklyDisplayRows($report),
        ];
    }

    public function getOrderFinance(string $orderNumber): array
    {
        $order = $this->unwrapData($this->performRequest(
            'GET',
            '/public/orders/' . rawurlencode($orderNumber) . '/finanzas',
        ));

        return [
            ...$order,
            'compromisos' => array_values((array) data_get($order, 'compromisos', [])),
            'facturados' => array_values((array) data_get($order, 'facturados', [])),
            'pagados' => array_values((array) data_get($order, 'pagados', [])),
            'summary' => [
                'comprometido' => (float) data_get($order, 'summary.comprometido', 0),
                'facturado' => (float) data_get($order, 'summary.facturado', 0),
                'pagado' => (float) data_get($order, 'summary.pagado', 0),
                'saldo_por_facturar' => (float) data_get($order, 'summary.saldo_por_facturar', 0),
                'saldo_por_pagar' => (float) data_get($order, 'summary.saldo_por_pagar', 0),
            ],
        ];
    }

    /**
     * La API pública de Gestión de Compras responde { success, data: {...} }.
     */
    private function unwrapData(array $payload): array
    {
        $data = data_get($payload, 'data');

        return is_array($data) ? $data : $payload;
    }

    public function createInvoiced(string $orderNumber, array $payload): array
    {
        return $this->performRequest(
            'POST',
            '/public/orders/' . rawurlencode($orderNumber) . '/finanzas/facturados',
            ['json' => $payload],
        );
    }

    public function createPaid(string $orderNumber, array $payload): array
    {
        return $this->performRequest(
            'POST',
            '/public/orders/' . rawurlencode($orderNumber) . '/finanzas/pagados',
            ['json' => $payload],
        );
    }

    public function updateFinance(string $financeId, array $payload): array
    {
        return $this->performRequest(
            'PUT',
            '/public/orders/finanzas/' . rawurlencode($financeId),
            ['json' => $payload],
        );
    }

    public function deleteFinance(string $financeId): array
    {
        return $this->performRequest(
            'DELETE',
            '/public/orders/finanzas/' . rawurlencode($financeId),
        );
    }

    /**
     * Gestión de Compras devuelve una fila por semana, proyecto y categoría:
     * spend_rows con compras_soles/servicios_soles y finance_rows con etapa/monto_soles.
     */
    private function buildWeeklyDisplayRows(array $report): array
    {
        $rows = [];

        foreach (data_get($report, 'spend_rows', []) as $row) {
            $entry = &$this->displayRowFor($rows, $row);
            $entry['compras'] += (float) data_get($row, 'compras_soles', 0);
            $entry['servicios'] += (float) data_get($row, 'servicios_soles', 0);
            unset($entry);
        }

        foreach (data_get($report, 'finance_rows', []) as $row) {
            $stage = Str::upper((string) data_get($row, 'etapa', ''));
            $field = match ($stage) {
                'FACTURADO' => 'facturado',
                'PAGADO' => 'pagado',
                default => 'compromiso',
            };

            $entry = &$this->displayRowFor($rows, $row);
            $entry[$field] += (float) data_get($row, 'monto_soles', 0);

            if ($stage !== '' && ! in_array($stage, $entry['stages'], true)) {
                $entry['stages'][] = $stage;
            }
            unset($entry);
        }

        $displayRows = array_map(function (array $entry): array {
            $entry['etapa'] = implode(', ', $entry['stages']);
            unset($entry['stages']);

            foreach (['compras', 'servicios', 'compromiso', 'facturado', 'pagado'] as $field) {
                $entry[$field] = round($entry[$field], 2);
            }

            return $entry;
        }, array_values($rows));

        usort($displayRows, fn (array $a, array $b): int => [$a['week_start'], $a['project_code'], $a['category']]
            <=> [$b['week_start'], $b['project_code'], $b['category']]);

        return $displayRows;
    }

    private function &displayRowFor(array &$rows, mixed $row): array
    {
        $weekStart = (string) data_get($row, 'week_start', '-');
        $weekEnd = (string) data_get($row, 'week_end', '-');
        $projectCode = (string) data_get($row, 'proyecto_codigo', 'SIN-PROYECTO');
        $category = (string) data_get($row, 'categoria_nombre', 'Sin categoría');
        $key = implode('|', [$weekStart, $weekEnd, $projectCode, $category]);

        $rows[$key] ??= [
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'project_code' => $projectCode,
            'category' => $category,
            'etapa' => '',
            'stages' => [],
            'compras' => 0.0,
            'servicios' => 0.0,
            'compromiso' => 0.0,
            'facturado' => 0.0,
            'pagado' => 0.0,
        ];

        return $rows[$key];
    }

    private function performRequest(string $method, string $path, array $options = []): array
    {
        [$baseUrl, $publicToken] = $this->resolveCredentials($options['override'] ?? null);
        $url = rtrim($baseUrl, '/') . $path;
        $persistStatus = $options['persist_status'] ?? true;

        try {
            $request = Http::acceptJson()
                ->timeout(20)
                ->withHeaders([
                    'X-Public-Token' => $publicToken,
                ]);

            $response = match (Str::upper($method)) {
                'GET' => $request->get($url, $options['query'] ?? []),
                'POST' => $request->post($url, $options['json'] ?? []),
                'PUT' => $request->put($url, $options['json'] ?? []),
                'DELETE' => $request->delete($url),
                default => throw new \InvalidArgumentException("Método HTTP no soportado: {$method}."),
            };
        } catch (ConnectionException) {
            if ($persistStatus) {
                $this->markConfigAsError('No se pudo conectar con la API de Gestión de Compras.');
            }
            $this->throwJsonError('No se pudo conectar con la API de Gestión de Compras.', 503);
        }

        return $this->handleResponse($response, $persistStatus);
    }

    private function handleResponse(Response $response, bool $persistStatus = true): array
    {
        if ($response->successful()) {
            $payload = $response->json();

            // Una Base URL sin /api devuelve la página web (HTML) con 200 en lugar de la API.
            if (! is_array($payload) && trim($response->body()) !== '') {
                $message = 'La Base URL no apunta a la API de Gestión de Compras (respondió con una página web, no con JSON). Revisa que termine en /api, por ejemplo https://gcs.temalitoclean.com/api.';

                if ($persistStatus) {
                    $this->markConfigAsError($message);
                }
                $this->throwJsonError($message, 502);
            }

            return $payload ?? [];
        }

        $payload = $response->json() ?? [];
        $message = data_get($payload, 'message')
            ?? ($response->body() !== '' ? $response->body() : 'La API de Gestión de Compras devolvió un error.');

        $friendlyMessage = match ($response->status()) {
            401 => 'Token inválido o faltante para la integración con Gestión de Compras.',
            404 => 'No se encontró el recurso solicitado en Gestión de Compras.',
            422 => (string) $message,
            default => (string) $message,
        };

        if ($persistStatus) {
            $this->markConfigAsError($friendlyMessage);
        }
        $this->throwJsonError($friendlyMessage, $response->status(), $payload);
    }

    private function countCollectionItems(array $payload): int
    {
        if (array_is_list($payload)) {
            return count($payload);
        }

        $data = data_get($payload, 'data');

        return is_array($data) ? count($data) : count($payload);
    }

    /**
     * Sin token en el override se usa el token almacenado: si la Base URL coincide
     * con la guardada (o viene vacía) se prueba la configuración registrada.
     */
    private function mergeOverrideWithStoredConfig(?array $override): ?array
    {
        if ($override === null || filled($override['public_token'] ?? null)) {
            return $override;
        }

        $config = PurchaseApiConfig::query()
            ->where('provider', self::PROVIDER)
            ->first();

        if (! $config || ! filled($config->public_token)) {
            return $override;
        }

        $baseUrl = rtrim((string) ($override['base_url'] ?? ''), '/');

        if ($baseUrl === '' || $baseUrl === rtrim((string) $config->base_url, '/')) {
            return null;
        }

        return [
            'base_url' => $baseUrl,
            'public_token' => (string) $config->public_token,
        ];
    }

    private function resolveCredentials(?array $override = null): array
    {
        if ($override !== null) {
            $baseUrl = rtrim((string) ($override['base_url'] ?? ''), '/');
            $publicToken = (string) ($override['public_token'] ?? '');

            if ($baseUrl === '' || $publicToken === '') {
                $this->throwJsonError('Debes indicar la Base URL y el Public Token para probar la conexión.', 422);
            }

            return [$baseUrl, $publicToken];
        }

        $config = $this->requireConfig();

        return [rtrim($config->base_url, '/'), (string) $config->public_token];
    }

    private function requireConfig(): PurchaseApiConfig
    {
        $config = PurchaseApiConfig::query()
            ->where('provider', self::PROVIDER)
            ->first();

        if (! $config || ! filled($config->base_url) || ! filled($config->public_token)) {
            $this->throwJsonError('Primero debes configurar la integración con Gestión de Compras.', 409);
        }

        return $config;
    }

    private function markConfigAsError(string $message): void
    {
        $config = PurchaseApiConfig::query()
            ->where('provider', self::PROVIDER)
            ->first();

        if (! $config) {
            return;
        }

        $config->forceFill([
            'connection_status' => 'error',
            'connection_message' => $message,
            'last_checked_at' => now(),
        ])->save();
    }

    private function throwJsonError(string $message, int $status, array $payload = []): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'payload' => $payload,
        ], $status));
    }
}
