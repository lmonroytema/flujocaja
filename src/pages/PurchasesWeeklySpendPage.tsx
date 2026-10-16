import { useEffect, useMemo, useState } from "react";
import { Filter, RefreshCcw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/utils/api";
import { formatCurrency } from "@/utils/format";

type Category = {
  id: number;
  name: string;
};

type DisplayRow = {
  week_start: string;
  week_end: string;
  project_code: string;
  category: string;
  etapa: string;
  compras: number;
  servicios: number;
  compromiso: number;
  facturado: number;
  pagado: number;
};

type WeeklySpendResponse = {
  display_rows: DisplayRow[];
  spend_summary?: Record<string, number>;
  finance_summary?: Record<string, number>;
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function PurchasesWeeklySpendPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [report, setReport] = useState<WeeklySpendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    return {
      from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      proyectoCodigo: "",
      categoriaId: "",
      etapa: "",
    };
  });

  useEffect(() => {
    api
      .get<{ data: Category[] }>("/integraciones/compras/categorias")
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]));
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      });

      if (filters.proyectoCodigo) {
        params.set("proyecto_codigo", filters.proyectoCodigo);
      }

      if (filters.categoriaId) {
        params.set("categoria_id", filters.categoriaId);
      }

      if (filters.etapa) {
        params.set("etapa", filters.etapa);
      }

      const response = await api.get<WeeklySpendResponse>(`/integraciones/compras/gastos-semanales?${params.toString()}`);
      setReport(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo obtener el reporte semanal.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const totals = useMemo(() => {
    const rows = report?.display_rows ?? [];

    return rows.reduce(
      (accumulator, row) => ({
        compras: accumulator.compras + row.compras,
        servicios: accumulator.servicios + row.servicios,
        compromiso: accumulator.compromiso + row.compromiso,
        facturado: accumulator.facturado + row.facturado,
        pagado: accumulator.pagado + row.pagado,
      }),
      {
        compras: 0,
        servicios: 0,
        compromiso: 0,
        facturado: 0,
        pagado: 0,
      },
    );
  }, [report?.display_rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Integración externa</p>
          <h2 className="mt-2 font-display text-4xl text-white">Gastos semanales de compras</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Consulta el gasto semanal agrupado por proyecto, categoría y etapa financiera usando la API pública de
            Gestión de Compras.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? <Panel className="border-rose-400/30 text-rose-300">{error}</Panel> : null}

      <Panel>
        <div className="flex items-center gap-2 text-white/70">
          <Filter className="h-4 w-4 text-tide-400" />
          Filtros del reporte
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Desde</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Hasta</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Proyecto</span>
            <input
              value={filters.proyectoCodigo}
              onChange={(event) => setFilters((current) => ({ ...current, proyectoCodigo: event.target.value }))}
              placeholder="OC-26-1617 / código"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Categoría</span>
            <select
              value={filters.categoriaId}
              onChange={(event) => setFilters((current) => ({ ...current, categoriaId: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Etapa</span>
            <select
              value={filters.etapa}
              onChange={(event) => setFilters((current) => ({ ...current, etapa: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            >
              <option value="">Todas</option>
              <option value="COMPROMISO">COMPROMISO</option>
              <option value="FACTURADO">FACTURADO</option>
              <option value="PAGADO">PAGADO</option>
            </select>
          </label>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Aplicar filtros
          </button>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Compras</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totals.compras)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Servicios</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totals.servicios)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Compromiso</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totals.compromiso)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Facturado</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totals.facturado)}</p>
        </Panel>
        <Panel>
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Pagado</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(totals.pagado)}</p>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-white/40">
                <th className="px-4 py-3">Semana inicio</th>
                <th className="px-4 py-3">Semana fin</th>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3 text-right">Compras</th>
                <th className="px-4 py-3 text-right">Servicios</th>
                <th className="px-4 py-3 text-right">Compromiso</th>
                <th className="px-4 py-3 text-right">Facturado</th>
                <th className="px-4 py-3 text-right">Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {(report?.display_rows ?? []).map((row, index) => (
                <tr key={`${row.week_start}-${row.week_end}-${row.project_code}-${row.category}-${index}`} className="text-white/75">
                  <td className="px-4 py-3">{row.week_start}</td>
                  <td className="px-4 py-3">{row.week_end}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.project_code}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.etapa || "-"}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.compras)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.servicios)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.compromiso)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.facturado)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.pagado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && (report?.display_rows?.length ?? 0) === 0 ? (
          <div className="border-t border-white/6 px-4 py-8 text-center text-white/50">
            No se encontraron gastos semanales para los filtros seleccionados.
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
