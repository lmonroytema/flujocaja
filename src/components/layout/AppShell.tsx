import { BarChart3, BriefcaseBusiness, CalendarClock, Gauge, Import, Landmark } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { formatMonthLabel } from "@/utils/format";
import { useCashFlowStore } from "@/store/useCashFlowStore";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/importaciones", label: "Importaciones", icon: Import },
  { to: "/proyectos", label: "Proyectos", icon: BriefcaseBusiness },
  { to: "/flujo-caja/ingresos", label: "Flujo de caja", icon: BarChart3 },
  { to: "/configuracion/tipos-cambio", label: "Tipos de cambio", icon: Landmark },
];

export function AppShell() {
  const { month, year } = useCashFlowStore();

  return (
    <div className="min-h-screen bg-[#e9ecef] text-white">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-5">
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="hidden md:block" />
            <img src="/logo-emta.png" alt="EMTA" className="mx-auto h-12 w-auto max-w-full object-contain sm:h-14" />
            <div className="mx-auto flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 md:ml-auto md:mr-0">
              <CalendarClock className="h-4 w-4 text-[#a40f22]" />
              <span className="capitalize">{formatMonthLabel(month, year)}</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-2">
            {links.map(({ to, label, icon: Icon }) => (
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
          <p>Flujo de caja de ingresos para Tema Perú.</p>
          <img src="/logo-tema.png" alt="Tema" className="h-8 w-auto object-contain" />
        </div>
      </footer>
    </div>
  );
}
