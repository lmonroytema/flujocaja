import { useEffect, useMemo, useState } from "react";
import { Download, Filter, RotateCcw } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { DataPagination, type PaginationMeta } from "@/components/ui/DataPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatMonthLabel } from "@/utils/format";
import { useCashFlowStore } from "@/store/useCashFlowStore";

type CashFlowRow = {
  projectId: number;
  codigoProyecto: string;
  proyecto: string;
  unidadNegocio: string | null;
  cliente: string | null;
  concepto: string;
  totalPen: number;
  hitos: Record<number, { montoPen: number }>;
};

type CashFlowFilters = {
  code: string;
  project: string;
  client: string;
  businessUnit: string;
  concept: string;
};

type CashFlowReport = {
  anio: number;
  mes: number;
  periodos: Array<{
    id: number;
    etiqueta: string;
    tipoCambioUsd: number;
  }>;
  filas: CashFlowRow[];
  meta: PaginationMeta;
  filterOptions: {
    businessUnits: string[];
    clients: string[];
    concepts: string[];
  };
  totalGeneralPen: number;
  totalGeneralPenOriginal: number;
  totalFiltradoPen: number;
  totalFilas: number;
};

const initialFilters: CashFlowFilters = {
  code: "",
  project: "",
  client: "",
  businessUnit: "",
  concept: "",
};

export default function IncomeCashFlowPage() {
  const { year, month, setPeriod } = useCashFlowStore();
  const [filters, setFilters] = useState<CashFlowFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedFilters = useDebouncedValue(filters, 350);

  useEffect(() => {
    let cancelled = false;
    const params = buildCashFlowQuery({
      year,
      month,
      page,
      perPage,
      filters: debouncedFilters,
      withPagination: true,
    });

    setLoading(true);
    setError("");

    api
      .get<CashFlowReport>(`/flujo-caja/ingresos?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setReport(result);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, month, page, perPage, year]);

  const exportQuery = useMemo(
    () =>
      buildCashFlowQuery({
        year,
        month,
        page,
        perPage,
        filters,
        withPagination: false,
      }).toString(),
    [filters, month, page, perPage, year],
  );

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = <K extends keyof CashFlowFilters>(key: K, value: CashFlowFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

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
              onChange={(event) => {
                setPage(1);
                setPeriod(Number(event.target.value), month);
              }}
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
              onChange={(event) => {
                setPage(1);
                setPeriod(year, Number(event.target.value));
              }}
            />
          </label>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/flujo-caja/ingresos/exportar?${exportQuery}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-3 text-sm text-white transition hover:bg-mint-400/20"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </a>
        </div>
      </div>

      {error ? (
        <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>
      ) : loading && !report ? (
        <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Corte mensual</p>
              <h3 className="mt-2 font-display text-3xl capitalize text-white">{formatMonthLabel(report!.mes, report!.anio)}</h3>
              <p className="mt-3 text-sm text-white/60">
                Total del mes: <span className="text-white">{formatCurrency(report!.totalGeneralPenOriginal)}</span>
              </p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Resultado filtrado</p>
              <h3 className="mt-2 font-display text-3xl text-white">{formatCurrency(report!.totalFiltradoPen)}</h3>
              <p className="mt-3 text-sm text-white/60">
                Filas encontradas: <span className="text-white">{report!.totalFilas}</span>
              </p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Filtros activos</p>
              <h3 className="mt-2 font-display text-3xl text-white">{activeFilters}</h3>
              <p className="mt-3 text-sm text-white/60">
                Página actual: <span className="text-white">{report!.meta.current_page}</span> de{" "}
                <span className="text-white">{report!.meta.last_page}</span>
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <Panel>
              <div className="flex flex-wrap items-center gap-3 text-white/70">
                <Filter className="h-4 w-4 text-tide-400" />
                Filtros independientes por columna y navegación paginada.
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                  onClick={clearFilters}
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpiar filtros
                </button>
              </div>
            </Panel>
            <Panel className="xl:min-w-[360px]">
              <div className="flex items-center gap-2 text-white/70">
                <Filter className="h-4 w-4 text-tide-400" />
                Tasas USD por semana
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {report!.periodos.map((periodo) => (
                  <div key={periodo.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                    <p className="text-xs text-white/45">{periodo.etiqueta}</p>
                    <p className="mt-1 text-sm text-white">USD {periodo.tipoCambioUsd.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel className="space-y-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1750px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.22em] text-white/40">
                    <th className="sticky left-0 z-20 w-[110px] bg-ink-900 px-4 py-3">Código</th>
                    <th className="sticky left-[110px] z-20 w-[260px] bg-ink-900 px-4 py-3">Proyecto</th>
                    <th className="sticky left-[370px] z-20 w-[180px] bg-ink-900 px-4 py-3">Unidad</th>
                    <th className="sticky left-[550px] z-20 w-[240px] bg-ink-900 px-4 py-3">Cliente</th>
                    <th className="sticky left-[790px] z-20 w-[220px] bg-ink-900 px-4 py-3">Concepto</th>
                    {report!.periodos.map((periodo) => (
                      <th key={periodo.id} className="px-4 py-3 text-center">
                        {periodo.etiqueta}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                  <tr className="border-b border-white/8 text-left text-white/60">
                    <th className="sticky left-0 z-20 bg-ink-900 px-4 pb-4">
                      <FilterInput
                        value={filters.code}
                        placeholder="Código"
                        onChange={(value) => handleFilterChange("code", value)}
                      />
                    </th>
                    <th className="sticky left-[110px] z-20 bg-ink-900 px-4 pb-4">
                      <FilterInput
                        value={filters.project}
                        placeholder="Proyecto"
                        onChange={(value) => handleFilterChange("project", value)}
                      />
                    </th>
                    <th className="sticky left-[370px] z-20 bg-ink-900 px-4 pb-4">
                      <FilterSelect
                        value={filters.businessUnit}
                        placeholder="Todas"
                        options={report!.filterOptions.businessUnits}
                        onChange={(value) => handleFilterChange("businessUnit", value)}
                      />
                    </th>
                    <th className="sticky left-[550px] z-20 bg-ink-900 px-4 pb-4">
                      <FilterInput
                        value={filters.client}
                        placeholder="Cliente"
                        onChange={(value) => handleFilterChange("client", value)}
                      />
                    </th>
                    <th className="sticky left-[790px] z-20 bg-ink-900 px-4 pb-4">
                      <FilterSelect
                        value={filters.concept}
                        placeholder="Todos"
                        options={report!.filterOptions.concepts}
                        onChange={(value) => handleFilterChange("concept", value)}
                      />
                    </th>
                    {report!.periodos.map((periodo) => (
                      <th key={`filter-${periodo.id}`} className="bg-ink-900 px-4 pb-4" />
                    ))}
                    <th className="bg-ink-900 px-4 pb-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {report!.filas.length ? (
                    report!.filas.map((fila) => (
                      <tr key={fila.projectId} className="text-white/75 transition hover:bg-white/[0.03]">
                        <td className="sticky left-0 z-10 bg-ink-900 px-4 py-3 font-medium text-white">
                          {fila.codigoProyecto}
                        </td>
                        <td className="sticky left-[110px] z-10 bg-ink-900 px-4 py-3">{fila.proyecto}</td>
                        <td className="sticky left-[370px] z-10 bg-ink-900 px-4 py-3">{fila.unidadNegocio ?? "-"}</td>
                        <td className="sticky left-[550px] z-10 bg-ink-900 px-4 py-3">{fila.cliente ?? "-"}</td>
                        <td className="sticky left-[790px] z-10 bg-ink-900 px-4 py-3">{fila.concepto}</td>
                        {report!.periodos.map((periodo) => (
                          <td key={periodo.id} className="px-4 py-3 text-right">
                            {formatCurrency(fila.hitos[periodo.id]?.montoPen ?? 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-medium text-white">
                          {formatCurrency(fila.totalPen)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={report!.periodos.length + 6} className="py-10 text-center text-white/45">
                        No existen filas para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <DataPagination
              meta={report!.meta}
              onPageChange={setPage}
              onPerPageChange={(value) => {
                setPerPage(value);
                setPage(1);
              }}
            />
          </Panel>
        </>
      )}
    </div>
  );
}

function buildCashFlowQuery({
  year,
  month,
  page,
  perPage,
  filters,
  withPagination,
}: {
  year: number;
  month: number;
  page: number;
  perPage: number;
  filters: CashFlowFilters;
  withPagination: boolean;
}) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });

  if (withPagination) {
    params.set("page", String(page));
    params.set("per_page", String(perPage));
  }

  if (filters.code) params.set("code", filters.code);
  if (filters.project) params.set("project", filters.project);
  if (filters.client) params.set("client", filters.client);
  if (filters.businessUnit) params.set("business_unit", filters.businessUnit);
  if (filters.concept) params.set("concept", filters.concept);

  return params;
}

type FilterInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function FilterInput({ value, placeholder, onChange }: FilterInputProps) {
  return (
    <input
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type FilterSelectProps = {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
};

function FilterSelect({ value, placeholder, options, onChange }: FilterSelectProps) {
  return (
    <select
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" className="bg-slate-900 text-white">
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option} className="bg-slate-900 text-white">
          {option}
        </option>
      ))}
    </select>
  );
}
