import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { formatMoney, formatShortDate } from "@/utils/format";
import {
  LEVELS,
  LEVEL_LABELS,
  allExpandableKeys,
  buildHeaderRows,
  buildPeriodTree,
  descendantKeys,
  visibleLeaves,
  type PeriodLevel,
  type PeriodNode,
} from "./periods";
import { buildSummaryColumns, expenseCell, sumExpenses, type SummaryColumn } from "./cashFlowSummary";
import type { CashFlowSummary, ExpenseAmounts } from "./types";

export type SummaryDetail = "ingresos" | "gastos" | null;

const LABEL_WIDTH = 220;
const COLUMN_WIDTH = 132;
const TOTAL_WIDTH = 150;
const EXPENSE_TOTAL_WIDTH = 230;
const HEADER_ROW_HEIGHT = 32;

/** Columnas de período del flujo: nivel elegido + períodos expandidos (compartidas por el resumen y el detalle de gastos). */
export type PeriodColumns = {
  level: PeriodLevel;
  tree: PeriodNode[];
  leaves: PeriodNode[];
  expanded: Set<string>;
  expandableCount: number;
  topDepth: number;
  bottomDepth: number;
  expand: (item: PeriodNode) => void;
  collapse: (item: PeriodNode) => void;
  expandAll: () => void;
  collapseAll: () => void;
};

export function usePeriodColumns(summary: CashFlowSummary | null, level: PeriodLevel): PeriodColumns {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => (summary ? buildPeriodTree(summary.meses) : []), [summary]);
  const rangeKey = summary ? `${summary.desde}|${summary.hasta}|${summary.alcance}` : "";

  // Al cambiar el período consultado o el nivel de columnas se vuelve a contraer todo.
  useEffect(() => setExpanded(new Set()), [rangeKey, level]);

  const leaves = useMemo(() => visibleLeaves(tree, level, expanded), [tree, level, expanded]);
  const expandableCount = useMemo(() => allExpandableKeys(tree).length, [tree]);
  const baseDepth = LEVELS.indexOf(level);

  return {
    level,
    tree,
    leaves,
    expanded,
    expandableCount,
    topDepth: Math.max(0, baseDepth - 1),
    bottomDepth: Math.max(baseDepth, ...leaves.map((leaf) => leaf.depth)),
    expand: (item) => {
      if (item.level === "week") return;
      setExpanded((current) => new Set(current).add(item.key));
    },
    collapse: (item) =>
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(item.key);
        descendantKeys(item).forEach((key) => next.delete(key));

        return next;
      }),
    expandAll: () => setExpanded(new Set(allExpandableKeys(tree))),
    collapseAll: () => setExpanded(new Set()),
  };
}

export function PeriodToolbar({ periods }: { periods: PeriodColumns }) {
  const finestVisible = LEVELS[periods.bottomDepth];

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
        Columnas: <strong className="text-white">{LEVEL_LABELS[periods.level]}</strong>
        {finestVisible !== periods.level && (
          <>
            {" "}
            · detalle hasta <strong className="text-white">{LEVEL_LABELS[finestVisible].toLowerCase()}</strong>
          </>
        )}
        {periods.expanded.size > 0 && <> · {periods.expanded.size} período(s) expandido(s)</>}
      </span>
      {periods.level !== "week" && (
        <span className="text-white/45">
          Clic en un encabezado <ChevronRight className="inline h-3 w-3" /> para ver su detalle; clic en el grupo{" "}
          <ChevronDown className="inline h-3 w-3" /> para contraerlo.
        </span>
      )}
      <span className="ml-auto flex gap-2">
        <button
          type="button"
          disabled={periods.expanded.size === periods.expandableCount || periods.level === "week"}
          onClick={periods.expandAll}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white transition hover:bg-white/[0.08] disabled:opacity-40"
          title="Muestra todas las semanas (puede requerir desplazamiento horizontal)"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Expandir todo
        </button>
        <button
          type="button"
          disabled={periods.expanded.size === 0}
          onClick={periods.collapseAll}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          <Minimize2 className="h-3.5 w-3.5" /> Contraer todo
        </button>
      </span>
    </div>
  );
}

/**
 * Encabezado jerárquico de períodos: cada columna se expande a su nivel inferior
 * (año → trimestre → mes → semana) y cada grupo expandido se contrae con un clic.
 */
function PeriodHead({
  periods,
  leading,
  trailing,
}: {
  periods: PeriodColumns;
  leading: (rowSpan: number) => ReactNode;
  trailing: (rowSpan: number) => ReactNode;
}) {
  const rows = buildHeaderRows(periods.leaves, periods.topDepth, periods.bottomDepth, () => COLUMN_WIDTH);

  return (
    <thead>
      {rows.map((row, rowIndex) => (
        <tr key={rowIndex} className="text-[11px]" style={{ height: HEADER_ROW_HEIGHT }}>
          {rowIndex === 0 && leading(rows.length)}
          {row.map(({ node, colSpan, rowSpan, isLeaf }) => {
            const isExpandedGroup = !isLeaf && periods.expanded.has(node.key);
            const canExpand = isLeaf && node.level !== "week";
            const action = canExpand ? () => periods.expand(node) : isExpandedGroup ? () => periods.collapse(node) : undefined;

            return (
              <th
                key={`${rowIndex}-${node.key}`}
                colSpan={colSpan}
                rowSpan={rowSpan}
                title={`${node.title}${canExpand ? " · clic para ver detalle" : isExpandedGroup ? " · clic para contraer" : ""}`}
                className={`sticky z-20 truncate border-b border-r border-white/8 bg-ink-900 px-1 text-center ${
                  node.level === "week" ? "font-normal text-white/50" : "font-semibold text-mint-400"
                } ${action ? "cursor-pointer hover:bg-white/[0.08]" : ""}`}
                style={{ top: rowIndex * HEADER_ROW_HEIGHT }}
                onClick={action}
                onKeyDown={(event) => {
                  if (action && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    action();
                  }
                }}
                tabIndex={action ? 0 : undefined}
                aria-expanded={action ? isExpandedGroup : undefined}
              >
                {action &&
                  (isExpandedGroup ? (
                    <ChevronDown className="mr-0.5 inline h-3 w-3" />
                  ) : (
                    <ChevronRight className="mr-0.5 inline h-3 w-3" />
                  ))}
                {node.label}
              </th>
            );
          })}
          {rowIndex === 0 && trailing(rows.length)}
        </tr>
      ))}
    </thead>
  );
}

type SummaryTableProps = {
  summary: CashFlowSummary;
  periods: PeriodColumns;
  detail: SummaryDetail;
  onToggle: (detail: Exclude<SummaryDetail, null>) => void;
};

/** Tres líneas resumen por período (saldo en bancos, ingresos, gastos) y el saldo final. */
export function CashFlowSummaryTable({ summary, periods, detail, onToggle }: SummaryTableProps) {
  const columns = buildSummaryColumns(summary, periods.leaves);
  const last = columns[columns.length - 1];
  const totalIncome = columns.reduce((total, column) => total + column.ingresos, 0);
  const totalExpense = sumExpenses(summary.gastos.porSemana, periods.leaves.flatMap((node) => node.weeks));
  const width = LABEL_WIDTH + columns.length * COLUMN_WIDTH + TOTAL_WIDTH;

  const openingTitle = summary.saldoInicial.cuentas.length
    ? summary.saldoInicial.cuentas
        .map(
          (account) =>
            `${account.banco} · ${account.cuenta}: ${formatMoney(account.saldo, account.moneda)} al ${formatShortDate(account.fecha)}` +
            (account.moneda === "USD" ? ` (TC ${account.tipoCambio})` : ""),
        )
        .join("\n")
    : "Sin saldos registrados";

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="border-separate border-spacing-0 text-sm" style={{ width, minWidth: "100%", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: LABEL_WIDTH }} />
          {columns.map((column) => (
            <col key={column.node.key} style={{ width: COLUMN_WIDTH }} />
          ))}
          <col style={{ width: TOTAL_WIDTH }} />
        </colgroup>
        <PeriodHead
          periods={periods}
          leading={(rowSpan) => (
            <th
              rowSpan={rowSpan}
              className="sticky left-0 top-0 z-40 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
            >
              Concepto (S/)
            </th>
          )}
          trailing={(rowSpan) => (
            <th
              rowSpan={rowSpan}
              className="sticky top-0 z-20 border-b border-white/8 bg-ink-900 px-3 text-right uppercase tracking-[0.12em] text-white/50"
            >
              Total
            </th>
          )}
        />
        <tbody className="tabular-nums">
          <SummaryRow
            label="Saldo en bancos (inicial)"
            hint={openingTitle}
            columns={columns}
            value={(column) => column.saldoInicial}
            total={summary.saldoInicial.totalPen}
          />
          <SummaryRow
            label="Total ingresos"
            columns={columns}
            value={(column) => column.ingresos}
            total={totalIncome}
            tone="text-mint-400"
            expanded={detail === "ingresos"}
            onClick={() => onToggle("ingresos")}
          />
          <SummaryRow
            label="Total gastos"
            columns={columns}
            value={(column) => column.gastos.total}
            total={totalExpense.total}
            tone="text-amberx-400"
            negative
            expanded={detail === "gastos"}
            onClick={() => onToggle("gastos")}
            cellTitle={(column) => expenseTitle(column.gastos)}
          />
          <SummaryRow
            label="Saldo final"
            columns={columns}
            value={(column) => column.saldoFinal}
            total={last?.saldoFinal ?? summary.saldoInicial.totalPen}
            strong
          />
        </tbody>
      </table>
    </div>
  );
}

function SummaryRow({
  label,
  hint,
  columns,
  value,
  total,
  tone,
  negative,
  strong,
  expanded,
  onClick,
  cellTitle,
}: {
  label: string;
  hint?: string;
  columns: SummaryColumn[];
  value: (column: SummaryColumn) => number;
  total: number;
  tone?: string;
  negative?: boolean;
  strong?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  cellTitle?: (column: SummaryColumn) => string;
}) {
  const rowClass = strong ? "bg-white/[0.04] font-semibold text-white" : "text-white/80";
  const amountClass = (amount: number) =>
    strong ? (amount < 0 ? "text-red-400" : "text-white") : amount === 0 ? "text-white/25" : tone ?? "text-white/85";
  const format = (amount: number) => (negative && amount ? `(${formatMoney(amount, "PEN")})` : formatMoney(amount, "PEN"));

  return (
    <tr className={`${rowClass} ${onClick ? "cursor-pointer hover:bg-white/[0.05]" : ""}`} onClick={onClick}>
      <td
        className={`sticky left-0 z-10 border-b border-r border-white/6 bg-ink-900 px-3 py-3 ${strong ? "border-t border-t-white/15" : ""}`}
        title={hint}
      >
        {onClick ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-left text-white hover:text-mint-400"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {label}
          </button>
        ) : (
          <span className={hint ? "underline decoration-dotted decoration-white/30 underline-offset-4" : ""}>{label}</span>
        )}
      </td>
      {columns.map((column) => {
        const amount = value(column);

        return (
          <td
            key={column.node.key}
            title={cellTitle?.(column)}
            className={`whitespace-nowrap border-b border-r border-white/6 px-2 py-3 text-right ${
              strong ? "border-t border-t-white/15" : ""
            } ${amountClass(amount)}`}
          >
            {format(amount)}
          </td>
        );
      })}
      <td
        className={`whitespace-nowrap border-b border-white/6 px-3 py-3 text-right font-medium ${strong ? "border-t border-t-white/15" : ""} ${amountClass(total)}`}
      >
        {format(total)}
      </td>
    </tr>
  );
}

function expenseTitle(amounts: ExpenseAmounts) {
  return `Pagado: ${formatMoney(amounts.pagado, "PEN")}\nCompromiso: ${formatMoney(amounts.compromiso, "PEN")}`;
}

/**
 * Detalle de gastos (Gestión de Compras) por proyecto y categoría, con las mismas columnas
 * (y los mismos períodos expandidos) que el resumen del flujo.
 */
export function ExpenseGrid({ summary, periods }: { summary: CashFlowSummary; periods: PeriodColumns }) {
  const { leaves, tree } = periods;
  const rows = summary.gastos.filas;
  const allWeeks = tree.flatMap((node) => node.weeks);
  const width = 110 + 200 + leaves.length * COLUMN_WIDTH + EXPENSE_TOTAL_WIDTH;

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-white/45">No hay gastos pagados ni comprometidos en el período.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="max-h-[72vh] overflow-auto rounded-2xl border border-white/8">
        <table className="border-separate border-spacing-0 text-xs" style={{ width, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 110 }} />
            <col style={{ width: 200 }} />
            {leaves.map((leaf) => (
              <col key={leaf.key} style={{ width: COLUMN_WIDTH }} />
            ))}
            <col style={{ width: EXPENSE_TOTAL_WIDTH }} />
          </colgroup>
          <PeriodHead
            periods={periods}
            leading={(rowSpan) => (
              <>
                <th
                  rowSpan={rowSpan}
                  className="sticky left-0 top-0 z-40 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
                >
                  Proyecto
                </th>
                <th
                  rowSpan={rowSpan}
                  className="sticky top-0 z-20 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
                >
                  Categoría
                </th>
              </>
            )}
            trailing={(rowSpan) => (
              <th
                rowSpan={rowSpan}
                className="sticky top-0 z-20 border-b border-white/8 bg-ink-900 px-3 text-right uppercase tracking-[0.12em] text-white/50"
              >
                Total
              </th>
            )}
          />
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.clave} className="align-top text-white/75 hover:bg-white/[0.03]">
                <td className="sticky left-0 z-10 border-b border-r border-white/6 bg-ink-900 px-3 py-2 font-medium text-white" title={row.proyecto}>
                  {row.proyectoCodigo}
                </td>
                <td className="truncate border-b border-r border-white/6 px-3 py-2" title={`${row.proyecto}\n${row.categoria}`}>
                  {row.categoria}
                </td>
                {leaves.map((leaf) => {
                  const cell = expenseCell(row, leaf);

                  return (
                    <td key={leaf.key} className="border-b border-r border-white/6 px-2 py-2 text-right" title={cell ? `${leaf.title}\n${expenseTitle(cell)}` : undefined}>
                      {cell ? <ExpenseLines amounts={cell} /> : <span className="text-white/20">-</span>}
                    </td>
                  );
                })}
                <td className="border-b border-white/6 px-3 py-2 text-right font-medium text-white">
                  <ExpenseLines amounts={sumExpenses(row.celdas, allWeeks)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium text-white">
              <td colSpan={2} className="sticky bottom-0 left-0 z-30 border-t border-white/10 bg-ink-800 px-3 py-2">
                Total gastos ({rows.length} fila(s))
              </td>
              {leaves.map((leaf) => {
                const amounts = sumExpenses(summary.gastos.porSemana, leaf.weeks);

                return (
                  <td key={leaf.key} className="sticky bottom-0 z-20 border-r border-t border-white/10 bg-ink-800 px-2 py-2 text-right" title={expenseTitle(amounts)}>
                    <ExpenseLines amounts={amounts} />
                  </td>
                );
              })}
              <td className="sticky bottom-0 z-20 border-t border-white/10 bg-ink-800 px-3 py-2 text-right">
                <ExpenseLines amounts={sumExpenses(summary.gastos.porSemana, allWeeks)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ExpenseLines({ amounts }: { amounts: ExpenseAmounts }) {
  if (!amounts.total) {
    return <span className="text-white/25">0</span>;
  }

  return (
    <div className="space-y-0.5 whitespace-nowrap">
      <p className="text-amberx-400">{formatMoney(amounts.total, "PEN")}</p>
      {amounts.pagado > 0 && amounts.compromiso > 0 && (
        <p className="text-[10px] text-white/45">
          Pag. {formatMoney(amounts.pagado, "PEN")} · Comp. {formatMoney(amounts.compromiso, "PEN")}
        </p>
      )}
      {amounts.compromiso > 0 && amounts.pagado === 0 && <p className="text-[10px] text-white/45">compromiso</p>}
    </div>
  );
}
