<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Exporta el flujo semanal: encabezado de 3 niveles (mes / semana / moneda), una fila por proyecto.
 */
class WeeklyCashFlowExport implements FromArray, WithEvents
{
    private const FIXED = ['CODIGO', 'PROYECTO', 'UNIDAD DE NEGOCIO', 'CLIENTE', 'ESTADO', 'DISCREPANCIAS'];

    public function __construct(
        private readonly array $report,
    ) {
    }

    public function array(): array
    {
        $currencies = $this->report['monedas'];
        $weeks = $this->weeks();
        $blank = array_fill(0, count(self::FIXED), '');

        $title = [...$blank];
        $title[0] = sprintf('Flujo de Caja de Ingresos por semana (%s a %s)', $this->report['desde'], $this->report['hasta']);

        $monthRow = [...self::FIXED];
        $weekRow = [...self::FIXED];
        $currencyRow = [...self::FIXED];

        foreach ($weeks as $week) {
            foreach ($currencies as $index => $currency) {
                $monthRow[] = $index === 0 && $week['primeraDelMes'] ? mb_strtoupper($week['mes']) : '';
                $weekRow[] = $index === 0 ? $week['etiqueta'] : '';
                $currencyRow[] = $currency;
            }
        }

        foreach (['SIN FECHA', 'TOTAL'] as $label) {
            foreach ($currencies as $index => $currency) {
                $monthRow[] = $index === 0 ? $label : '';
                $weekRow[] = '';
                $currencyRow[] = $currency;
            }
        }

        $rows = [$title, $monthRow, $weekRow, $currencyRow];

        foreach ($this->report['filas'] as $row) {
            $cells = (array) $row['celdas'];
            $line = [
                $row['codigoProyecto'],
                $row['proyecto'],
                $row['unidadNegocio'],
                $row['cliente'],
                $row['estado'],
                $row['discrepancias'],
            ];

            foreach ($weeks as $week) {
                foreach ($currencies as $currency) {
                    $line[] = $cells[$week['clave']]['montos'][$currency] ?? 0;
                }
            }

            foreach ($currencies as $currency) {
                $line[] = $row['sinFecha']['montos'][$currency] ?? 0;
            }

            foreach ($currencies as $currency) {
                $line[] = $row['totales'][$currency] ?? 0;
            }

            $rows[] = $line;
        }

        $totalLine = ['TOTAL GENERAL', '', '', '', '', ''];
        $byWeek = (array) $this->report['totales']['porSemana'];

        foreach ($weeks as $week) {
            foreach ($currencies as $currency) {
                $totalLine[] = $byWeek[$week['clave']][$currency] ?? 0;
            }
        }

        foreach ($currencies as $currency) {
            $totalLine[] = $this->report['totales']['sinFecha'][$currency] ?? 0;
        }

        foreach ($currencies as $currency) {
            $totalLine[] = $this->report['totales']['general'][$currency] ?? 0;
        }

        $rows[] = $totalLine;

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $currencies = count($this->report['monedas']);
                $fixed = count(self::FIXED);
                $columnCount = $fixed + (count($this->weeks()) + 2) * $currencies;
                $lastColumn = Coordinate::stringFromColumnIndex($columnCount);
                $lastRow = count($this->report['filas']) + 5;

                $column = $fixed + 1;

                foreach ($this->report['meses'] as $month) {
                    $span = count($month['semanas']) * $currencies;

                    if ($span > 1) {
                        $sheet->mergeCells(
                            Coordinate::stringFromColumnIndex($column).'2:'.Coordinate::stringFromColumnIndex($column + $span - 1).'2'
                        );
                    }

                    $column += $span;
                }

                for ($column = $fixed + 1; $column <= $columnCount; $column += $currencies) {
                    $from = Coordinate::stringFromColumnIndex($column);
                    $to = Coordinate::stringFromColumnIndex($column + $currencies - 1);
                    $sheet->mergeCells("{$from}3:{$to}3");
                }

                $sheet->freezePane(Coordinate::stringFromColumnIndex($fixed + 1).'5');
                $sheet->getStyle("A1:{$lastColumn}4")->getFont()->setBold(true);
                $sheet->getStyle("A2:{$lastColumn}4")->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FF10344B');
                $sheet->getStyle("A2:{$lastColumn}4")->getFont()->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle("A{$lastRow}:{$lastColumn}{$lastRow}")->getFont()->setBold(true);
                $sheet->getStyle(Coordinate::stringFromColumnIndex($fixed + 1)."5:{$lastColumn}{$lastRow}")
                    ->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getColumnDimension('A')->setWidth(12);
                $sheet->getColumnDimension('B')->setWidth(45);
            },
        ];
    }

    private function weeks(): array
    {
        $weeks = [];

        foreach ($this->report['meses'] as $month) {
            foreach ($month['semanas'] as $index => $week) {
                $weeks[] = [...$week, 'mes' => $month['etiqueta'], 'primeraDelMes' => $index === 0];
            }
        }

        return $weeks;
    }
}
