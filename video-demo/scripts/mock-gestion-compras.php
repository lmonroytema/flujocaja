<?php
// API simulada de "Gestión de Compras" SOLO para el video demostrativo local.
// Uso: php -S 127.0.0.1:8020 mock-gestion-compras.php
header('Content-Type: application/json; charset=utf-8');

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
$stateFile = __DIR__ . '/../runtime/mock-compras-state.json';

if (($_SERVER['HTTP_X_PUBLIC_TOKEN'] ?? '') === '') {
    http_response_code(401);
    echo json_encode(['message' => 'Token requerido']);
    return;
}

function state(string $file): array
{
    if (is_file($file)) {
        return json_decode(file_get_contents($file), true);
    }
    return ['next_id' => 10, 'orders' => [
        'OC-26-1617' => [
            'monto' => 18500.00,
            'rows' => [
                ['id' => 1, 'etapa' => 'COMPROMISO', 'fecha' => '2026-09-15', 'importe' => 18500.00, 'descripcion' => 'Orden de compra equipos de monitoreo', 'numero_factura' => null],
                ['id' => 2, 'etapa' => 'FACTURADO', 'fecha' => '2026-09-30', 'importe' => 9250.00, 'numero_factura' => 'F002-004581', 'descripcion' => null],
                ['id' => 3, 'etapa' => 'PAGADO', 'fecha' => '2026-10-07', 'importe' => 9250.00, 'numero_factura' => null, 'descripcion' => null],
            ],
        ],
    ]];
}

function save(string $file, array $s): void
{
    file_put_contents($file, json_encode($s, JSON_PRETTY_PRINT));
}

function summary(array $order): array
{
    $sum = fn ($etapa) => array_sum(array_map(fn ($r) => $r['importe'], array_filter($order['rows'], fn ($r) => $r['etapa'] === $etapa)));
    $c = $sum('COMPROMISO');
    $f = $sum('FACTURADO');
    $p = $sum('PAGADO');
    $by = fn ($etapa) => array_values(array_filter($order['rows'], fn ($r) => $r['etapa'] === $etapa));
    return [
        'compromisos' => $by('COMPROMISO'),
        'facturados' => $by('FACTURADO'),
        'pagados' => $by('PAGADO'),
        'summary' => [
            'comprometido' => $c, 'facturado' => $f, 'pagado' => $p,
            'saldo_por_facturar' => $c - $f, 'saldo_por_pagar' => $f - $p,
        ],
    ];
}

$s = state($stateFile);

if ($path === '/public/categorias') {
    echo json_encode([
        ['id' => 1, 'nombre' => 'Equipos de laboratorio'],
        ['id' => 2, 'nombre' => 'Servicios de transporte'],
        ['id' => 3, 'nombre' => 'Consumibles de campo'],
        ['id' => 4, 'nombre' => 'Subcontratos técnicos'],
    ]);
    return;
}

if ($path === '/public/reports/spend-by-week-category') {
    $from = new DateTime($_GET['from'] ?? '2026-10-01');
    $to = new DateTime($_GET['to'] ?? '2026-10-31');
    $weeks = [];
    $d = (clone $from)->modify('monday this week');
    while ($d <= $to) {
        $end = (clone $d)->modify('+6 days');
        $weeks[] = ['key' => $d->format('Y-m-d'), 'start' => $d->format('Y-m-d'), 'end' => $end->format('Y-m-d')];
        $d->modify('+7 days');
    }
    mt_srand(7);
    $cats = ['Equipos de laboratorio', 'Servicios de transporte', 'Consumibles de campo', 'Subcontratos técnicos'];
    $projects = ['70101', '70104', '70107', '70112'];
    $spend = [];
    $finance = [];
    foreach ($projects as $i => $p) {
        $cat = $cats[$i % 4];
        $tipo = str_contains($cat, 'Serv') || str_contains($cat, 'Subcon') ? 'SERVICIO' : 'COMPRA';
        $w = [];
        $fw = ['COMPROMISO' => [], 'FACTURADO' => [], 'PAGADO' => []];
        foreach ($weeks as $wk) {
            if (mt_rand(0, 3) === 0) continue;
            $amt = mt_rand(8, 60) * 100;
            $w[$wk['key']] = $amt;
            $fw['COMPROMISO'][$wk['key']] = $amt;
            if (mt_rand(0, 1)) $fw['FACTURADO'][$wk['key']] = round($amt * 0.6);
            if (mt_rand(0, 2) === 0) $fw['PAGADO'][$wk['key']] = round($amt * 0.4);
        }
        $spend[] = ['proyecto_codigo' => $p, 'categoria' => $cat, 'tipo' => $tipo, 'weeks' => $w];
        foreach ($fw as $etapa => $vals) {
            if ($vals) $finance[] = ['proyecto_codigo' => $p, 'categoria' => $cat, 'etapa' => $etapa, 'weeks' => $vals];
        }
    }
    if (!empty($_GET['etapa'])) {
        $finance = array_values(array_filter($finance, fn ($r) => $r['etapa'] === $_GET['etapa']));
    }
    if (!empty($_GET['proyecto_codigo'])) {
        $f = fn ($r) => $r['proyecto_codigo'] === $_GET['proyecto_codigo'];
        $spend = array_values(array_filter($spend, $f));
        $finance = array_values(array_filter($finance, $f));
    }
    $total = fn ($rows) => array_sum(array_map(fn ($r) => array_sum($r['weeks']), $rows));
    echo json_encode([
        'spend_rows' => $spend, 'spend_weeks' => $weeks,
        'finance_rows' => $finance, 'finance_weeks' => $weeks,
        'spend_summary' => ['total' => $total($spend)],
        'finance_summary' => ['total' => $total($finance)],
    ]);
    return;
}

if (preg_match('#^/public/orders/([^/]+)/finanzas$#', $path, $m) && $method === 'GET') {
    $o = urldecode($m[1]);
    if (!isset($s['orders'][$o])) {
        http_response_code(404);
        echo json_encode(['message' => 'Orden no encontrada']);
        return;
    }
    echo json_encode(summary($s['orders'][$o]));
    return;
}

if (preg_match('#^/public/orders/([^/]+)/finanzas/(facturados|pagados)$#', $path, $m) && $method === 'POST') {
    $o = urldecode($m[1]);
    $s['orders'][$o]['rows'][] = [
        'id' => $s['next_id']++, 'etapa' => $m[2] === 'facturados' ? 'FACTURADO' : 'PAGADO',
        'fecha' => $body['fecha'] ?? null, 'importe' => (float) ($body['importe'] ?? 0),
        'numero_factura' => $body['numero_factura'] ?? null, 'descripcion' => null,
    ];
    save($stateFile, $s);
    echo json_encode(['message' => 'Registrado', 'data' => summary($s['orders'][$o])]);
    return;
}

if (preg_match('#^/public/orders/finanzas/(\d+)$#', $path, $m)) {
    foreach ($s['orders'] as $k => $order) {
        foreach ($order['rows'] as $i => $row) {
            if ((string) $row['id'] === $m[1]) {
                if ($method === 'DELETE') {
                    array_splice($s['orders'][$k]['rows'], $i, 1);
                } else {
                    $s['orders'][$k]['rows'][$i] = array_merge($row, array_intersect_key($body, array_flip(['fecha', 'importe', 'numero_factura'])));
                }
                save($stateFile, $s);
                echo json_encode(['message' => 'OK']);
                return;
            }
        }
    }
    http_response_code(404);
    echo json_encode(['message' => 'Registro no encontrado']);
    return;
}

http_response_code(404);
echo json_encode(['message' => 'Ruta no encontrada en la API simulada']);
