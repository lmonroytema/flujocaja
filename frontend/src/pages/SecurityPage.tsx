import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/utils/api";

type SecurityPayload = {
  user: {
    id: number;
    name: string;
    email: string;
    profile: string;
    two_factor_enabled: boolean;
    must_reset_password: boolean;
  };
};

export default function SecurityPage() {
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);

  useEffect(() => {
    api.get<SecurityPayload>("/mi-seguridad").then(setData).catch(() => setData(null));
  }, []);

  const refresh = async () => {
    const response = await api.get<SecurityPayload>("/mi-seguridad");
    setData(response);
  };

  const handlePasswordUpdate = async () => {
    setSavingPassword(true);
    setMessage("");
    setError("");

    try {
      const response = await api.put<{ message: string }>("/mi-seguridad/password", {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setMessage(response.message);
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleTwoFactor = async (enabled: boolean) => {
    setSavingTwoFactor(true);
    setMessage("");
    setError("");

    try {
      const response = await api.put<{ message: string; two_factor_enabled: boolean }>("/mi-seguridad/2fa", {
        enabled,
      });
      setMessage(response.message);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la doble autenticación.");
    } finally {
      setSavingTwoFactor(false);
    }
  };

  if (!data) {
    return <div className="h-72 animate-pulse rounded-[28px] bg-white/[0.05]" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Seguridad</p>
        <h2 className="mt-2 font-display text-4xl text-white">Mi seguridad</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Administra tu contraseña y define si deseas proteger tu acceso con doble autenticación por correo.
        </p>
      </div>

      {message ? <Panel className="border-emerald-400/30 text-emerald-300">{message}</Panel> : null}
      {error ? <Panel className="border-rose-400/30 text-rose-300">{error}</Panel> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Contraseña</p>
              <h3 className="mt-2 font-display text-2xl text-white">Cambio de contraseña</h3>
            </div>
            <LockKeyhole className="h-5 w-5 text-mint-400" />
          </div>

          <div className="mt-6 space-y-4">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Contraseña actual"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Confirmar nueva contraseña"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void handlePasswordUpdate()}
              disabled={savingPassword}
              className="rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:opacity-70"
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Doble autenticación</p>
              <h3 className="mt-2 font-display text-2xl text-white">Verificación por correo</h3>
            </div>
            <ShieldCheck className="h-5 w-5 text-tide-400" />
          </div>

          <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm text-white/65">Estado actual</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {data.user.two_factor_enabled ? "Activada" : "Desactivada"}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Cuando está activa, el sistema enviará un código OTP al correo del usuario en cada inicio de sesión.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleToggleTwoFactor(true)}
                disabled={savingTwoFactor || data.user.two_factor_enabled}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-white transition disabled:opacity-50"
              >
                Activar
              </button>
              <button
                type="button"
                onClick={() => void handleToggleTwoFactor(false)}
                disabled={savingTwoFactor || !data.user.two_factor_enabled}
                className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white transition disabled:opacity-50"
              >
                Desactivar
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
