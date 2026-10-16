<?php

namespace App\Support;

use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkbookReader
{
    /**
     * @param array<int, string> $expectedHeaders Encabezados obligatorios.
     * @param array<int, string> $optionalHeaders Encabezados opcionales. Si se indican, las columnas se
     *                                            mapean por nombre (sin importar el orden) y las opcionales
     *                                            ausentes se devuelven como null.
     */
    public function read(
        string $absolutePath,
        array $expectedHeaders,
        array $preferredSheetNames = [],
        array $optionalHeaders = [],
    ): array {
        $spreadsheet = IOFactory::load($absolutePath);
        $worksheet = $this->resolveWorksheet($spreadsheet->getAllSheets(), $preferredSheetNames);

        $rows = $worksheet->toArray(null, true, true, false);

        if ($rows === []) {
            throw new InvalidArgumentException('El archivo no contiene filas para importar.');
        }

        $headers = array_map([$this, 'normalizeHeader'], $rows[0]);

        if ($optionalHeaders === []) {
            $expected = array_map([$this, 'normalizeHeader'], $expectedHeaders);

            if ($headers !== $expected) {
                throw new InvalidArgumentException('La estructura de columnas del archivo no coincide con la esperada.');
            }

            $indexes = array_flip($expectedHeaders);
            $presentOptional = [];
        } else {
            [$indexes, $presentOptional] = $this->resolveIndexesByName($headers, $expectedHeaders, $optionalHeaders);
        }

        $allHeaders = [...$expectedHeaders, ...$optionalHeaders];
        $items = [];

        foreach (array_slice($rows, 1) as $row) {
            $mapped = [];

            foreach ($allHeaders as $header) {
                $index = $indexes[$header] ?? null;
                $mapped[$header] = $index === null ? null : $this->sanitizeCell($row[$index] ?? null);
            }

            if (array_filter($mapped, fn ($value) => $value !== null) === []) {
                continue;
            }

            $items[] = $mapped;
        }

        return [
            'sheet_name' => $worksheet->getTitle(),
            'headers' => $expectedHeaders,
            'optional_headers_present' => $presentOptional,
            'rows' => $items,
        ];
    }

    /**
     * @return array{0: array<string, int>, 1: array<int, string>}
     */
    private function resolveIndexesByName(array $headers, array $expectedHeaders, array $optionalHeaders): array
    {
        $byKey = [];

        foreach ($headers as $index => $header) {
            $key = $this->headerKey($header);

            if ($key !== '' && ! isset($byKey[$key])) {
                $byKey[$key] = $index;
            }
        }

        $indexes = [];
        $missing = [];

        foreach ($expectedHeaders as $header) {
            $key = $this->headerKey($header);

            if (! isset($byKey[$key])) {
                $missing[] = $header;
                continue;
            }

            $indexes[$header] = $byKey[$key];
        }

        if ($missing !== []) {
            throw new InvalidArgumentException(
                'La estructura de columnas del archivo no coincide con la esperada. Faltan: '.implode(', ', $missing).'.'
            );
        }

        $present = [];

        foreach ($optionalHeaders as $header) {
            $key = $this->headerKey($header);

            if (isset($byKey[$key])) {
                $indexes[$header] = $byKey[$key];
                $present[] = $header;
            }
        }

        return [$indexes, $present];
    }

    private function headerKey(string $header): string
    {
        $value = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $header) ?? ''));

        return strtr($value, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
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
