<?php

namespace App\Services\Auth;

use App\Mail\SecurityCodeMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SecurityCodeService
{
    public function issuePasswordResetCode(User $user): string
    {
        $code = strtoupper(Str::random(6));

        $user->forceFill([
            'password_reset_code' => $code,
            'password_reset_requested_at' => now(),
            'password_reset_expires_at' => now()->addMinutes(30),
        ])->save();

        Mail::to($user->email)->send(new SecurityCodeMail(
            subjectLine: 'Restablecimiento de contraseña',
            headline: 'Código de restablecimiento',
            intro: 'Recibimos una solicitud para actualizar la contraseña de tu cuenta en Flujo de Caja Tema Perú.',
            code: $code,
            footer: 'Este código vence en 30 minutos. Si no solicitaste este cambio, ignora este correo.',
        ));

        return $code;
    }

    public function issueTwoFactorCode(User $user): string
    {
        $code = strtoupper(Str::random(6));

        $user->forceFill([
            'two_factor_code' => $code,
            'two_factor_code_requested_at' => now(),
            'two_factor_code_expires_at' => now()->addMinutes(10),
        ])->save();

        Mail::to($user->email)->send(new SecurityCodeMail(
            subjectLine: 'Código de verificación de acceso',
            headline: 'Código de doble autenticación',
            intro: 'Usa este código para completar el acceso seguro a la plataforma Flujo de Caja Tema Perú.',
            code: $code,
            footer: 'Este código vence en 10 minutos y solo puede utilizarse una vez.',
        ));

        return $code;
    }

    public function clearTwoFactorCode(User $user): void
    {
        $user->forceFill([
            'two_factor_code' => null,
            'two_factor_code_requested_at' => null,
            'two_factor_code_expires_at' => null,
        ])->save();
    }
}
