<?php

use App\Http\Controllers\Api\BankAccountController;
use App\Http\Controllers\Api\CashFlowController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExchangeRateController;
use App\Http\Controllers\Api\GestionComprasController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\PurchaseIntegrationConfigController;
use App\Http\Controllers\Api\ProfileSecurityController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/verify-2fa', [AuthController::class, 'verifyTwoFactor']);
Route::post('/auth/password-reset/request', [AuthController::class, 'requestPasswordReset']);
Route::post('/auth/password-reset/confirm', [AuthController::class, 'resetPassword']);

Route::middleware('auth.token')->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/mi-seguridad', [ProfileSecurityController::class, 'show']);
    Route::put('/mi-seguridad/password', [ProfileSecurityController::class, 'updatePassword']);
    Route::put('/mi-seguridad/2fa', [ProfileSecurityController::class, 'updateTwoFactor']);

    Route::get('/dashboard', DashboardController::class);

    Route::get('/importaciones', [ImportController::class, 'history']);
    Route::post('/importaciones/proyectos', [ImportController::class, 'importProjects']);
    Route::post('/importaciones/hitos', [ImportController::class, 'importMilestones']);

    Route::get('/proyectos', [ProjectController::class, 'index']);
    Route::get('/proyectos/{project}', [ProjectController::class, 'show']);

    Route::get('/tipos-cambio', [ExchangeRateController::class, 'index']);
    Route::put('/tipos-cambio/{exchangeRate}', [ExchangeRateController::class, 'update']);

    Route::get('/flujo-caja/resumen', [CashFlowController::class, 'summary']);
    Route::get('/flujo-caja/ingresos', [CashFlowController::class, 'income']);
    Route::get('/flujo-caja/ingresos/exportar', [CashFlowController::class, 'export']);
    Route::get('/flujo-caja/ingresos/semanal', [CashFlowController::class, 'weekly']);
    Route::get('/flujo-caja/ingresos/semanal/exportar', [CashFlowController::class, 'weeklyExport']);

    Route::get('/bancos/cuentas', [BankAccountController::class, 'index']);
    Route::post('/bancos/cuentas', [BankAccountController::class, 'store']);
    Route::put('/bancos/cuentas/{bankAccount}', [BankAccountController::class, 'update']);
    Route::delete('/bancos/cuentas/{bankAccount}', [BankAccountController::class, 'destroy']);
    Route::post('/bancos/cuentas/{bankAccount}/saldos', [BankAccountController::class, 'storeBalance']);
    Route::delete('/bancos/saldos/{bankBalance}', [BankAccountController::class, 'destroyBalance']);

    Route::get('/integraciones/compras/categorias', [GestionComprasController::class, 'categories']);
    Route::get('/integraciones/compras/gastos-semanales', [GestionComprasController::class, 'weeklySpend']);
    Route::get('/integraciones/compras/ordenes/{orderNumber}/finanzas', [GestionComprasController::class, 'orderFinance']);
    Route::post('/integraciones/compras/ordenes/{orderNumber}/facturados', [GestionComprasController::class, 'storeInvoiced']);
    Route::post('/integraciones/compras/ordenes/{orderNumber}/pagados', [GestionComprasController::class, 'storePaid']);
    Route::put('/integraciones/compras/finanzas/{financeId}', [GestionComprasController::class, 'updateFinance']);
    Route::delete('/integraciones/compras/finanzas/{financeId}', [GestionComprasController::class, 'deleteFinance']);

    Route::middleware('admin')->group(function (): void {
        Route::get('/usuarios', [UserManagementController::class, 'index']);
        Route::post('/usuarios', [UserManagementController::class, 'store']);
        Route::put('/usuarios/{user}', [UserManagementController::class, 'update']);
        Route::post('/usuarios/{user}/restablecer-password', [UserManagementController::class, 'triggerPasswordReset']);
        Route::get('/integraciones/compras/configuracion', [PurchaseIntegrationConfigController::class, 'show']);
        Route::put('/integraciones/compras/configuracion', [PurchaseIntegrationConfigController::class, 'update']);
        Route::post('/integraciones/compras/configuracion/probar', [PurchaseIntegrationConfigController::class, 'test']);
    });
});
