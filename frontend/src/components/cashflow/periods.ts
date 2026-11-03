import type { CurrencyCode } from "@/utils/format";
import { statusStyles, type Amounts, type Marker, type MilestoneDetail, type MonthGroup, type WeekCell, type WeeklyRow } from "./types";

/** Jerarquía de períodos del reporte: año → trimestre → mes → semana (unidad mínima). */
export type PeriodLevel = "year" | "quarter" | "month" | "week";

export const LEVELS: PeriodLevel[] = ["year", "quarter", "month", "week"];

export const LEVEL_LABELS: Record<PeriodLevel, string> = {
  year: "Años",
  quarter: "Trimestres",
  month: "Meses",
  week: "Semanas",
};

export type PeriodNode = {
  key: string;
  level: PeriodLevel;
  depth: number;
  /** Etiqueta completa (encabezado ancho y título del detalle). */
  label: string;
  /** Etiqueta corta para columnas angostas. */
  shortLabel: string;
  /** Rango de fechas (tooltip). */
  title: string;
  /** Claves de semana (lunes) que suma este período. */
  weeks: string[];
  children: PeriodNode[];
  /** Ancestros desde el año hasta el padre inmediato. */
  ancestors: PeriodNode[];
};

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function shortDate(value: string) {
  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

/**
 * Construye el árbol de períodos a partir de las semanas del reporte.
 * Cada semana ya pertenece al mes de su lunes, así que mes = suma de sus semanas,
 * trimestre = suma de sus meses y año = suma de sus trimestres.
 */
export function buildPeriodTree(months: MonthGroup[]): PeriodNode[] {
  const years: PeriodNode[] = [];

  for (const month of months) {
    if (!month.semanas.length) continue;

    let year = years.find((node) => node.key === String(month.anio));

    if (!year) {
      year = node(String(month.anio), "year", String(month.anio), String(month.anio).slice(2), []);
      years.push(year);
    }

    const quarterNumber = Math.ceil(month.mes / 3);
    const quarterKey = `${month.anio}-T${quarterNumber}`;
    let quarter = year.children.find((item) => item.key === quarterKey);

    if (!quarter) {
      quarter = node(quarterKey, "quarter", `T${quarterNumber} ${month.anio}`, `T${quarterNumber}`, [year]);
      year.children.push(quarter);
    }

    const monthNode = node(
      month.clave,
      "month",
      month.etiqueta,
      `${MONTH_SHORT[month.mes - 1]} ${String(month.anio).slice(2)}`,
      [year, quarter],
    );

    for (const week of month.semanas) {
      const weekNode = node(week.clave, "week", week.etiqueta, `S${week.indice}`, [year, quarter, monthNode]);
      weekNode.weeks = [week.clave];
      weekNode.title = `${month.etiqueta} · ${shortDate(week.fechaInicio)} al ${shortDate(week.fechaFin)}`;
      monthNode.children.push(weekNode);
    }

    monthNode.weeks = monthNode.children.map((item) => item.key);
    monthNode.title = `${month.etiqueta}: ${shortDate(month.semanas[0].fechaInicio)} al ${shortDate(
      month.semanas[month.semanas.length - 1].fechaFin,
    )}`;
    quarter.children.push(monthNode);
  }

  for (const year of years) {
    for (const quarter of year.children) {
      quarter.weeks = quarter.children.flatMap((item) => item.weeks);
      quarter.title = `${quarter.label}: ${quarter.children.map((item) => item.label).join(", ")}`;
    }

    year.weeks = year.children.flatMap((item) => item.weeks);
    year.title = `${year.label}: ${year.children.map((item) => item.label).join(", ")}`;
  }

  return years;
}

function node(key: string, level: PeriodLevel, label: string, shortLabel: string, ancestors: PeriodNode[]): PeriodNode {
  return { key, level, depth: LEVELS.indexOf(level), label, shortLabel, title: label, weeks: [], children: [], ancestors };
}

export function nodesAtLevel(tree: PeriodNode[], level: PeriodLevel): PeriodNode[] {
  const result: PeriodNode[] = [];
  const walk = (items: PeriodNode[]) => {
    for (const item of items) {
      if (item.level === level) {
        result.push(item);
      } else {
        walk(item.children);
      }
    }
  };
  walk(tree);

  return result;
}

/** Elige el nivel más fino cuyas columnas caben en el ancho disponible. */
export function pickBaseLevel(tree: PeriodNode[], available: number, minWidth: number): PeriodLevel {
  for (const level of ["week", "month", "quarter", "year"] as PeriodLevel[]) {
    if (nodesAtLevel(tree, level).length * minWidth <= available) {
      return level;
    }
  }

  return "year";
}

/**
 * Columnas visibles: los niveles más gruesos que el base se abren solos; los del nivel base
 * (o más finos) quedan contraídos salvo que el usuario los haya expandido.
 */
export function visibleLeaves(tree: PeriodNode[], base: PeriodLevel, expanded: Set<string>): PeriodNode[] {
  const baseDepth = LEVELS.indexOf(base);
  const leaves: PeriodNode[] = [];
  const walk = (items: PeriodNode[]) => {
    for (const item of items) {
      if (item.level === "week" || (item.depth >= baseDepth && !expanded.has(item.key))) {
        leaves.push(item);
      } else {
        walk(item.children);
      }
    }
  };
  walk(tree);

  return leaves;
}

export function allExpandableKeys(tree: PeriodNode[]): string[] {
  const keys: string[] = [];
  const walk = (items: PeriodNode[]) => {
    for (const item of items) {
      if (item.level !== "week") {
        keys.push(item.key);
        walk(item.children);
      }
    }
  };
  walk(tree);

  return keys;
}

export function descendantKeys(item: PeriodNode): string[] {
  return item.children.flatMap((child) => [child.key, ...descendantKeys(child)]);
}

export type ColumnSizing = {
  widths: Map<string, number>;
  total: number;
  overflow: boolean;
};

/**
 * Columnas con prioridad: las que resultan de la expansión más profunda de cada rama
 * (su padre está expandido y ningún hermano lo está). Las demás son "hermanas contraídas".
 */
export function priorityKeys(leaves: PeriodNode[], expanded: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const leaf of leaves) {
    const parent = leaf.ancestors[leaf.ancestors.length - 1];

    if (!parent || !expanded.has(parent.key)) continue;
    if (parent.children.some((sibling) => expanded.has(sibling.key))) continue;

    result.add(leaf.key);
  }

  return result;
}

/**
 * Reparte el ancho: si todas las columnas caben con el mínimo legible, se reparten por igual;
 * si no, las columnas recién expandidas conservan el mínimo legible y las hermanas contraídas
 * se encogen. Solo si ni así caben, se permite desplazamiento horizontal.
 */
export function sizeColumns(
  leaves: PeriodNode[],
  expanded: Set<string>,
  available: number,
  options: { min: number; minCollapsed: number; max: number },
): ColumnSizing {
  const widths = new Map<string, number>();
  const count = Math.max(leaves.length, 1);
  const space = Math.max(available, 0);

  if (leaves.length * options.min <= space) {
    const width = Math.min(options.max, space / count);
    leaves.forEach((leaf) => widths.set(leaf.key, width));

    return { widths, total: width * leaves.length, overflow: false };
  }

  const keys = priorityKeys(leaves, expanded);
  const priority = leaves.filter((leaf) => keys.has(leaf.key));
  const rest = leaves.filter((leaf) => !keys.has(leaf.key));
  const remaining = space - priority.length * options.min;
  const restWidth = rest.length ? Math.max(options.minCollapsed, remaining / rest.length) : 0;

  leaves.forEach((leaf) => widths.set(leaf.key, keys.has(leaf.key) ? options.min : restWidth));

  const total = priority.length * options.min + rest.length * restWidth;

  return { widths, total, overflow: total > space + 1 };
}

/** Suma las celdas semanales de una fila para un período. */
export function aggregateCell(row: WeeklyRow, item: PeriodNode, currencies: CurrencyCode[]): WeekCell | undefined {
  if (item.level === "week") {
    return row.celdas[item.key];
  }

  const montos = Object.fromEntries(currencies.map((currency) => [currency, 0])) as Amounts;
  const hitos: MilestoneDetail[] = [];
  const marcadores: Marker[] = [];
  const estados = new Set<string>();
  let found = false;

  for (const weekKey of item.weeks) {
    const cell = row.celdas[weekKey];

    if (!cell) continue;

    found = true;
    currencies.forEach((currency) => {
      montos[currency] = Math.round(((montos[currency] ?? 0) + (cell.montos[currency] ?? 0)) * 100) / 100;
    });
    hitos.push(...cell.hitos);
    marcadores.push(...cell.marcadores);
    cell.estados.forEach((status) => estados.add(status));
  }

  if (!found) return undefined;

  return { montos, hitos, marcadores, estados: sortStatuses([...estados]) };
}

export function aggregateTotals(
  porSemana: Record<string, Amounts>,
  item: PeriodNode,
  currencies: CurrencyCode[],
): Amounts | undefined {
  const result = Object.fromEntries(currencies.map((currency) => [currency, 0])) as Amounts;
  let found = false;

  for (const weekKey of item.weeks) {
    const amounts = porSemana[weekKey];

    if (!amounts) continue;

    found = true;
    currencies.forEach((currency) => {
      result[currency] = Math.round(((result[currency] ?? 0) + (amounts[currency] ?? 0)) * 100) / 100;
    });
  }

  return found ? result : undefined;
}

const STATUS_ORDER = Object.keys(statusStyles);

function sortStatuses(statuses: string[]) {
  return statuses.sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
}

export type HeaderCell = { node: PeriodNode; colSpan: number; rowSpan: number; isLeaf: boolean; width: number };

/** Filas del encabezado: una por nivel, desde el nivel de contexto hasta el más fino visible. */
export function buildHeaderRows(
  leaves: PeriodNode[],
  topDepth: number,
  bottomDepth: number,
  widthOf: (leaf: PeriodNode) => number,
): HeaderCell[][] {
  const rows: HeaderCell[][] = [];

  for (let depth = topDepth; depth <= bottomDepth; depth++) {
    const row: HeaderCell[] = [];

    for (const leaf of leaves) {
      const width = widthOf(leaf);

      if (leaf.depth === depth) {
        row.push({ node: leaf, colSpan: 1, rowSpan: bottomDepth - depth + 1, isLeaf: true, width });
      } else if (leaf.depth > depth) {
        const ancestor = leaf.ancestors[depth];
        const last = row[row.length - 1];

        if (last && !last.isLeaf && last.node.key === ancestor.key) {
          last.colSpan += 1;
          last.width += width;
        } else {
          row.push({ node: ancestor, colSpan: 1, rowSpan: 1, isLeaf: false, width });
        }
      }
    }

    rows.push(row);
  }

  return rows;
}
