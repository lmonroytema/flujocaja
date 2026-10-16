import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e9ecef] px-6">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Autenticación</p>
          <h1 className="mt-4 font-display text-4xl text-slate-900">Validando sesión</h1>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            Estamos verificando tu acceso para abrir el panel corporativo de flujo de caja.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
