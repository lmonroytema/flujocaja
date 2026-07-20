<?php

namespace App\Support;

use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkbookReader
{
    public function read(string $absolutePath, array $expectedHeaders, array $preferredSheetNames = []): array
    {
        $spreadsheet = IOFactory::load($absolutePath);
        $worksheet = $this->resolveWorksheet($spreadsheet->getAllSheets(), $preferredSheetNames);

        $rows = $worksheet->toArray(null, true, true, false);

        if ($rows === []) {
            throw new InvalidArgumentException('El archivo no contiene filas para importar.');
        }

        $headers = array_map([$this, 'normalizeHeader'], $rows[0]);
        $expected = array_map([$this, 'normalizeHeader'], $expectedHeaders);

        if ($headers !== $expected) {
            throw new InvalidArgumentException('La estructura de columnas del archivo no coincide con la esperada.');
        }

        $items = [];

        foreach (array_slice($rows, 1) as $row) {
            $mapped = [];

            foreach ($expectedHeaders as $index => $header) {
                $mapped[$header] = $this->sanitizeCell($row[$index] ?? null);
            }

            $items[] = $mapped;
        }

        return [
            'sheet_name' => $worksheet->getTitle(),
            'headers' => $expectedHeaders,
            'rows' => $items,
        ];
    }

    /**
     * @param array<int, Worksheet> $worksheets
     */
    private function resolveWorksheet(array $worksheets, array $preferredSheetNames): Worksheet
    {
        foreach ($preferredSheetNames as $preferredSheetName) {
            foreach ($worksheets as $worksheet) {
                if ($worksheet->getTitle() === $preferredSheetName) {
                    return $worksheet;
                }
            }
        }

        foreach ($worksheets as $worksheet) {
            if ($worksheet->getSheetState() === Worksheet::SHEETSTATE_VISIBLE) {
                return $worksheet;
            }
        }

        return $worksheets[0];
    }

    private function normalizeHeader(mixed $value): string
    {
        return trim((string) $value);
    }

    private function sanitizeCell(mixed $value): mixed
    {
        if (is_string($value)) {
            $trimmed = trim($value);

            return $trimmed === '' ? null : $trimmed;
        }

        return $value;
    }
}
