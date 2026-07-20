<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class IncomeCashFlowExport implements FromArray, ShouldAutoSize, WithEvents
{
    public function __construct(
        private readonly array $report,
    ) {
    }

    public function array(): array
    {
        $rows = [];
        $periods = $this->report['periodos'];

        $rows[] = ['', '', '', '', 'Flujo de Caja de Ingresos (S/.)'];
        $rows[] = ['', '', '', '', $this->monthName((int) $this->report['mes']).' '.$this->report['anio']];

        $headerMonths = ['CODIGO', 'UNIDAD DE NEGOCIO', 'CLIENTE', 'CONCEPTO'];
        $headerWeeks = ['CODIGO', 'UNIDAD DE NEGOCIO', 'CLIENTE', 'CONCEPTO'];

        foreach ($periods as $period) {
            $headerMonths[] = strtoupper($this->monthName((int) $period['mes']).' '.$period['anio']);
            $headerWeeks[] = $period['etiqueta'];
        }

        $headerMonths[] = 'TOTAL S/.';
        $headerWeeks[] = 'TOTAL S/.';

        $rows[] = $headerMonths;
        $rows[] = $headerWeeks;

        foreach ($this->report['filas'] as $row) {
            $line = [
                $row['codigoProyecto'],
                $row['unidadNegocio'],
                $row['cliente'],
                $row['concepto'],
            ];

            foreach ($periods as $period) {
                $line[] = $row['hitos'][$period['id']]['montoPen'] ?? 0;
            }

            $line[] = $row['totalPen'];
            $rows[] = $line;
        }

        $totalRow = ['TOTAL GENERAL', '', '', ''];

        foreach ($periods as $period) {
            $totalRow[] = collect($this->report['filas'])->sum(
                fn (array $row) => $row['hitos'][$period['id']]['montoPen'] ?? 0
            );
        }

        $totalRow[] = $this->report['totalGeneralPen'];
        $rows[] = $totalRow;

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $columnCount = 5 + count($this->report['periodos']);
                $lastColumn = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($columnCount);

                $sheet->mergeCells("E1:{$lastColumn}1");
                $sheet->mergeCells("E2:{$lastColumn}2");
                $sheet->freezePane('E5');

                $sheet->getStyle("A1:{$lastColumn}4")->getFont()->setBold(true);
                $sheet->getStyle("A3:{$lastColumn}4")->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FF10344B');
                $sheet->getStyle("A3:{$lastColumn}4")->getFont()->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle("A".(count($this->report['filas']) + 5).":{$lastColumn}".(count($this->report['filas']) + 5))
                    ->getFont()->setBold(true);
            },
        ];
    }

    private function monthName(int $month): string
    {
        return [
            1 => 'Enero',
            2 => 'Febrero',
            3 => 'Marzo',
            4 => 'Abril',
            5 => 'Mayo',
            6 => 'Junio',
            7 => 'Julio',
            8 => 'Agosto',
            9 => 'Septiembre',
            10 => 'Octubre',
            11 => 'Noviembre',
            12 => 'Diciembre',
        ][$month];
    }
}
