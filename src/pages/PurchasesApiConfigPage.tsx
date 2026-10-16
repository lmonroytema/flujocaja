import { useEffect, useState } from "react";
import { CheckCircle2, PlugZap, Save, ShieldAlert } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/utils/api";
import { useAuth } from "@/auth/AuthContext";

type PurchasesApiConfig = {
  base_url: string;
  has_token: boolean;
  connection_status: string | null;
  connection_message: string | null;
  last_checked_at: string | null;
};

export default function PurchasesApiConfigPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<PurchasesApiConfig | null>(null);
  const [form, setForm] = useState({
    baseUrl: "",
    publicToken: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      const response = await api.get<PurchasesApiConfig>("/integraciones/compras/configuracion");
      setConfig(response);
      setForm((current) => ({
        ...current,
        baseUrl: response.base_url ?? "",
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer la configuración.");
    }
  };

  useEffect(() => {
    if (user?.is_admin) {
      void loadConfig();
    }
  }, [user?.is_admin]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.put<{ message: string; config: PurchasesApiConfig }>("/integraciones/compras/configuracion", {
        base_url: form.baseUrl,
        public_token: form.publicToken,
      });

      setConfig(response.config);
      setMessage(response.message);
      setForm((current) => ({ ...current, publicToken: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError("");
    setMessage("");

    try {
      // Sin token nuevo y con la misma Base URL se prueba la configuración guardada.
      const usesStoredConfig =
        !form.publicToken.trim() &&
        Boolean(config?.has_token) &&
        form.baseUrl.trim().replace(/\/+$/, "") === (config?.base_url ?? "");
      const response = await api.post<{ message: string; config: PurchasesApiConfig }>(
        "/integraciones/compras/configuracion/probar",
        usesStoredConfig ? {} : { base_url: form.baseUrl, public_token: form.publicToken },
      );

      setConfig(response.config);
      setMessage(response.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo validar la conexión.");
    } finally {
      setTesting(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <Panel className="border-rose-400/30 text-rose-300">
        Solo un usuario Admin puede configurar la integración con Gestión de Compras.
      </Panel>
    );
  }

  const isConnected = config?.connection_status === "valid";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Integración externa</p>
        <h2 className="mt-2 font-display text-4xl text-white">Configuración API Compras</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Registra la base URL y el Public Token de <span className="text-white">gestión-compras</span> para habilitar
          consultas y mantenimiento financiero desde esta aplicación.
        </p>
      </div>

      {message ? <Panel className="border-emerald-400/30 text-emerald-300">{message}</Panel> : null}
      {error ? <Panel className="border-rose-400/30 text-rose-300">{error}</Panel> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Acceso técnico</p>
              <h3 className="mt-2 font-display text-2xl text-white">Datos de conexión</h3>
            </div>
            <PlugZap className="h-5 w-5 text-mint-400" />
          </div>

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-white/45">Base URL API</span>
              <input
                value={form.baseUrl}
                onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="https://gcs.temalitoclean.com/api"
                className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-white/45">Public Token</span>
              <input
                type="password"
                value={form.publicToken}
                onChange={(event) => setForm((current) => ({ ...current, publicToken: event.target.value }))}
                placeholder={config?.has_token ? "Token ya registrado. Ingresa uno nuevo solo si deseas reemplazarlo." : "Ingresa el token público"}
                className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "Probando..." : "Probar conexión"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </Panel>

        <Panel>
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">Estado de conexión</p>
          <div className="mt-5 rounded-[26px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-300" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-amber-300" />
              )}
              <div>
                <p className="text-lg font-semibold text-white">{isConnected ? "Conectado" : "Pendiente de validación"}</p>
                <p className="text-sm text-white/55">{config?.connection_message ?? "Aún no se ha validado la integración."}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-white/65">
              <div className="rounded-2xl border border-white/8 bg-ink-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Base registrada</p>
                <p className="mt-2 break-all text-white">{config?.base_url || "Sin configurar"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-ink-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Token</p>
                <p className="mt-2 text-white">{config?.has_token ? "Token almacenado de forma segura" : "Sin token registrado"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-ink-900/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Última validación</p>
                <p className="mt-2 text-white">{config?.last_checked_at ? new Date(config.last_checked_at).toLocaleString("es-PE") : "Sin registros"}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
