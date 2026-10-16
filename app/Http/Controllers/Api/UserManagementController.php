<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\SecurityCodeService;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    public function __construct(
        private readonly SecurityCodeService $securityCodeService,
    ) {
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($builder) use ($search) {
                    $builder
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('profile', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->serializeUser($user))
            ->values();

        return response()->json([
            'data' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'profile' => ['required', 'in:admin,directivo,finanzas,operaciones'],
            'two_factor_enabled' => ['required', 'boolean'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'profile' => $data['profile'],
            'password' => 'Temporal2026!',
            'must_reset_password' => true,
            'two_factor_enabled' => $data['two_factor_enabled'],
        ]);

        $this->securityCodeService->issuePasswordResetCode($user);

        return response()->json([
            'message' => 'Usuario creado y notificado para su primer acceso.',
            'user' => $this->serializeUser($user->fresh()),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'profile' => ['required', 'in:admin,directivo,finanzas,operaciones'],
            'two_factor_enabled' => ['required', 'boolean'],
            'must_reset_password' => ['required', 'boolean'],
        ]);

        $user->update($data);

        if (! $data['two_factor_enabled']) {
            $this->securityCodeService->clearTwoFactorCode($user);
        }

        return response()->json([
            'message' => 'Usuario actualizado correctamente.',
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    public function triggerPasswordReset(User $user)
    {
        $this->securityCodeService->issuePasswordResetCode($user);

        $user->forceFill([
            'must_reset_password' => true,
        ])->save();

        return response()->json([
            'message' => 'Se envió un nuevo restablecimiento de contraseña al usuario.',
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'profile' => $user->profile,
            'is_admin' => $user->isAdmin(),
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
            'must_reset_password' => (bool) $user->must_reset_password,
        ];
    }
}
