<?php

namespace App\Services\Milestones;

use Carbon\CarbonInterface;

/**
 * Deriva el estado de un hito a partir de las fechas/campos informados.
 * Regla: gana el estado más avanzado cuyo campo discriminante tenga dato.
 */
class MilestoneStatusResolver
{
    public const NO_INICIADO = 'No iniciado';
    public const EN_CURSO = 'En curso';
    public const POR_VALORIZAR = 'Por valorizar';
    public const VALORIZADO = 'Valorizado';
    public const POR_FACTURAR = 'Por facturar';
    public const FACTURADO = 'Facturado';
    public const COBRADO = 'Cobrado';

    /** Orden de avance (menor a mayor). */
    public const ORDER = [
        self::NO_INICIADO => 1,
        self::EN_CURSO => 2,
        self::POR_VALORIZAR => 3,
        self::VALORIZADO => 4,
        self::POR_FACTURAR => 5,
        self::FACTURADO => 6,
        self::COBRADO => 7,
    ];

    public const OWNERS = [
        self::NO_INICIADO => 'Comercial',
        self::EN_CURSO => 'Coordinadores',
        self::POR_VALORIZAR => 'Coordinadores',
        self::VALORIZADO => 'Sylda',
        self::POR_FACTURAR => 'Sylda',
        self::FACTURADO => 'Julissa',
        self::COBRADO => 'Julissa',
    ];

    /**
     * @param array{
     *     estimated_billing_date?: mixed,
     *     estimated_valuation_date?: mixed,
     *     actual_valuation_date?: mixed,
     *     valuation_approval_date?: mixed,
     *     actual_billing_date?: mixed,
     *     invoice_received_date?: mixed,
     *     estimated_payment_date?: mixed,
     *     invoice_number?: mixed,
     *     actual_collection_date?: mixed,
     * } $fields
     * @return array{status: string, owner: string, mismatch: bool, source_status: string|null}
     */
    public function resolve(array $fields, ?string $sourceStatus): array
    {
        $source = $this->canonical($sourceStatus);
        $status = $this->derive($fields, $source);

        return [
            'status' => $status,
            'owner' => self::OWNERS[$status],
            'mismatch' => $source !== $status,
            'source_status' => $source,
        ];
    }

    /**
     * Devuelve la fecha usada para ubicar el monto en el flujo: FRC, si no FEP, si no FEF.
     */
    public function cashDate(array $fields): mixed
    {
        foreach (['actual_collection_date', 'estimated_payment_date', 'estimated_billing_date'] as $key) {
            if ($this->filled($fields[$key] ?? null)) {
                return $fields[$key];
            }
        }

        return null;
    }

    /**
     * Normaliza el texto de estado de Excel a la etiqueta canónica (o null si no es reconocible).
     */
    public function canonical(?string $status): ?string
    {
        if ($status === null) {
            return null;
        }

        $normalized = mb_strtolower(trim(preg_replace('/\s+/', ' ', $status) ?? ''));

        foreach (array_keys(self::ORDER) as $label) {
            if (mb_strtolower($label) === $normalized) {
                return $label;
            }
        }

        return $normalized === '' ? null : trim($status);
    }

    public static function rank(?string $status): int
    {
        return self::ORDER[$status] ?? 0;
    }

    private function derive(array $fields, ?string $source): string
    {
        if ($this->filled($fields['actual_collection_date'] ?? null)) {
            return self::COBRADO;
        }

        if (
            $this->filled($fields['actual_billing_date'] ?? null)
            || $this->filled($fields['invoice_number'] ?? null)
            || $this->filled($fields['invoice_received_date'] ?? null)
        ) {
            return self::FACTURADO;
        }

        if ($this->filled($fields['valuation_approval_date'] ?? null)) {
            return self::POR_FACTURAR;
        }

        if ($this->filled($fields['actual_valuation_date'] ?? null)) {
            return self::VALORIZADO;
        }

        // FEV y Moneda son comunes a todos los estados: no discriminan.
        $hasExecutionDates = $this->filled($fields['estimated_billing_date'] ?? null)
            || $this->filled($fields['estimated_payment_date'] ?? null);

        // No iniciado no debe tener FEF ni FEP.
        if (! $hasExecutionDates) {
            return self::NO_INICIADO;
        }

        // Con FEF/FEP y sin FRV: En curso. Por valorizar comparte campos, se toma del Estatus del Excel.
        return $source === self::POR_VALORIZAR ? self::POR_VALORIZAR : self::EN_CURSO;
    }

    private function filled(mixed $value): bool
    {
        if ($value instanceof CarbonInterface) {
            return true;
        }

        return $value !== null && trim((string) $value) !== '';
    }
}
