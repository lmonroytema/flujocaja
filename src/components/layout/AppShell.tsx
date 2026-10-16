import { BarChart3, BriefcaseBusiness, Banknote, CalendarClock, FileText, Gauge, Import, Landmark, LogOut, PlugZap, ShieldCheck, UserRound, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { formatMonthLabel } from "@/utils/format";
import { useCashFlowStore } from "@/store/useCashFlowStore";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/importaciones", label: "Importaciones", icon: Import },
  { to: "/proyectos", label: "Proyectos", icon: BriefcaseBusiness },
  { to: "/flujo-caja/ingresos", label: "Flujo de caja", icon: BarChart3 },
  { to: "/configuracion/saldos-bancos", label: "Saldos bancos", icon: Banknote },
  { to: "/configuracion/tipos-cambio", label: "Tipos de cambio", icon: Landmark },
  { to: "/integraciones/compras/gastos-semanales", label: "Gastos compras", icon: BarChart3 },
  { to: "/integraciones/compras/ordenes", label: "Finanzas órdenes", icon: FileText },
  { to: "/integraciones/compras/configuracion", label: "API compras", icon: PlugZap, adminOnly: true },
  { to: "/mi-seguridad", label: "Mi seguridad", icon: ShieldCheck },
  { to: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];

export function AppShell() {
  const { month, year } = useCashFlowStore();
  const { user, logout } = useAuth();
  const visibleLinks = links.filter((link) => !link.adminOnly || user?.is_admin);

  return (
    <div className="min-h-screen bg-[#e9ecef] text-white">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-5">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="hidden items-center gap-3 md:flex">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs uppercase tracking-[0.22em] text-slate-400">{user?.profile}</p>
              </div>
            </div>
            <img src="/logo-emta.png" alt="EMTA" className="mx-auto h-12 w-auto max-w-full object-contain sm:h-14" />
            <div className="mx-auto flex flex-wrap items-center justify-center gap-3 md:ml-auto md:mr-0 md:justify-end">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                <CalendarClock className="h-4 w-4 text-[#a40f22]" />
                <span className="capitalize">{formatMonthLabel(month, year)}</span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2">
            {visibleLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                    isActive
                      ? "border-[#a40f22]/15 bg-[#a40f22] text-white shadow-[0_10px_30px_rgba(164,15,34,0.18)]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <main className="rounded-[34px] border border-white/30 bg-gradient-to-br from-[#081019] via-[#0c1624] to-[#111f2f] p-6 shadow-[0_35px_90px_rgba(15,23,42,0.22)]">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-6 py-4 text-center text-sm text-slate-500 md:flex-row md:text-left">
          <p>Flujo de caja para Tema Perú.</p>
          <img src="/logo-tema.png" alt="Tema" className="h-8 w-auto object-contain" />
        </div>
      </footer>
    </div>
  );
}
