import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Columns3, Download, Filter, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { DataPagination } from "@/components/ui/DataPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatMoney, formatShortDate } from "@/utils/format";
import { useCashFlowStore, type RangePreset } from "@/store/useCashFlowStore";
import { WeeklyGrid, type GridDensity } from "@/components/cashflow/WeeklyGrid";
import { MilestoneCellPopover, type CellSelection } from "@/components/cashflow/MilestoneCellPopover";
import { StatusLegend } from "@/components/cashflow/StatusLegend";
import type { CashFlowSummary, WeeklyReport } from "@/components/cashflow/types";
import type { PeriodLevel } from "@/components/cashflow/periods";
import { buildSummaryColumns } from "@/components/cashflow/cashFlowSummary";
import {
  CashFlowSummaryTable,
  ExpenseGrid,
  PeriodToolbar,
  usePeriodColumns,
  type SummaryDetail,
} from "@/components/cashflow/CashFlowSummaryTable";

type CashFlowFilters = {
  code: string;
  project: string;
  client: string;
  businessUnit: string;
  coordinator: string;
  status: string;
  mismatch: boolean;
  includeUndated: boolean;
};

const initialFilters: CashFlowFilters = {
  code: "",
  project: "",
  client: "",
  businessUnit: "",
  coordinator: "",
  status: "",
  mismatch: false,
  includeUndated: true,
};

const presets: Array<{ value: RangePreset; label: string }> = [
  { value: "current", label: "Mes actual" },
  { value: "next3", label: "Próximos 3 meses" },
  { value: "next6", label: "Próximos 6 meses" },
  { value: "next12", label: "Próximos 12 meses" },
  { value: "year", label: "Año actual" },
  { value: "custom", label: "Personalizado" },
  { value: "all", label: "Todo el proyecto" },
];

const levels: Array<{ value: PeriodLevel; label: string; density: GridDensity }> = [
  { value: "week", label: "Semana", density: "weekly" },
  { value: "month", label: "Mes", density: "monthly" },
  { value: "quarter", label: "Trimestre", density: "quarterly" },
  { value: "year", label: "Año", density: "yearly" },
];

const MIN_MONTH = "2019-01";

export default function IncomeCashFlowPage() {
  const { preset, from, to, setRange, reportVersion } = useCashFlowStore();
  const [filters, setFilters] = useState<CashFlowFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [level, setLevel] = useState<PeriodLevel>("month");
  const [detail, setDetail] = useState<SummaryDetail>(null);
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const debouncedFilters = useDebouncedValue(filters, 350);

  const density = levels.find((option) => option.value === level)?.density ?? "monthly";

  // Resumen del flujo (saldo en bancos, ingresos y gastos en PEN por semana).
  useEffect(() => {
    let cancelled = false;
    const params = buildQuery({ preset, from, to, filters: initialFilters, page: 1, perPage: 0, withPagination: false });

    setSummaryLoading(true);
    setError("");

    api
      .get<CashFlowSummary>(`/flujo-caja/resumen?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, preset, reportVersion, to]);

  const periods = usePeriodColumns(summary, level);
  const columns = useMemo(() => (summary ? buildSummaryColumns(summary, periods.leaves) : []), [periods.leaves, summary]);

  // Detalle de ingresos: solo se consulta cuando está desplegado.
  useEffect(() => {
    if (detail !== "ingresos") return;

    let cancelled = false;
    const params = buildQuery({ preset, from, to, filters: debouncedFilters, page, perPage, withPagination: true });

    setLoading(true);
    setError("");

    api
      .get<WeeklyReport>(`/flujo-caja/ingresos/semanal?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, detail, from, page, perPage, preset, reportVersion, to]);

  const exportQuery = useMemo(
    () => buildQuery({ preset, from, to, filters, page, perPage, withPagination: false }).toString(),
    [filters, from, page, perPage, preset, to],
  );

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => (key === "includeUndated" ? value === false : Boolean(value)),
  ).length;

  const handleFilterChange = <K extends keyof CashFlowFilters>(key: K, value: CashFlowFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      await api.download(`/flujo-caja/ingresos/semanal/exportar?${exportQuery}`, `flujo-caja-semanal-${from}-a-${to}.xlsx`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar el archivo.");
    } finally {
      setExporting(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Reporte operativo</p>
          <h2 className="mt-2 font-display text-4xl text-white">Flujo de caja</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Saldo en bancos más los ingresos y menos los gastos de cada período, en soles. Los ingresos son los hitos en su
            fecha real de cobro (o estimada de pago / facturación); los gastos son lo pagado y lo comprometido en Gestión de
            Compras. Los dólares se convierten con el tipo de cambio de cada semana. Haz clic en Total ingresos o Total
            gastos para ver su detalle.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start xl:self-auto">
          <Link
            to="/configuracion/saldos-bancos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
          >
            <Banknote className="h-4 w-4" />
            Saldos en bancos
          </Link>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-3 text-sm text-white transition hover:bg-mint-400/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar ingresos (Excel)"}
          </button>
        </div>
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPage(1);
                setRange(option.value);
              }}
              className={`rounded-2xl border px-3 py-2 text-sm transition ${
                preset === option.value
                  ? "border-mint-400/50 bg-mint-400/15 text-white"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            Desde
            <input
              type="month"
              min={MIN_MONTH}
              value={preset === "all" && summary ? summary.desde : from}
              disabled={preset === "all"}
              onChange={(event) => {
                if (!event.target.value) return;
                setPage(1);
                setRange("custom", event.target.value, to < event.target.value ? event.target.value : to);
              }}
              className="bg-transparent text-white outline-none disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            Hasta
            <input
              type="month"
              min={from || MIN_MONTH}
              value={preset === "all" && summary ? summary.hasta : to}
              disabled={preset === "all"}
              onChange={(event) => {
                if (!event.target.value) return;
                setPage(1);
                setRange("custom", from, event.target.value);
              }}
              className="bg-transparent text-white outline-none disabled:opacity-50"
            />
          </label>
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Columnas">
            <Columns3 className="mx-2 h-4 w-4 text-tide-400" />
            {levels.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={level === option.value}
                onClick={() => setLevel(option.value)}
                className={`rounded-xl px-3 py-1.5 text-sm transition ${
                  level === option.value ? "bg-mint-400/20 text-white" : "text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>
      ) : summaryLoading && !summary ? (
        <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Saldo en bancos</p>
              <h3 className="mt-2 font-display text-2xl text-white">{formatMoney(summary.saldoInicial.totalPen, "PEN")}</h3>
              <p className="mt-2 text-xs text-white/50">
                {summary.saldoInicial.cuentas.length
                  ? `${summary.saldoInicial.cuentas.length} cuenta(s) · al inicio ${formatShortDate(summary.saldoInicial.fechaInicio)}`
                  : "Sin saldos registrados"}
              </p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Total ingresos</p>
              <h3 className="mt-2 font-display text-2xl text-mint-400">
                {formatMoney(columns.reduce((total, column) => total + column.ingresos, 0), "PEN")}
              </h3>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Total gastos</p>
              <h3 className="mt-2 font-display text-2xl text-amberx-400">
                {formatMoney(columns.reduce((total, column) => total + column.gastos.total, 0), "PEN")}
              </h3>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Saldo final</p>
              <h3
                className={`mt-2 font-display text-2xl ${
                  (columns[columns.length - 1]?.saldoFinal ?? 0) < 0 ? "text-red-400" : "text-white"
                }`}
              >
                {formatMoney(columns[columns.length - 1]?.saldoFinal ?? summary.saldoInicial.totalPen, "PEN")}
              </h3>
            </Panel>
          </div>

          <SummaryNotices summary={summary} />

          <Panel className="space-y-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <Filter className="h-4 w-4 text-tide-400" />
              El saldo final de cada columna pasa a ser el saldo en bancos de la siguiente.
              {summaryLoading && <span className="text-xs text-white/45">Actualizando…</span>}
            </div>
            <PeriodToolbar periods={periods} />
            <CashFlowSummaryTable
              summary={summary}
              periods={periods}
              detail={detail}
              onToggle={(value) => setDetail((current) => (current === value ? null : value))}
            />
          </Panel>

          {detail === "gastos" && (
            <Panel className="space-y-4 overflow-hidden">
              <div>
                <h3 className="font-display text-2xl text-white">Detalle de gastos</h3>
                <p className="mt-1 text-sm text-white/55">
                  Gestión de Compras por proyecto y categoría: lo pagado en su fecha de pago y lo comprometido en su fecha
                  programada (montos en soles).
                </p>
              </div>
              {summary.gastos.disponible ? (
                <ExpenseGrid summary={summary} periods={periods} />
              ) : (
                <p className="rounded-2xl border border-amberx-500/30 px-4 py-3 text-sm text-amberx-400">
                  No se pudieron obtener los gastos: {summary.gastos.mensaje}
                </p>
              )}
            </Panel>
          )}

          {detail === "ingresos" && (
            <>
              <Panel className="space-y-4">
                <div>
                  <h3 className="font-display text-2xl text-white">Detalle de ingresos</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Una fila por proyecto con sus hitos por semana, en su moneda original (sin conversión). Los filtros
                    aplican solo a este detalle.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <input className={inputClass} placeholder="Código" value={filters.code} onChange={(e) => handleFilterChange("code", e.target.value)} />
                  <input className={inputClass} placeholder="Proyecto" value={filters.project} onChange={(e) => handleFilterChange("project", e.target.value)} />
                  <input className={inputClass} placeholder="Cliente" value={filters.client} onChange={(e) => handleFilterChange("client", e.target.value)} />
                  <FilterSelect
                    value={filters.businessUnit}
                    placeholder="Unidad: todas"
                    options={report?.filterOptions.businessUnits ?? []}
                    onChange={(value) => handleFilterChange("businessUnit", value)}
                  />
                  <FilterSelect
                    value={filters.coordinator}
                    placeholder="Coordinador: todos"
                    options={report?.filterOptions.coordinators ?? []}
                    onChange={(value) => handleFilterChange("coordinator", value)}
                  />
                  <FilterSelect
                    value={filters.status}
                    placeholder="Estado: todos"
                    options={report?.filterOptions.statuses ?? []}
                    onChange={(value) => handleFilterChange("status", value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={filters.mismatch} onChange={(e) => handleFilterChange("mismatch", e.target.checked)} />
                    Solo proyectos con discrepancias de estado
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.includeUndated}
                      onChange={(e) => handleFilterChange("includeUndated", e.target.checked)}
                    />
                    Incluir proyectos que solo tienen hitos sin fecha
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white transition hover:bg-white/[0.08]"
                    onClick={() => {
                      setFilters(initialFilters);
                      setPage(1);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Limpiar filtros ({activeFilters})
                  </button>
                </div>
              </Panel>

              {loading && !report ? (
                <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.05]" />
              ) : report ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Panel>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Ingresos del detalle</p>
                      {report.monedas.map((currency) => (
                        <p key={currency} className="mt-2 font-display text-2xl text-white">
                          {formatMoney(report.totales.general[currency], currency)}
                        </p>
                      ))}
                    </Panel>
                    <Panel>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Sin fecha de caja</p>
                      {report.monedas.map((currency) => (
                        <p key={currency} className="mt-2 font-display text-2xl text-white">
                          {formatMoney(report.totales.sinFecha[currency], currency)}
                        </p>
                      ))}
                    </Panel>
                    <Panel>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Proyectos</p>
                      <h3 className="mt-2 font-display text-3xl text-white">{report.totalFilas}</h3>
                      {report.discrepancias > 0 && (
                        <button
                          type="button"
                          onClick={() => handleFilterChange("mismatch", true)}
                          className="mt-2 inline-flex items-center gap-1 text-sm text-amberx-400 hover:underline"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {report.discrepancias} hito(s) con discrepancia de estado
                        </button>
                      )}
                    </Panel>
                  </div>

                  <Panel className="space-y-4 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 text-white/70">
                      <Filter className="h-4 w-4 text-tide-400" />
                      Haz clic en una celda para ver el detalle de hitos y fechas de ese período.
                      {loading && <span className="text-xs text-white/45">Actualizando…</span>}
                    </div>
                    <StatusLegend statuses={report.estados} markers={report.marcadores} />
                    <WeeklyGrid report={report} density={density} onSelect={setSelection} />
                    <DataPagination
                      meta={report.meta}
                      pageSizeOptions={[10, 25, 50, 100, 250]}
                      onPageChange={setPage}
                      onPerPageChange={(value) => {
                        setPerPage(value);
                        setPage(1);
                      }}
                    />
                  </Panel>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}

      <MilestoneCellPopover selection={selection} onClose={() => setSelection(null)} />
    </div>
  );
}

function buildQuery({
  preset,
  from,
  to,
  filters,
  page,
  perPage,
  withPagination,
}: {
  preset: RangePreset;
  from: string;
  to: string;
  filters: CashFlowFilters;
  page: number;
  perPage: number;
  withPagination: boolean;
}) {
  const params = new URLSearchParams();

  if (preset === "all") {
    params.set("scope", "all");
  } else {
    params.set("from", from);
    params.set("to", to);
  }

  if (withPagination) {
    params.set("page", String(page));
    params.set("per_page", String(perPage));
  }

  if (filters.code) params.set("code", filters.code);
  if (filters.project) params.set("project", filters.project);
  if (filters.client) params.set("client", filters.client);
  if (filters.businessUnit) params.set("business_unit", filters.businessUnit);
  if (filters.coordinator) params.set("coordinator", filters.coordinator);
  if (filters.status) params.set("status", filters.status);
  if (filters.mismatch) params.set("mismatch", "1");
  if (!filters.includeUndated) params.set("include_undated", "0");

  return params;
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

/** Avisos que afectan la lectura del flujo: saldos tomados después del inicio, cuentas sin saldo, gastos no disponibles. */
function SummaryNotices({ summary }: { summary: CashFlowSummary }) {
  const later = summary.saldoInicial.cuentas.filter((account) => account.posteriorAlInicio);
  const notices: string[] = [];

  if (!summary.saldoInicial.cuentas.length) {
    notices.push("No hay saldos en bancos registrados: el flujo parte de S/ 0,00. Regístralos en Saldos en bancos.");
  }

  if (later.length) {
    notices.push(
      `Sin saldo al ${formatShortDate(summary.saldoInicial.fechaInicio)}; se usó el primer saldo registrado de: ${later
        .map((account) => `${account.banco} · ${account.cuenta} (${formatShortDate(account.fecha)})`)
        .join(", ")}.`,
    );
  }

  if (summary.saldoInicial.cuentasSinSaldo > 0) {
    notices.push(`${summary.saldoInicial.cuentasSinSaldo} cuenta(s) activa(s) sin saldos registrados.`);
  }

  if (!summary.gastos.disponible) {
    notices.push(`Gastos no disponibles (Gestión de Compras): ${summary.gastos.mensaje}`);
  }

  if (!notices.length) return null;

  return (
    <Panel className="space-y-1 border-amberx-500/30 py-4 text-sm text-amberx-400">
      {notices.map((notice) => (
        <p key={notice} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      ))}
    </Panel>
  );
}
