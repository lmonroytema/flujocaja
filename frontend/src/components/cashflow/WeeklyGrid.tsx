import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Minimize2, Maximize2 } from "lucide-react";
import { formatMoney, formatMoneyCompact, type CurrencyCode } from "@/utils/format";
import type { CellSelection } from "./MilestoneCellPopover";
import {
  LEVELS,
  LEVEL_LABELS,
  aggregateCell,
  aggregateTotals,
  allExpandableKeys,
  buildHeaderRows,
  buildPeriodTree,
  descendantKeys,
  pickBaseLevel,
  sizeColumns,
  visibleLeaves,
  type PeriodLevel,
  type PeriodNode,
} from "./periods";
import { statusStyle, type Amounts, type WeekCell, type WeeklyReport, type WeeklyRow } from "./types";

/**
 * "adaptive": la granularidad (año → trimestre → mes → semana) se elige sola para que todo el período
 *             quepa en el ancho de la pantalla; los encabezados se expanden/contraen en el lugar.
 * "weekly":   todas las semanas con ancho fijo (puede requerir desplazamiento horizontal).
 * "monthly" / "quarterly" / "yearly": columnas por mes, trimestre o año (elegido por el usuario);
 *             los encabezados se pueden expandir igual que en la vista adaptativa.
 */
export type GridDensity = "adaptive" | "weekly" | "monthly" | "quarterly" | "yearly";

const FIXED_LEVELS: Partial<Record<GridDensity, PeriodLevel>> = { monthly: "month", quarterly: "quarter", yearly: "year" };

type WeeklyGridProps = {
  report: WeeklyReport;
  density: GridDensity;
  onSelect: (selection: CellSelection) => void;
};

const LAYOUTS = {
  wide: { code: 72, project: 160, status: 112, undated: 96, total: 116 },
  narrow: { code: 64, project: 150, status: 100, undated: 96, total: 110 },
};

/** Ancho mínimo legible (montos abreviados) y mínimo para columnas contraídas. */
const MIN_COLUMN = 72;
const MIN_COLLAPSED = 28;
const MAX_COLUMN = 170;
const WEEKLY_COLUMN = 128;
const HEADER_ROW_HEIGHT = 32;

type CellMode = "full" | "short" | "dot" | "bar";

export function WeeklyGrid({ report, density, onSelect }: WeeklyGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const currencies = report.monedas;

  // Ancho disponible: medición inicial síncrona + ResizeObserver (ventana, barra lateral) + resize como respaldo.
  useLayoutEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const measure = () => setContainerWidth(element.clientWidth);
    measure();
    window.addEventListener("resize", measure);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);

    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  // Al cambiar el período consultado se vuelve al nivel automático.
  const rangeKey = `${report.desde}|${report.hasta}|${report.alcance}`;
  useEffect(() => setExpanded(new Set()), [rangeKey, density]);

  const tree = useMemo(() => buildPeriodTree(report.meses), [report.meses]);

  // En pantallas angostas (móvil) sólo la columna Código queda fija a la izquierda.
  const narrow = containerWidth > 0 && containerWidth < 700;
  const layout = narrow ? LAYOUTS.narrow : LAYOUTS.wide;
  const stickyLeft = (left: number) => (narrow ? undefined : { left });
  const fixedTotal = layout.code + layout.project + layout.status + layout.undated + layout.total;
  // Margen de seguridad para bordes y redondeo de anchos fraccionarios.
  // En móvil las columnas de proyecto se desplazan con la grilla: los períodos deben caber en una
  // pantalla junto a la columna Código (fija), aunque haya que deslizar para pasar Proyecto/Estado.
  const available = narrow ? containerWidth - layout.code - 12 : containerWidth - fixedTotal - 12;

  const base: PeriodLevel =
    density === "weekly" ? "week" : FIXED_LEVELS[density] ?? pickBaseLevel(tree, available, MIN_COLUMN);
  const leaves = useMemo(() => visibleLeaves(tree, base, expanded), [tree, base, expanded]);

  const sizing = useMemo(() => {
    if (density === "weekly") {
      const widths = new Map(leaves.map((leaf) => [leaf.key, WEEKLY_COLUMN]));

      return { widths, total: leaves.length * WEEKLY_COLUMN, overflow: leaves.length * WEEKLY_COLUMN > available };
    }

    return sizeColumns(leaves, expanded, available, { min: MIN_COLUMN, minCollapsed: MIN_COLLAPSED, max: MAX_COLUMN });
  }, [available, density, expanded, leaves]);

  const tableWidth = fixedTotal + sizing.total;
  const baseDepth = LEVELS.indexOf(base);
  const topDepth = density === "weekly" ? 2 : Math.max(0, baseDepth - 1);
  const bottomDepth = Math.max(...leaves.map((leaf) => leaf.depth), baseDepth);
  const headerRows = bottomDepth - topDepth + 1;

  const expandableCount = useMemo(() => allExpandableKeys(tree).length, [tree]);
  const finestVisible = LEVELS[bottomDepth];

  const expand = (item: PeriodNode) => {
    if (item.level === "week") return;
    setExpanded((current) => new Set(current).add(item.key));
  };

  const collapse = (item: PeriodNode) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.delete(item.key);
      descendantKeys(item).forEach((key) => next.delete(key));

      return next;
    });
  };

  const modeFor = (width: number): CellMode => (width >= 112 ? "full" : width >= 60 ? "short" : width >= 22 ? "dot" : "bar");

  const headerCells = useMemo(
    () => buildHeaderRows(leaves, topDepth, bottomDepth, (leaf) => sizing.widths.get(leaf.key) ?? 0),
    [bottomDepth, leaves, sizing.widths, topDepth],
  );

  const cellsByRow = useMemo(
    () =>
      new Map(
        report.filas.map((row) => [row.projectId, new Map(leaves.map((leaf) => [leaf.key, aggregateCell(row, leaf, currencies)]))]),
      ),
    [currencies, leaves, report.filas],
  );

  const openCell = (row: WeeklyRow, cell: WeekCell | undefined, item: PeriodNode) => {
    if (!cell) return;

    onSelect({
      titulo: `${row.codigoProyecto} · ${row.proyecto}`,
      subtitulo: item.level === "week" ? `${item.ancestors[2]?.label ?? ""} · semana ${item.label}` : item.label,
      hitos: cell.hitos,
      marcadores: cell.marcadores,
    });
  };

  return (
    <div className="space-y-2">
      {density !== "weekly" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            {density === "adaptive" ? "Nivel automático" : "Columnas"}: <strong className="text-white">{LEVEL_LABELS[base]}</strong>
            {finestVisible !== base && (
              <>
                {" "}
                · detalle hasta <strong className="text-white">{LEVEL_LABELS[finestVisible].toLowerCase()}</strong>
              </>
            )}
            {expanded.size > 0 && <> · {expanded.size} período(s) expandido(s)</>}
          </span>
          <span className="text-white/45">
            Clic en un encabezado <ChevronRight className="inline h-3 w-3" /> para ver su detalle; clic en el grupo{" "}
            <ChevronDown className="inline h-3 w-3" /> para contraerlo.
          </span>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={expanded.size === expandableCount || base === "week"}
              onClick={() => setExpanded(new Set(allExpandableKeys(tree)))}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white transition hover:bg-white/[0.08] disabled:opacity-40"
              title="Muestra todas las semanas (puede requerir desplazamiento horizontal)"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Expandir todo
            </button>
            <button
              type="button"
              disabled={expanded.size === 0}
              onClick={() => setExpanded(new Set())}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              <Minimize2 className="h-3.5 w-3.5" /> Contraer todo
            </button>
          </span>
        </div>
      )}
      {narrow ? (
        <p className="text-xs text-white/50">Pantalla angosta: desliza la grilla horizontalmente para ver los períodos.</p>
      ) : (
        sizing.overflow &&
        containerWidth > 0 && (
          <p className="text-xs text-amberx-400">
            El detalle elegido no cabe en el ancho disponible: desplázate horizontalmente dentro de la grilla
            {density !== "weekly" ? " o contrae algún período." : "."}
          </p>
        )
      )}

      <div ref={containerRef} className="max-h-[72vh] overflow-auto rounded-2xl border border-white/8">
        <table className="border-separate border-spacing-0 text-xs" style={{ width: tableWidth, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: layout.code }} />
            <col style={{ width: layout.project }} />
            <col style={{ width: layout.status }} />
            <col style={{ width: layout.undated }} />
            {leaves.map((leaf) => (
              <col key={leaf.key} style={{ width: sizing.widths.get(leaf.key) }} />
            ))}
            <col style={{ width: layout.total }} />
          </colgroup>
          <thead>
            {headerCells.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-[11px]" style={{ height: HEADER_ROW_HEIGHT }}>
                {rowIndex === 0 && (
                  <>
                    <th
                      rowSpan={headerRows}
                      className="sticky left-0 top-0 z-40 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
                    >
                      Código
                    </th>
                    <th
                      rowSpan={headerRows}
                      className="sticky top-0 z-30 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
                      style={stickyLeft(layout.code)}
                    >
                      Proyecto
                    </th>
                    <th
                      rowSpan={headerRows}
                      className="sticky top-0 z-30 border-b border-r border-white/8 bg-ink-900 px-3 text-left uppercase tracking-[0.18em] text-white/50"
                      style={stickyLeft(layout.code + layout.project)}
                    >
                      Estado
                    </th>
                    <th
                      rowSpan={headerRows}
                      className="sticky top-0 z-20 border-b border-r border-white/8 bg-ink-900 px-2 text-center uppercase tracking-[0.12em] text-white/50"
                    >
                      Sin fecha
                    </th>
                  </>
                )}
                {row.map(({ node, colSpan, rowSpan, isLeaf, width }) => {
                  const isExpandedGroup = !isLeaf && expanded.has(node.key);
                  const canExpand = isLeaf && node.level !== "week" && density !== "weekly";
                  const label = fitLabel(node, width - (width >= 40 && clickableIcon(node, isLeaf, isExpandedGroup, density) ? 14 : 0));
                  const clickable = canExpand || isExpandedGroup;
                  const action = canExpand ? () => expand(node) : isExpandedGroup ? () => collapse(node) : undefined;

                  return (
                    <th
                      key={`${rowIndex}-${node.key}`}
                      colSpan={colSpan}
                      rowSpan={rowSpan}
                      title={`${node.title}${canExpand ? " · clic para ver detalle" : isExpandedGroup ? " · clic para contraer" : ""}`}
                      className={`sticky z-20 truncate border-b border-r border-white/8 bg-ink-900 px-1 text-center ${
                        node.level === "week" ? "font-normal text-white/50" : "font-semibold text-mint-400"
                      } ${clickable ? "cursor-pointer hover:bg-white/[0.08]" : ""}`}
                      style={{ top: rowIndex * HEADER_ROW_HEIGHT }}
                      onClick={action}
                      onKeyDown={(event) => {
                        if (action && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          action();
                        }
                      }}
                      tabIndex={clickable ? 0 : undefined}
                      aria-expanded={clickable ? isExpandedGroup : undefined}
                    >
                      {clickable && width >= 40 && (
                        isExpandedGroup ? (
                          <ChevronDown className="mr-0.5 inline h-3 w-3" />
                        ) : (
                          <ChevronRight className="mr-0.5 inline h-3 w-3" />
                        )
                      )}
                      {label}
                    </th>
                  );
                })}
                {rowIndex === 0 && (
                  <th
                    rowSpan={headerRows}
                    className="sticky top-0 z-20 border-b border-white/8 bg-ink-900 px-3 text-right uppercase tracking-[0.12em] text-white/50"
                  >
                    Total
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody>
            {report.filas.length ? (
              report.filas.map((row) => (
                <tr key={row.projectId} className="align-top text-white/75 hover:bg-white/[0.03]">
                  <td className="sticky left-0 z-10 border-b border-r border-white/6 bg-ink-900 px-3 py-2 font-medium text-white">
                    {row.codigoProyecto}
                  </td>
                  <td
                    className={`${narrow ? "" : "sticky z-10"} border-b border-r border-white/6 bg-ink-900 px-3 py-2`}
                    style={stickyLeft(layout.code)}
                    title={[row.proyecto, row.cliente, row.unidadNegocio, row.coordinador].filter(Boolean).join("\n")}
                  >
                    <p className="line-clamp-2 text-white/85">{row.proyecto}</p>
                    <p className="truncate text-[10px] text-white/40">{row.cliente ?? row.unidadNegocio ?? ""}</p>
                  </td>
                  <td
                    className={`${narrow ? "" : "sticky z-10"} border-b border-r border-white/6 bg-ink-900 px-2 py-2`}
                    style={stickyLeft(layout.code + layout.project)}
                    title={Object.entries(row.estados)
                      .map(([status, count]) => `${status}: ${count}`)
                      .join("\n")}
                  >
                    <span className={`inline-flex max-w-full truncate rounded-full border px-2 py-0.5 ${statusStyle(row.estado).chip}`}>
                      {row.estado ?? "-"}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(row.estados).map((status) => (
                        <span key={status} className={`h-1.5 w-1.5 rounded-full ${statusStyle(status).dot}`} />
                      ))}
                      {row.discrepancias > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-amberx-400"
                          title="Hitos cuyo Estatus del Excel no coincide con el estado calculado"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {row.discrepancias}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="cursor-pointer border-b border-r border-white/6 px-2 py-2 text-right hover:bg-white/[0.05]"
                    onClick={() =>
                      row.sinFecha.hitos.length &&
                      onSelect({
                        titulo: `${row.codigoProyecto} · ${row.proyecto}`,
                        subtitulo: "Hitos sin fecha de caja",
                        hitos: row.sinFecha.hitos,
                        marcadores: [],
                      })
                    }
                  >
                    {row.sinFecha.hitos.length ? (
                      <>
                        <AmountLines amounts={row.sinFecha.montos} currencies={currencies} mode="short" />
                        <p className="text-[10px] text-white/40">{row.sinFecha.hitos.length} hito(s)</p>
                      </>
                    ) : (
                      <span className="text-white/20">-</span>
                    )}
                  </td>
                  {leaves.map((leaf) => {
                    const cell = cellsByRow.get(row.projectId)?.get(leaf.key);
                    const width = sizing.widths.get(leaf.key) ?? 0;
                    const mode = modeFor(width);

                    return (
                      <td
                        key={leaf.key}
                        className={`border-b border-r border-white/6 ${mode === "bar" ? "px-0" : "px-1"} py-2 ${
                          cell ? "cursor-pointer hover:bg-white/[0.06]" : ""
                        }`}
                        onClick={() => openCell(row, cell, leaf)}
                        title={cell ? cellTooltip(cell, currencies, leaf) : undefined}
                      >
                        {cell && <CellContent cell={cell} currencies={currencies} mode={mode} aggregated={leaf.level !== "week"} />}
                      </td>
                    );
                  })}
                  <td className="border-b border-white/6 px-3 py-2 text-right font-medium text-white">
                    <AmountLines amounts={row.totales} currencies={currencies} mode="full" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={leaves.length + 5} className="py-10 text-center text-white/45">
                  No existen proyectos para el período y los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
          {report.filas.length > 0 && (
            <tfoot>
              <tr className="font-medium text-white">
                <td colSpan={3} className={`sticky bottom-0 z-40 border-t ${narrow ? "" : "left-0"} border-white/10 bg-ink-800 px-3 py-2`}>
                  Total general ({report.totalFilas} proyectos)
                </td>
                <td className="sticky bottom-0 z-20 border-t border-white/10 bg-ink-800 px-2 py-2 text-right">
                  <AmountLines amounts={report.totales.sinFecha} currencies={currencies} mode="short" />
                </td>
                {leaves.map((leaf) => {
                  const amounts = aggregateTotals(report.totales.porSemana, leaf, currencies);
                  const mode = modeFor(sizing.widths.get(leaf.key) ?? 0);

                  return (
                    <td
                      key={leaf.key}
                      className={`sticky bottom-0 z-20 border-r border-t border-white/10 bg-ink-800 py-2 text-right ${
                        mode === "bar" ? "px-0" : "px-1"
                      }`}
                      title={amounts ? currencies.map((currency) => formatMoney(amounts[currency], currency)).join("\n") : undefined}
                    >
                      {amounts && (mode === "full" || mode === "short") && (
                        <AmountLines amounts={amounts} currencies={currencies} mode={mode} />
                      )}
                    </td>
                  );
                })}
                <td className="sticky bottom-0 z-20 border-t border-white/10 bg-ink-800 px-3 py-2 text-right">
                  <AmountLines amounts={report.totales.general} currencies={currencies} mode="full" />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** Etiqueta que cabe en el ancho (estimación ~6.6 px por carácter a 11 px). */
function fitLabel(node: PeriodNode, width: number) {
  if (node.label.length * 6.6 + 10 <= width) return node.label;
  if (node.shortLabel.length * 6.6 + 6 <= width) return node.shortLabel;

  return "";
}

function clickableIcon(node: PeriodNode, isLeaf: boolean, isExpandedGroup: boolean, density: GridDensity) {
  return (isLeaf && node.level !== "week" && density !== "weekly") || isExpandedGroup;
}

function CellContent({
  cell,
  currencies,
  mode,
  aggregated,
}: {
  cell: WeekCell;
  currencies: CurrencyCode[];
  mode: CellMode;
  aggregated: boolean;
}) {
  const markerCodes = Array.from(new Set(cell.marcadores.map((marker) => marker.tipo)));
  const hasAmount = cell.hitos.length > 0;
  const topStatus = cell.estados[cell.estados.length - 1];

  if (mode === "bar") {
    return hasAmount ? (
      <div className={`mx-auto h-6 w-full rounded-sm ${statusStyle(topStatus).dot}`} />
    ) : (
      <div className="mx-auto h-6 w-full rounded-sm bg-white/15" />
    );
  }

  if (mode === "dot") {
    return (
      <div className="flex flex-col items-center gap-1">
        {hasAmount ? (
          <span className={`h-2.5 w-2.5 rounded-full ${statusStyle(topStatus).dot}`} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        )}
        {aggregated && hasAmount && <span className="text-[9px] text-white/45">{cell.hitos.length}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-right">
      {hasAmount && <AmountLines amounts={cell.montos} currencies={currencies} mode={mode} />}
      <div className="flex flex-wrap items-center justify-end gap-0.5">
        {cell.estados.map((status) => (
          <span key={status} className={`h-1.5 w-1.5 rounded-full ${statusStyle(status).dot}`} title={status} />
        ))}
        {aggregated && hasAmount && <span className="ml-1 text-[9px] text-white/45">{cell.hitos.length} hito(s)</span>}
      </div>
      {markerCodes.length > 0 && (
        <div className="flex flex-wrap justify-end gap-0.5">
          {mode === "full" ? (
            markerCodes.map((code) => (
              <span key={code} className="rounded border border-white/10 px-1 text-[9px] leading-4 text-white/55">
                {code}
              </span>
            ))
          ) : (
            <span className="text-[9px] text-white/45">{cell.marcadores.length} fecha(s)</span>
          )}
        </div>
      )}
    </div>
  );
}

function AmountLines({ amounts, currencies, mode }: { amounts: Amounts; currencies: CurrencyCode[]; mode: "full" | "short" }) {
  const lines = currencies.filter((currency) => amounts[currency]);

  if (!lines.length) {
    return <span className="text-white/25">0</span>;
  }

  return (
    <div className="space-y-0.5 whitespace-nowrap tabular-nums">
      {lines.map((currency) => (
        <p key={currency} className={currency === "USD" ? "text-tide-400" : "text-mint-400"}>
          {mode === "full" ? formatMoney(amounts[currency], currency) : formatMoneyCompact(amounts[currency], currency)}
        </p>
      ))}
    </div>
  );
}

function cellTooltip(cell: WeekCell, currencies: CurrencyCode[], item: PeriodNode) {
  const amounts = currencies
    .filter((currency) => cell.montos[currency])
    .map((currency) => formatMoney(cell.montos[currency], currency));
  const milestones = cell.hitos.slice(0, 12).map((hito) => `${hito.codigo ?? "-"} (${hito.estado})`);
  const more = cell.hitos.length > 12 ? [`… y ${cell.hitos.length - 12} hito(s) más`] : [];

  return [item.title, ...amounts, ...milestones, ...more, `${cell.marcadores.length} fecha(s) del archivo`].join("\n");
}
