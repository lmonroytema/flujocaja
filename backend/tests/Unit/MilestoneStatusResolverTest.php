<?php

namespace Tests\Unit;

use App\Services\Milestones\MilestoneStatusResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MilestoneStatusResolverTest extends TestCase
{
    public static function cases(): array
    {
        $plan = ['estimated_billing_date' => '2026-07-01', 'estimated_payment_date' => '2026-08-01'];

        return [
            // No iniciado: sin FEF ni FEP (FEV/Moneda no discriminan).
            'sin fechas + No Iniciado' => [[], 'No Iniciado', 'No iniciado', false],
            'solo FEV + No Iniciado' => [['estimated_valuation_date' => '2026-07-01'], 'No Iniciado', 'No iniciado', false],
            'sin FEF ni FEP + En Curso' => [['estimated_valuation_date' => '2026-07-01'], 'En Curso', 'No iniciado', true],
            'sin FEF ni FEP + Por valorizar' => [[], 'Por valorizar', 'No iniciado', true],
            'sin fechas + estado avanzado' => [[], 'Facturado', 'No iniciado', true],
            // En curso: con FEF y FEP, sin FRV.
            'FEF y FEP + En Curso' => [[...$plan, 'estimated_valuation_date' => '2026-06-01'], 'En Curso', 'En curso', false],
            'FEF y FEP + No Iniciado' => [$plan, 'No Iniciado', 'En curso', true],
            'solo FEF + En Curso' => [['estimated_billing_date' => '2026-07-01'], 'En Curso', 'En curso', false],
            'solo FEP + No Iniciado' => [['estimated_payment_date' => '2026-08-01'], 'No Iniciado', 'En curso', true],
            'FEF y FEP + estado vacío' => [$plan, '', 'En curso', true],
            // Límite con Por valorizar: mismos campos, se respeta el Estatus; con FRV pasa a Valorizado.
            'FEF y FEP + Por valorizar' => [$plan, 'Por Valorizar', 'Por valorizar', false],
            'FEF y FEP + Valorizado sin FRV' => [$plan, 'Valorizado', 'En curso', true],
            'FRV + En Curso' => [[...$plan, 'actual_valuation_date' => '2026-07-02'], 'En Curso', 'Valorizado', true],
            'valorizado' => [[...$plan, 'actual_valuation_date' => '2026-07-02'], 'Valorizado', 'Valorizado', false],
            'por facturar (FAV)' => [[...$plan, 'actual_valuation_date' => '2026-07-02', 'valuation_approval_date' => '2026-07-03'], 'Valorizado', 'Por facturar', true],
            'facturado por FRF' => [[...$plan, 'actual_billing_date' => '2026-07-05'], 'Facturado', 'Facturado', false],
            'facturado por No. Factura' => [[...$plan, 'invoice_number' => 'E001-1'], 'Facturado', 'Facturado', false],
            'facturado por FRecF' => [['invoice_received_date' => '2026-07-05'], 'Facturado', 'Facturado', false],
            'cobrado gana siempre' => [[...$plan, 'actual_collection_date' => '2026-09-01'], 'Facturado', 'Cobrado', true],
        ];
    }

    #[DataProvider('cases')]
    public function test_derives_most_advanced_status(array $fields, string $source, string $expected, bool $mismatch): void
    {
        $result = (new MilestoneStatusResolver())->resolve($fields, $source);

        $this->assertSame($expected, $result['status']);
        $this->assertSame($mismatch, $result['mismatch']);
        $this->assertSame(MilestoneStatusResolver::OWNERS[$expected], $result['owner']);
    }

    public function test_cash_date_priority_is_frc_then_fep_then_fef(): void
    {
        $resolver = new MilestoneStatusResolver();

        $this->assertSame('3', $resolver->cashDate([
            'estimated_billing_date' => '1', 'estimated_payment_date' => '2', 'actual_collection_date' => '3',
        ]));
        $this->assertSame('2', $resolver->cashDate(['estimated_billing_date' => '1', 'estimated_payment_date' => '2']));
        $this->assertSame('1', $resolver->cashDate(['estimated_billing_date' => '1', 'actual_billing_date' => '9']));
        $this->assertNull($resolver->cashDate(['actual_valuation_date' => '9']));
    }
}
