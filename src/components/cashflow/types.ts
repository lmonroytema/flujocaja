import type { PaginationMeta } from "@/components/ui/DataPagination";
import type { CurrencyCode } from "@/utils/format";

export type Amounts = Record<CurrencyCode, number>;

export type MilestoneDetail = {
  id: number;
  codigo: string | null;
  nombre: string;
  monto: number;
  moneda: CurrencyCode;
  estado: string;
  estadoExcel: string | null;
  responsable: string | null;
  discrepancia: boolean;
  factura: string | null;
  alerta: string | null;
  fechaCaja: string | null;
  fechas: Record<string, string | null>;
};

export type Marker = {
  tipo: string;
  etiqueta: string;
  fecha: string;
  hito: string | null;
};

export type WeekCell = {
  montos: Amounts;
  hitos: MilestoneDetail[];
  marcadores: Marker[];
  estados: string[];
};

export type WeeklyRow = {
  projectId: number;
  codigoProyecto: string;
  proyecto: string;
  unidadNegocio: string | null;
  cliente: string | null;
  coordinador: string | null;
  estado: string | null;
  estados: Record<string, number>;
  discrepancias: number;
  totalHitos: number;
  celdas: Record<string, WeekCell>;
  sinFecha: { montos: Amounts; hitos: MilestoneDetail[] };
  totales: Amounts;
};

export type Week = {
  clave: string;
  indice: number;
  fechaInicio: string;
  fechaFin: string;
  etiqueta: string;
};

export type MonthGroup = {
  clave: string;
  anio: number;
  mes: number;
  etiqueta: string;
  semanas: Week[];
};

export type StatusInfo = { estado: string; orden: number; responsable: string };

export type WeeklyReport = {
  desde: string;
  hasta: string;
  alcance: "rango" | "todo";
  monedas: CurrencyCode[];
  meses: MonthGroup[];
  totalSemanas: number;
  filas: WeeklyRow[];
  meta: PaginationMeta;
  totales: { general: Amounts; sinFecha: Amounts; porSemana: Record<string, Amounts> };
  totalFilas: number;
  discrepancias: number;
  estados: StatusInfo[];
  marcadores: Array<{ codigo: string; etiqueta: string }>;
  filterOptions: {
    businessUnits: string[];
    clients: string[];
    coordinators: string[];
    statuses: string[];
  };
};

/** Colores por estado (punto / chip). */
export const statusStyles: Record<string, { dot: string; chip: string }> = {
  "No iniciado": { dot: "bg-slate-400", chip: "border-slate-400/40 bg-slate-400/10 text-slate-200" },
  "En curso": { dot: "bg-sky-400", chip: "border-sky-400/40 bg-sky-400/10 text-sky-200" },
  "Por valorizar": { dot: "bg-violet-400", chip: "border-violet-400/40 bg-violet-400/10 text-violet-200" },
  Valorizado: { dot: "bg-amber-400", chip: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  "Por facturar": { dot: "bg-orange-400", chip: "border-orange-400/40 bg-orange-400/10 text-orange-200" },
  Facturado: { dot: "bg-teal-400", chip: "border-teal-400/40 bg-teal-400/10 text-teal-200" },
  Cobrado: { dot: "bg-emerald-400", chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
};

export function statusStyle(status: string | null | undefined) {
  return statusStyles[status ?? ""] ?? { dot: "bg-white/40", chip: "border-white/20 bg-white/5 text-white/70" };
}

/** Flujo de caja consolidado en PEN (GET /flujo-caja/resumen). */
export type ExpenseAmounts = { pagado: number; compromiso: number; total: number };

export type ExpenseRow = {
  clave: string;
  proyectoCodigo: string;
  proyecto: string;
  categoria: string;
  celdas: Record<string, ExpenseAmounts>;
  totales: ExpenseAmounts;
};

export type OpeningAccount = {
  cuentaId: number;
  banco: string;
  cuenta: string;
  moneda: CurrencyCode;
  fecha: string;
  saldo: number;
  tipoCambio: number;
  saldoPen: number;
  posteriorAlInicio: boolean;
};

export type CashFlowSummary = {
  desde: string;
  hasta: string;
  alcance: "rango" | "todo";
  monedaReporte: "PEN";
  meses: MonthGroup[];
  tiposCambio: Record<string, number>;
  saldoInicial: {
    fechaInicio: string;
    totalPen: number;
    cuentas: OpeningAccount[];
    cuentasSinSaldo: number;
  };
  ingresos: { porSemana: Record<string, number>; total: number; sinFecha: Amounts };
  gastos: {
    disponible: boolean;
    mensaje: string | null;
    porSemana: Record<string, ExpenseAmounts>;
    totales: ExpenseAmounts;
    filas: ExpenseRow[];
  };
};
