<?php
// Crea los usuarios de prueba (uno por perfil) en la BD SQLite del demo.
// Ejecutar con las variables DB_CONNECTION=sqlite y DB_DATABASE=<video-demo/runtime/demo.sqlite>.
require __DIR__ . '/../../backend/vendor/autoload.php';
$app = require __DIR__ . '/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

if (config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'video-demo')) {
    fwrite(STDERR, "Abortado: este script solo corre contra la BD SQLite del demo.\n");
    exit(1);
}

$users = [
    // [nombre, correo, perfil, debe_restablecer, 2FA, clave]
    ['Luis Monroy', 'lmonroy@tema.com.pe', 'admin', false, true, '12345678'],
    ['Diego Directivo (Demo)', 'directivo.demo@flujocaja.test', 'directivo', false, false, 'DemoFlujo2026!'],
    ['Fiorella Finanzas (Demo)', 'finanzas.demo@flujocaja.test', 'finanzas', false, false, 'DemoFlujo2026!'],
    ['Óscar Operaciones (Demo)', 'operaciones.demo@flujocaja.test', 'operaciones', true, false, 'DemoFlujo2026!'],
];

// El admin de prueba anterior ya no se usa: el admin del demo es lmonroy@tema.com.pe.
App\Models\User::query()->where('email', 'admin.demo@flujocaja.test')->delete();

foreach ($users as [$name, $email, $profile, $reset, $twoFactor, $password]) {
    App\Models\User::query()->updateOrCreate(['email' => $email], [
        'name' => $name,
        'profile' => $profile,
        'password' => $password,
        'must_reset_password' => $reset,
        'two_factor_enabled' => $twoFactor,
    ]);
}

echo "Usuarios demo listos: " . App\Models\User::count() . PHP_EOL;
