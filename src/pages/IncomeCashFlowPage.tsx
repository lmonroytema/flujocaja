import { useEffect, useState } from "react";
import { Download, Filter } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { formatCurrency, formatMonthLabel } from "@/utils/format";
import { useCashFlowStore } from "@/store/useCashFlowStore";

type CashFlowReport = {
  anio: number;
  mes: number;
  periodos: Array<{
    id: number;
    etiqueta: string;
    tipoCambioUsd: number;
  }>;
  filas: Array<{
    projectId: number;
    codigoProyecto: string;
    proyecto: string;
    unidadNegocio: string | null;
    cliente: string | null;
    concepto: string;
    totalPen: number;
    hitos: Record<number, { montoPen: number }>;
  }>;
  totalGeneralPen: number;
};

export default function IncomeCashFlowPage() {
  const { year, month, setPeriod } = useCashFlowStore();
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    api
      .get<CashFlowReport>(`/flujo-caja/ingresos?year=${year}&month=${month}`)
      .then(setReport)
      .catch((reason: Error) => setError(reason.message));
  }, [month, year]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Reporte operativo</p>
          <h2 className="mt-2 font-display text-4xl text-white">Flujo de caja de ingresos</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Extracción mensual agrupada por semanas de lunes a viernes, convertida a soles con tipo de cambio por
            período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            Año
            <input
              className="ml-3 w-20 bg-transparent outline-none"
              type="number"
              value={year}
              onChange={(event) => setPeriod(Number(event.target.value), month)}
            />
          </label>
          <label className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            Mes
            <input
              className="ml-3 w-16 bg-transparent outline-none"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setPeriod(year, Number(event.target.value))}
            />
          </label>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/flujo-caja/ingresos/exportar?year=${year}&month=${month}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-3 text-sm text-white transition hover:bg-mint-400/20"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </a>
        </div>
      </div>

      {error ? (
        <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>
      ) : !report ? (
        <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Corte mensual</p>
              <h3 className="mt-2 font-display text-3xl capitalize text-white">{formatMonthLabel(report.mes, report.anio)}</h3>
              <p className="mt-3 text-sm text-white/60">
                Total consolidado del período: <span className="text-white">{formatCurrency(report.totalGeneralPen)}</span>
              </p>
            </Panel>
            <Panel className="xl:min-w-[360px]">
              <div className="flex items-center gap-2 text-white/70">
                <Filter className="h-4 w-4 text-tide-400" />
                Tasas USD por semana
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {report.periodos.map((periodo) => (
                  <div key={periodo.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                    <p className="text-xs text-white/45">{periodo.etiqueta}</p>
                    <p className="mt-1 text-sm text-white">USD {periodo.tipoCambioUsd.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] text-sm">
                <thead>
                  <tr className="text-left text-white/40">
                    <th className="sticky left-0 z-20 bg-ink-900 px-4 py-3">Código</th>
                    <th className="sticky left-[110px] z-20 bg-ink-900 px-4 py-3">Unidad</th>
                    <th className="sticky left-[300px] z-20 bg-ink-900 px-4 py-3">Cliente</th>
                    <th className="sticky left-[540px] z-20 bg-ink-900 px-4 py-3">Concepto</th>
                    {report.periodos.map((periodo) => (
                      <th key={periodo.id} className="px-4 py-3 text-center">
                        {periodo.etiqueta}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {report.filas.map((fila) => (
                    <tr key={fila.projectId} className="text-white/75">
                      <td className="sticky left-0 z-10 bg-ink-900 px-4 py-3 font-medium text-white">
                        {fila.codigoProyecto}
                      </td>
                      <td className="sticky left-[110px] z-10 bg-ink-900 px-4 py-3">{fila.unidadNegocio ?? "-"}</td>
                      <td className="sticky left-[300px] z-10 bg-ink-900 px-4 py-3">{fila.cliente ?? "-"}</td>
                      <td className="sticky left-[540px] z-10 bg-ink-900 px-4 py-3">{fila.concepto}</td>
                      {report.periodos.map((periodo) => (
                        <td key={periodo.id} className="px-4 py-3 text-right">
                          {formatCurrency(fila.hitos[periodo.id]?.montoPen ?? 0)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(fila.totalPen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
