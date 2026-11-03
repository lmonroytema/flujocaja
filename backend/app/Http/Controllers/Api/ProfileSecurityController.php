<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auth\SecurityCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ProfileSecurityController extends Controller
{
    public function __construct(
        private readonly SecurityCodeService $securityCodeService,
    ) {
    }

    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'profile' => $user->profile,
                'two_factor_enabled' => (bool) $user->two_factor_enabled,
                'must_reset_password' => (bool) $user->must_reset_password,
            ],
        ]);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'message' => 'La contraseña actual no es correcta.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_reset_password' => false,
        ])->save();

        return response()->json([
            'message' => 'La contraseña se actualizó correctamente.',
        ]);
    }

    public function updateTwoFactor(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $user->forceFill([
            'two_factor_enabled' => $data['enabled'],
        ])->save();

        if (! $data['enabled']) {
            $this->securityCodeService->clearTwoFactorCode($user);
        }

        return response()->json([
            'message' => $data['enabled']
                ? 'La doble autenticación por correo quedó activada.'
                : 'La doble autenticación por correo quedó desactivada.',
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
        ]);
    }
}
