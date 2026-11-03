import { useEffect, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CircleDollarSign, ReceiptText, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/utils/api";
import { formatCurrency } from "@/utils/format";
import { Panel } from "@/components/ui/Panel";

type DashboardPayload = {
  kpis: {
    ingresosMesPen: number;
    proyectosConIngreso: number;
    proyectosActivos: number;
    hitosUrgentes: number;
    hitosCobrados: number;
  };
  proximosCobros: Array<{
    id: number;
    projectCode: string;
    projectName: string;
    milestoneName: string;
    status: string;
    alert: string;
    amount: number;
    currencyCode: string;
    baseDate: string;
  }>;
  distribucionPorEstado: Array<{
    milestone_status: string;
    total: number;
  }>;
};

type InsightCardProps = {
  title: string;
  value: string;
  hint: string;
  accent: string;
  icon: typeof CircleDollarSign;
  className?: string;
};

function InsightCard({ title, value, hint, accent, icon: Icon, className }: InsightCardProps) {
  return (
    <div
      className={[
        "rounded-[26px] border border-white/8 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(6,11,18,0.28)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">{title}</p>
          <p className="mt-4 font-display text-3xl text-white">{value}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{hint}</p>
        </div>
        <div className={`rounded-2xl border px-3 py-3 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardPayload>("/dashboard")
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div className="space-y-6">
      {error ? (
        <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>
      ) : !data ? (
        <div className="space-y-6">
          <div className="h-[380px] animate-pulse rounded-[32px] bg-white/[0.05]" />
          <div className="grid gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className={[
                  "h-36 animate-pulse rounded-[28px] bg-white/[0.05]",
                  index === 0 ? "xl:col-span-2" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section
            className="relative overflow-hidden rounded-[32px] border border-white/20 shadow-[0_35px_90px_rgba(6,11,18,0.38)]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(8,16,25,0.34) 0%, rgba(8,16,25,0.18) 42%, rgba(8,16,25,0.24) 100%), url('/portada.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#d8eeeb]/8 via-transparent to-[#7e0618]/18" />
            <div className="relative grid min-h-[420px] gap-6 px-6 py-8 xl:grid-cols-[220px_minmax(0,1fr)_340px] xl:items-center xl:px-8">
              <div className="flex justify-center xl:justify-start">
                <div className="flex h-[170px] w-[190px] items-center justify-center rounded-[28px] border border-white/20 bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_30px_60px_rgba(7,16,25,0.22)] backdrop-blur-md">
                  <span className="font-display text-[7rem] leading-none text-white/92">F</span>
                </div>
              </div>

              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.32em] text-white/72">Tema Perú Financial Platform</p>
                <h2 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.28)]">
                  Gestión de flujo de caja e ingresos
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">
                  Consolida proyectos, hitos de cobro y proyección semanal.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm text-white/86 backdrop-blur-sm">
                    Importación desde Project Hub
                  </span>
                  <span className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm text-white/86 backdrop-blur-sm">
                    Reporte mensual por semanas
                  </span>
                  <span className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm text-white/86 backdrop-blur-sm">
                    Conversión USD a PEN
                  </span>
                </div>
              </div>

              <div className="justify-self-end rounded-[28px] border border-white/45 bg-white/90 p-6 text-slate-900 shadow-[0_28px_60px_rgba(15,23,42,0.24)] backdrop-blur-xl">
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.28em] text-[#8b1d2d]">
                  Resumen del período
                </p>
                <h3 className="mt-3 text-center font-display text-3xl text-slate-900">Ingresos Consolidados</h3>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total consolidado</p>
                    <p className="mt-2 font-display text-3xl text-[#8b1d2d]">{formatCurrency(data.kpis.ingresosMesPen)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">Proyectos</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{data.kpis.proyectosConIngreso}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">Hitos cobrados</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{data.kpis.hitosCobrados}</p>
                    </div>
                  </div>
                  <Link
                    to="/flujo-caja/ingresos"
                    className="block w-full rounded-full bg-[#b30f28] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_35px_rgba(179,15,40,0.24)] transition hover:bg-[#970d22]"
                  >
                    Revisar flujo mensual
                  </Link>
                  <p className="text-center text-sm text-slate-500">
                    Datos consolidados desde proyectos e hitos importados.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-6">
            <InsightCard
              title="Ingresos Consolidados"
              value={formatCurrency(data.kpis.ingresosMesPen)}
              hint="Monto consolidado del reporte mensual en soles."
              icon={CircleDollarSign}
              accent="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              className="xl:col-span-2"
            />
            <InsightCard
              title="Proyectos con ingreso"
              value={String(data.kpis.proyectosConIngreso)}
              hint="Proyectos que aterrizan en el flujo mensual."
              icon={BriefcaseBusiness}
              accent="border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
            />
            <InsightCard
              title="Proyectos activos"
              value={String(data.kpis.proyectosActivos)}
              hint="Oferta, plan o ejecución con seguimiento."
              icon={Wallet}
              accent="border-sky-400/30 bg-sky-400/10 text-sky-300"
            />
            <InsightCard
              title="Hitos urgentes"
              value={String(data.kpis.hitosUrgentes)}
              hint="Alertas marcadas con atención o urgencia."
              icon={AlertTriangle}
              accent="border-amber-400/30 bg-amber-400/10 text-amber-300"
            />
            <InsightCard
              title="Hitos cobrados"
              value={String(data.kpis.hitosCobrados)}
              hint="Registros ya cobrados dentro del maestro."
              icon={ReceiptText}
              accent="border-rose-400/30 bg-rose-400/10 text-rose-300"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel className="bg-white/[0.045]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Próximos cobros</p>
                  <h3 className="mt-2 font-display text-2xl text-white">Pipeline inmediato</h3>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-white/45">
                    <tr>
                      <th className="pb-3">Proyecto</th>
                      <th className="pb-3">Hito</th>
                      <th className="pb-3">Fecha base</th>
                      <th className="pb-3">Estado</th>
                      <th className="pb-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {data.proximosCobros.map((item) => (
                      <tr key={item.id} className="text-white/75">
                        <td className="py-3">
                          <p className="font-medium text-white">{item.projectCode}</p>
                          <p className="text-xs text-white/45">{item.projectName}</p>
                        </td>
                        <td className="py-3">{item.milestoneName}</td>
                        <td className="py-3">{item.baseDate}</td>
                        <td className="py-3">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {item.currencyCode} {item.amount.toLocaleString("es-PE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel className="bg-white/[0.045]">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Distribución</p>
              <h3 className="mt-2 font-display text-2xl text-white">Hitos por estado</h3>

              <div className="mt-6 space-y-4">
                {data.distribucionPorEstado.map((item) => (
                  <div key={item.milestone_status} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/65">{item.milestone_status}</span>
                      <span className="font-display text-2xl text-white">{item.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
