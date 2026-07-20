<?php

use App\Models\ExchangeRate;
use App\Models\ImportBatch;
use App\Models\PaymentMilestone;
use App\Models\Project;
use App\Services\Imports\PaymentMilestoneImportService;
use App\Services\Imports\ProjectImportService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

DB::statement('SET FOREIGN_KEY_CHECKS=0');
ExchangeRate::truncate();
PaymentMilestone::truncate();
Project::truncate();
ImportBatch::truncate();
DB::statement('SET FOREIGN_KEY_CHECKS=1');

app(ProjectImportService::class)->import(
    realpath(__DIR__.'/../../Importaciones/SP Proyectos Producción 06-07-2026 7-21-18.xlsx'),
    'SP Proyectos Producción 06-07-2026 7-21-18.xlsx',
);

app(PaymentMilestoneImportService::class)->import(
    realpath(__DIR__.'/../../Importaciones/Hito de pago de proyectos 06-07-2026 7-21-42.xlsx'),
    'Hito de pago de proyectos 06-07-2026 7-21-42.xlsx',
);

echo "Datos de muestra importados.\n";
