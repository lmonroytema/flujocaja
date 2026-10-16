<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiAccessToken;
use App\Models\User;
use App\Services\Auth\SecurityCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function __construct(
        private readonly SecurityCodeService $securityCodeService,
    ) {
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('email', $credentials['email'])
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'message' => 'Credenciales inválidas.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if ($user->must_reset_password) {
            $this->securityCodeService->issuePasswordResetCode($user);

            return response()->json([
                'message' => 'Debes restablecer tu contraseña antes de ingresar por primera vez.',
                'requires_password_reset' => true,
                'email' => $user->email,
            ], Response::HTTP_FORBIDDEN);
        }

        if ($user->two_factor_enabled) {
            $this->securityCodeService->issueTwoFactorCode($user);

            return response()->json([
                'message' => 'Se envió un código de verificación a tu correo corporativo.',
                'requires_two_factor' => true,
                'email' => $user->email,
            ], Response::HTTP_ACCEPTED);
        }

        return response()->json($this->buildLoginResponse($user));
    }

    public function verifyTwoFactor(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'max:12'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user) {
            return response()->json([
                'message' => 'No existe una cuenta asociada a ese correo.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $user->two_factor_enabled) {
            return response()->json([
                'message' => 'La doble autenticación no está activa para este usuario.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $user->two_factor_code || ! hash_equals($user->two_factor_code, strtoupper($data['code']))) {
            return response()->json([
                'message' => 'El código de verificación no es válido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $user->two_factor_code_expires_at || $user->two_factor_code_expires_at->isPast()) {
            return response()->json([
                'message' => 'El código de verificación expiró. Solicita uno nuevo.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $this->securityCodeService->clearTwoFactorCode($user);

        return response()->json($this->buildLoginResponse($user));
    }

    public function requestPasswordReset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user) {
            return response()->json([
                'message' => 'No existe una cuenta asociada a ese correo.',
            ], Response::HTTP_NOT_FOUND);
        }

        $this->securityCodeService->issuePasswordResetCode($user);

        return response()->json([
            'message' => 'Se generó un código de restablecimiento para continuar.',
            'email' => $user->email,
            'expires_at' => optional($user->password_reset_expires_at)?->toIso8601String(),
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'max:12'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user) {
            return response()->json([
                'message' => 'No existe una cuenta asociada a ese correo.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (! $user->password_reset_code || ! hash_equals($user->password_reset_code, strtoupper($data['code']))) {
            return response()->json([
                'message' => 'El código de restablecimiento no es válido.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (! $user->password_reset_expires_at || $user->password_reset_expires_at->isPast()) {
            return response()->json([
                'message' => 'El código de restablecimiento expiró. Solicita uno nuevo.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_reset_password' => false,
            'password_reset_code' => null,
            'password_reset_requested_at' => null,
            'password_reset_expires_at' => null,
        ])->save();

        return response()->json([
            'message' => 'La contraseña se actualizó correctamente. Ya puedes iniciar sesión.',
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $this->serializeUser($request->user()),
        ]);
    }

    public function logout(Request $request)
    {
        /** @var ApiAccessToken|null $accessToken */
        $accessToken = $request->attributes->get('accessToken');

        if ($accessToken) {
            $accessToken->delete();
        }

        return response()->json([
            'message' => 'Sesión cerrada.',
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'profile' => $user->profile,
            'is_admin' => $user->profile === 'admin',
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
        ];
    }

    private function buildLoginResponse(User $user): array
    {
        $plainToken = Str::random(80);

        $token = $user->apiAccessTokens()->create([
            'name' => 'web',
            'token_hash' => hash('sha256', $plainToken),
            'last_used_at' => now(),
        ]);

        return [
            'token' => $plainToken,
            'user' => $this->serializeUser($user),
            'token_id' => $token->id,
        ];
    }
}
