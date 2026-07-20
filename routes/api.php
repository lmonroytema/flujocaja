<?php

use App\Http\Controllers\Api\CashFlowController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExchangeRateController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard', DashboardController::class);

Route::get('/importaciones', [ImportController::class, 'history']);
Route::post('/importaciones/proyectos', [ImportController::class, 'importProjects']);
Route::post('/importaciones/hitos', [ImportController::class, 'importMilestones']);

Route::get('/proyectos', [ProjectController::class, 'index']);
Route::get('/proyectos/{project}', [ProjectController::class, 'show']);

Route::get('/tipos-cambio', [ExchangeRateController::class, 'index']);
Route::put('/tipos-cambio/{exchangeRate}', [ExchangeRateController::class, 'update']);

Route::get('/flujo-caja/ingresos', [CashFlowController::class, 'income']);
Route::get('/flujo-caja/ingresos/exportar', [CashFlowController::class, 'export']);
