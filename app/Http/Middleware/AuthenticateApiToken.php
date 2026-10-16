<?php

namespace App\Http\Middleware;

use App\Models\ApiAccessToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (! $plainToken) {
            return response()->json([
                'message' => 'No autenticado.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $accessToken = ApiAccessToken::query()
            ->with('user')
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if (! $accessToken || ! $accessToken->user) {
            return response()->json([
                'message' => 'Token inválido.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if ($accessToken->expires_at && $accessToken->expires_at->isPast()) {
            $accessToken->delete();

            return response()->json([
                'message' => 'La sesión expiró.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $accessToken->forceFill([
            'last_used_at' => now(),
        ])->save();

        Auth::setUser($accessToken->user);
        $request->setUserResolver(fn () => $accessToken->user);
        $request->attributes->set('accessToken', $accessToken);

        return $next($request);
    }
}
