import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, ShieldCheck, UserCog } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/utils/api";
import { useAuth } from "@/auth/AuthContext";

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  profile: string;
  is_admin: boolean;
  two_factor_enabled: boolean;
  must_reset_password: boolean;
};

type UsersResponse = {
  data: ManagedUser[];
};

const profileOptions = [
  { value: "admin", label: "Admin" },
  { value: "directivo", label: "Directivo" },
  { value: "finanzas", label: "Finanzas" },
  { value: "operaciones", label: "Operaciones" },
] as const;

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    profile: "finanzas",
    two_factor_enabled: false,
  });

  const loadUsers = async () => {
    const response = await api.get<UsersResponse>(`/usuarios?search=${encodeURIComponent(search)}`);
    setUsers(response.data);
  };

  useEffect(() => {
    void loadUsers();
  }, [search]);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => Number(right.is_admin) - Number(left.is_admin) || left.name.localeCompare(right.name)),
    [users],
  );

  const handleCreateUser = async () => {
    setMessage("");
    setError("");

    try {
      const response = await api.post<{ message: string }>("/usuarios", form);
      setMessage(response.message);
      setForm({
        name: "",
        email: "",
        profile: "finanzas",
        two_factor_enabled: false,
      });
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el usuario.");
    }
  };

  const handleUpdateUser = async (managedUser: ManagedUser, changes: Partial<ManagedUser>) => {
    setMessage("");
    setError("");

    try {
      const response = await api.put<{ message: string }>(`/usuarios/${managedUser.id}`, {
        name: changes.name ?? managedUser.name,
        email: changes.email ?? managedUser.email,
        profile: changes.profile ?? managedUser.profile,
        two_factor_enabled: changes.two_factor_enabled ?? managedUser.two_factor_enabled,
        must_reset_password: changes.must_reset_password ?? managedUser.must_reset_password,
      });
      setMessage(response.message);
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el usuario.");
    }
  };

  const triggerReset = async (managedUser: ManagedUser) => {
    setMessage("");
    setError("");

    try {
      const response = await api.post<{ message: string }>(`/usuarios/${managedUser.id}/restablecer-password`, {});
      setMessage(`${managedUser.email}: ${response.message}`);
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo enviar el restablecimiento.");
    }
  };

  if (!user?.is_admin) {
    return (
      <Panel className="border-rose-400/30 text-rose-300">
        Solo un usuario con perfil Admin puede gestionar usuarios de la aplicación.
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Administración</p>
        <h2 className="mt-2 font-display text-4xl text-white">Usuarios del sistema</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Crea usuarios, define perfiles, activa doble autenticación por correo y fuerza restablecimiento de
          contraseña.
        </p>
      </div>

      {message ? <Panel className="border-emerald-400/30 text-emerald-300">{message}</Panel> : null}
      {error ? <Panel className="border-rose-400/30 text-rose-300">{error}</Panel> : null}

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Alta rápida</p>
              <h3 className="mt-2 font-display text-2xl text-white">Nuevo usuario</h3>
            </div>
            <Plus className="h-5 w-5 text-mint-400" />
          </div>

          <div className="mt-6 space-y-4">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nombre completo"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="correo@tema.com.pe"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
            <select
              value={form.profile}
              onChange={(event) => setForm((current) => ({ ...current, profile: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            >
              {profileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={form.two_factor_enabled}
                onChange={(event) => setForm((current) => ({ ...current, two_factor_enabled: event.target.checked }))}
              />
              Activar doble autenticación por correo
            </label>

            <button
              type="button"
              onClick={() => void handleCreateUser()}
              className="rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22]"
            >
              Crear usuario
            </button>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Maestro de accesos</p>
              <h3 className="mt-2 font-display text-2xl text-white">Usuarios existentes</h3>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, correo o perfil"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none xl:max-w-xs"
            />
          </div>

          <div className="mt-6 space-y-4">
            {sortedUsers.map((managedUser) => (
              <div key={managedUser.id} className="rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{managedUser.name}</p>
                      {managedUser.is_admin ? (
                        <span className="rounded-full bg-[#a40f22]/15 px-3 py-1 text-xs font-medium text-[#ff9baa]">
                          Admin
                        </span>
                      ) : null}
                      {managedUser.two_factor_enabled ? (
                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                          2FA activo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-white/55">{managedUser.email}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void triggerReset(managedUser)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restablecer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleUpdateUser(managedUser, {
                          two_factor_enabled: !managedUser.two_factor_enabled,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {managedUser.two_factor_enabled ? "Desactivar 2FA" : "Activar 2FA"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                  <input
                    defaultValue={managedUser.name}
                    onBlur={(event) => {
                      if (event.target.value !== managedUser.name) {
                        void handleUpdateUser(managedUser, { name: event.target.value });
                      }
                    }}
                    className="rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                  />
                  <select
                    defaultValue={managedUser.profile}
                    onChange={(event) => void handleUpdateUser(managedUser, { profile: event.target.value })}
                    className="rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                  >
                    {profileOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
                    <input
                      type="checkbox"
                      checked={managedUser.must_reset_password}
                      onChange={(event) =>
                        void handleUpdateUser(managedUser, {
                          must_reset_password: event.target.checked,
                        })
                      }
                    />
                    Requiere primer acceso
                  </label>
                </div>
              </div>
            ))}

            {sortedUsers.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-white/10 p-8 text-center text-white/50">
                No hay usuarios que coincidan con el filtro actual.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
