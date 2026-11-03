import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  KeyRound,
  Eye,
  EyeOff,
  Landmark,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ApiError, api } from "@/utils/api";

type AccessProfile = {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: typeof ShieldCheck;
};

const profiles: AccessProfile[] = [
  {
    id: "directivo",
    name: "Directivo",
    description: "Seguimiento ejecutivo del flujo, cortes mensuales y alertas clave.",
    badge: "Vista gerencial",
    icon: Landmark,
  },
  {
    id: "finanzas",
    name: "Finanzas",
    description: "Control de ingresos, hitos cobrados, tipos de cambio y conciliación.",
    badge: "Control financiero",
    icon: ShieldCheck,
  },
  {
    id: "operaciones",
    name: "Operaciones",
    description: "Validación de proyectos, clientes, coordinadores y estados operativos.",
    badge: "Gestión operativa",
    icon: BriefcaseBusiness,
  },
];

export default function Home() {
  const { isAuthenticated, login, verifyTwoFactor, loading, user } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState(profiles[1].id);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMessage, setTwoFactorMessage] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirmation, setShowResetPasswordConfirmation] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [requestingReset, setRequestingReset] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfile) ?? profiles[0],
    [selectedProfile],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const response = await login({ email, password });

      if ("requires_two_factor" in response && response.requires_two_factor) {
        const payload = response as {
          requires_two_factor?: boolean;
          email?: string;
          message?: string;
        };

        if (payload.requires_two_factor) {
          setTwoFactorEmail(payload.email ?? email);
          setTwoFactorCode("");
          setTwoFactorError("");
          setTwoFactorMessage(payload.message ?? "Se envió un código de verificación a tu correo.");
          setShowTwoFactorModal(true);
          return;
        }
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) {
        const payload = reason.payload as {
          requires_password_reset?: boolean;
          email?: string;
          message?: string;
        };

        if (payload.requires_password_reset) {
          setResetEmail(payload.email ?? email);
          setResetCode("");
          setResetMessage("Tu cuenta requiere restablecer la contraseña antes del primer acceso.");
          setResetError("");
          setShowResetModal(true);
          return;
        }
      }

      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión. Verifica tu correo y contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    setRequestingReset(true);
    setResetError("");
    setResetMessage("");

    try {
      const response = await api.post<{
        message: string;
        email: string;
      }>("/auth/password-reset/request", {
        email: resetEmail || email,
      });

      setResetEmail(response.email);
      setResetMessage(`Se generó un código de restablecimiento para ${response.email}.`);
    } catch (reason) {
      setResetError(reason instanceof Error ? reason.message : "No se pudo generar el código de restablecimiento.");
    } finally {
      setRequestingReset(false);
    }
  };

  const handleConfirmReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setConfirmingReset(true);
    setResetError("");
    setResetMessage("");

    try {
      const response = await api.post<{ message: string }>("/auth/password-reset/confirm", {
        email: resetEmail,
        code: resetCode,
        password: resetPassword,
        password_confirmation: resetPasswordConfirmation,
      });

      setResetMessage(response.message);
      setShowResetModal(false);
      setPassword("");
      setResetPassword("");
      setResetPasswordConfirmation("");
      setResetCode("");
      setEmail(resetEmail);
      setError("");
    } catch (reason) {
      setResetError(reason instanceof Error ? reason.message : "No se pudo actualizar la contraseña.");
    } finally {
      setConfirmingReset(false);
    }
  };

  const openResetModal = () => {
    setResetEmail(email);
    setResetCode("");
    setResetPassword("");
    setResetPasswordConfirmation("");
    setResetMessage("");
    setResetError("");
    setShowResetPassword(false);
    setShowResetPasswordConfirmation(false);
    setShowResetModal(true);
  };

  const handleVerifyTwoFactor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setVerifyingTwoFactor(true);
    setTwoFactorError("");

    try {
      await verifyTwoFactor({
        email: twoFactorEmail,
        code: twoFactorCode,
      });
      setShowTwoFactorModal(false);
      setTwoFactorCode("");
    } catch (reason) {
      setTwoFactorError(reason instanceof Error ? reason.message : "No se pudo validar el código OTP.");
    } finally {
      setVerifyingTwoFactor(false);
    }
  };

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    // En escritorio (lg+) la portada ocupa exactamente una pantalla: encabezado y pie fijos en alto,
    // el bloque hero llena el espacio intermedio y los tamaños se escalan con el alto disponible (vh).
    // En móvil se mantiene el flujo normal con scroll.
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3 lg:px-6">
          <div className="flex items-center gap-4">
            <img src="/logo-emta.png" alt="EMTA" className="h-10 w-auto object-contain" />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="hidden text-sm text-slate-500 lg:block">
              Plataforma corporativa para autenticación y acceso al flujo de caja.
            </div>
          </div>
          <img src="/logo-tema.png" alt="Tema Perú" className="h-8 w-auto object-contain sm:h-9" />
        </div>
      </header>

      <main className="flex-1 px-4 py-3 sm:px-5 sm:py-4 lg:flex lg:min-h-0 lg:flex-col lg:px-6 lg:py-[clamp(0.75rem,2vh,1.75rem)]">
        <section
          className="mx-auto grid w-full max-w-[1600px] overflow-hidden rounded-[30px] border border-white/50 shadow-[0_30px_90px_rgba(15,23,42,0.18)] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_390px] 2xl:grid-cols-[minmax(0,1.15fr)_440px]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(7,18,28,0.58) 0%, rgba(7,18,28,0.26) 45%, rgba(7,18,28,0.08) 100%), url('/portada.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative flex flex-col justify-between p-5 text-white sm:p-6 lg:min-h-0 lg:p-[clamp(1.25rem,4vh,3.5rem)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-transparent" />

            <div className="relative z-10 grid gap-5 xl:grid-cols-[clamp(170px,24vh,320px)_minmax(0,1fr)] xl:items-center xl:gap-[clamp(1.25rem,3vh,2.5rem)]">
              <div className="flex h-[160px] items-center justify-center rounded-[28px] border border-white/20 bg-white/10 backdrop-blur-md sm:h-[180px] lg:h-[clamp(120px,20vh,260px)] xl:h-[clamp(170px,24vh,320px)]">
                <span className="font-display text-[6rem] leading-none tracking-[-0.08em] text-white/90 sm:text-[7rem] lg:text-[clamp(5rem,13vh,11rem)] xl:text-[clamp(7rem,16vh,13rem)]">
                  F
                </span>
              </div>

              <div className="max-w-3xl 2xl:max-w-5xl">
                <p className="text-xs uppercase tracking-[0.4em] text-white/65 lg:text-[clamp(0.75rem,1.4vh,0.95rem)]">
                  Acceso Corporativo
                </p>
                <h1 className="mt-3 font-display text-3xl leading-tight text-white sm:text-4xl lg:text-[clamp(2rem,5vh,4rem)]">
                  Flujo de Caja Tema Perú
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/80 lg:max-w-3xl lg:text-[clamp(0.95rem,1.9vh,1.35rem)] lg:leading-[1.6]">
                  Gestiona proyectos, hitos de cobro, consolidación de ingresos y validación operativa desde una
                  portada de acceso clara, ejecutiva y profesional.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-white/85 lg:mt-[clamp(1rem,2.4vh,2rem)] lg:text-[clamp(0.85rem,1.5vh,1.05rem)]">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
                    Acceso por perfiles
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
                    Panel ejecutivo
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
                    Operación y finanzas
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 grid gap-3 lg:mt-[clamp(1rem,3vh,2.5rem)] lg:grid-cols-3 lg:gap-[clamp(0.75rem,1.6vh,1.25rem)]">
              {profiles.map((profile) => {
                const Icon = profile.icon;
                const isActive = profile.id === activeProfile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedProfile(profile.id)}
                    className={[
                      "rounded-[24px] border p-4 text-left backdrop-blur-md transition lg:p-[clamp(0.85rem,2vh,1.5rem)]",
                      isActive
                        ? "border-white/40 bg-white/18 shadow-[0_16px_40px_rgba(15,23,42,0.22)]"
                        : "border-white/16 bg-white/8 hover:bg-white/12",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/12">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/75">
                        {profile.badge}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-white lg:mt-[clamp(0.6rem,1.6vh,1.25rem)] lg:text-[clamp(1rem,2vh,1.35rem)]">
                      {profile.name}
                    </h2>
                    <p className="mt-2 text-sm leading-5 text-white/75 lg:text-[clamp(0.8rem,1.5vh,1rem)] lg:leading-[1.45]">
                      {profile.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="flex items-center bg-white/88 p-3 backdrop-blur-xl sm:p-4 lg:min-h-0 lg:p-[clamp(0.75rem,2vh,1.75rem)]">
            <div className="w-full rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-4.5 lg:p-[clamp(1rem,2.6vh,2rem)]">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a40f22] to-[#d31b38] text-white shadow-[0_15px_35px_rgba(164,15,34,0.3)]">
                <UserCog className="h-4 w-4" />
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Iniciar Sesión</p>
                <h2 className="mt-1.5 text-xl font-semibold text-slate-900">Acceso seguro</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ingresa con tu cuenta corporativa autorizada.
                </p>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="correo@empresa.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-[#a40f22] focus:bg-white focus:ring-4 focus:ring-[#a40f22]/10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="password">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Ingresa tu contraseña"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#a40f22] focus:bg-white focus:ring-4 focus:ring-[#a40f22]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#b30f28] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(179,15,40,0.24)] transition hover:bg-[#970d22]"
                >
                  {submitting ? "Validando acceso..." : "Conectar"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex items-center justify-center text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={openResetModal}
                    className="font-medium transition hover:text-[#a40f22]"
                  >
                    Olvidé mi contraseña
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </section>
      </main>

      {showResetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[560px] rounded-[30px] border border-white/60 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.26)] sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#a40f22]/10 text-[#a40f22]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Recuperación de acceso</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Código de restablecimiento</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Solicita tu código y define una nueva contraseña para activar tu primer acceso.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Cuenta a restablecer</p>
              <p className="mt-1">{resetEmail || "Ingresa tu correo corporativo para generar el código."}</p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleConfirmReset}>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="correo@tema.com.pe"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#a40f22] focus:ring-4 focus:ring-[#a40f22]/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="reset-code">
                  Código de restablecimiento
                </label>
                <input
                  id="reset-code"
                  type="text"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.toUpperCase())}
                  placeholder="Introduce el código"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase tracking-[0.2em] text-slate-900 outline-none transition focus:border-[#a40f22] focus:ring-4 focus:ring-[#a40f22]/10"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="reset-password">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={showResetPassword ? "text" : "password"}
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="Nueva contraseña"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#a40f22] focus:ring-4 focus:ring-[#a40f22]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600"
                      aria-label={showResetPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label
                    className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500"
                    htmlFor="reset-password-confirmation"
                  >
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reset-password-confirmation"
                      type={showResetPasswordConfirmation ? "text" : "password"}
                      value={resetPasswordConfirmation}
                      onChange={(event) => setResetPasswordConfirmation(event.target.value)}
                      placeholder="Confirma la contraseña"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#a40f22] focus:ring-4 focus:ring-[#a40f22]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPasswordConfirmation((current) => !current)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600"
                      aria-label={showResetPasswordConfirmation ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showResetPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {resetMessage ? (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {resetMessage}
                </div>
              ) : null}

              {resetError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {resetError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleRequestReset()}
                    disabled={requestingReset}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-70"
                  >
                    {requestingReset ? "Generando..." : "Generar código"}
                  </button>
                  <button
                    type="submit"
                    disabled={confirmingReset}
                    className="inline-flex items-center justify-center rounded-full bg-[#b30f28] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:opacity-70"
                  >
                    {confirmingReset ? "Actualizando..." : "Continuar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showTwoFactorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-[30px] border border-white/60 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.26)] sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#a40f22]/10 text-[#a40f22]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Doble autenticación</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Código OTP por correo</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ingresa el código enviado a tu correo corporativo para completar el acceso seguro.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Correo de verificación</p>
              <p className="mt-1">{twoFactorEmail}</p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleVerifyTwoFactor}>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500" htmlFor="two-factor-code">
                  Código OTP
                </label>
                <input
                  id="two-factor-code"
                  type="text"
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.toUpperCase())}
                  placeholder="Introduce el código"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase tracking-[0.24em] text-slate-900 outline-none transition focus:border-[#a40f22] focus:ring-4 focus:ring-[#a40f22]/10"
                />
              </div>

              {twoFactorMessage ? (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {twoFactorMessage}
                </div>
              ) : null}

              {twoFactorError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {twoFactorError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setShowTwoFactorModal(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={verifyingTwoFactor}
                  className="inline-flex items-center justify-center rounded-full bg-[#b30f28] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:opacity-70"
                >
                  {verifyingTwoFactor ? "Validando..." : "Verificar y continuar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-5 py-3 text-center text-sm text-slate-500 md:flex-row md:text-left lg:px-6">
          <p>
            Flujo de caja Tema Perú, acceso autenticado para finanzas, operaciones y dirección.
            {user ? ` Sesión detectada para ${user.name}.` : ""}
          </p>
          <div className="flex items-center gap-3">
            <img src="/logo-tema.png" alt="Tema" className="h-6 w-auto object-contain" />
            <img src="/logo-emta.png" alt="EMTA corporativo" className="h-6 w-auto object-contain" />
          </div>
        </div>
      </footer>
    </div>
  );
}
