import { describe, expect, it } from "vitest";
import {
  aggregateCell,
  aggregateTotals,
  buildPeriodTree,
  nodesAtLevel,
  pickBaseLevel,
  priorityKeys,
  sizeColumns,
  visibleLeaves,
} from "./periods";
import type { MonthGroup, WeeklyRow } from "./types";

function month(anio: number, mes: number, mondays: number[]): MonthGroup {
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    clave: `${anio}-${pad(mes)}`,
    anio,
    mes,
    etiqueta: `Mes ${mes} ${anio}`,
    semanas: mondays.map((day, index) => ({
      clave: `${anio}-${pad(mes)}-${pad(day)}`,
      indice: index + 1,
      fechaInicio: `${anio}-${pad(mes)}-${pad(day)}`,
      fechaFin: `${anio}-${pad(mes)}-${pad(day + 4)}`,
      etiqueta: `${day} AL ${day + 4}`,
    })),
  };
}

const months = [month(2025, 12, [1, 8, 15, 22]), month(2026, 1, [5, 12, 19, 26]), month(2026, 2, [2, 9, 16, 23])];

const row = {
  projectId: 1,
  celdas: {
    "2025-12-08": { montos: { USD: 100, PEN: 0 }, hitos: [{ id: 1 }], marcadores: [], estados: ["Cobrado"] },
    "2026-01-12": { montos: { USD: 50.5, PEN: 10 }, hitos: [{ id: 2 }], marcadores: [{ tipo: "FEP" }], estados: ["Facturado"] },
    "2026-01-26": { montos: { USD: 0, PEN: 20 }, hitos: [{ id: 3 }], marcadores: [], estados: ["No iniciado"] },
  },
} as unknown as WeeklyRow;

describe("periods", () => {
  const tree = buildPeriodTree(months);

  it("builds year → quarter → month → week", () => {
    expect(tree.map((node) => node.key)).toEqual(["2025", "2026"]);
    expect(nodesAtLevel(tree, "quarter").map((node) => node.key)).toEqual(["2025-T4", "2026-T1"]);
    expect(nodesAtLevel(tree, "week")).toHaveLength(12);
    expect(tree[1].weeks).toHaveLength(8);
  });

  it("picks the finest level that fits", () => {
    expect(pickBaseLevel(tree, 12 * 76, 76)).toBe("week");
    expect(pickBaseLevel(tree, 3 * 76, 76)).toBe("month");
    expect(pickBaseLevel(tree, 2 * 76, 76)).toBe("quarter");
    expect(pickBaseLevel(tree, 10, 76)).toBe("year");
  });

  it("expands only the clicked period in place", () => {
    const leaves = visibleLeaves(tree, "month", new Set(["2026-01"]));
    expect(leaves.map((leaf) => leaf.key)).toEqual(["2025-12", "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02"]);
  });

  it("aggregates amounts per currency, milestones and statuses", () => {
    const january = nodesAtLevel(tree, "month")[1];
    const cell = aggregateCell(row, january, ["USD", "PEN"]);
    expect(cell?.montos).toEqual({ USD: 50.5, PEN: 30 });
    expect(cell?.hitos).toHaveLength(2);
    expect(cell?.estados).toEqual(["No iniciado", "Facturado"]);
    expect(aggregateCell(row, nodesAtLevel(tree, "month")[2], ["USD", "PEN"])).toBeUndefined();

    const totals = aggregateTotals({ "2025-12-08": { USD: 1, PEN: 2 }, "2026-02-09": { USD: 3, PEN: 4 } }, tree[1], ["USD", "PEN"]);
    expect(totals).toEqual({ USD: 3, PEN: 4 });
  });

  it("gives expanded columns priority and shrinks collapsed siblings", () => {
    const expanded = new Set(["2026-01"]);
    const leaves = visibleLeaves(tree, "month", expanded);
    const sizing = sizeColumns(leaves, expanded, 400, { min: 76, minCollapsed: 28, max: 170 });
    expect(sizing.widths.get("2026-01-05")).toBe(76);
    expect(sizing.widths.get("2025-12")).toBe(48);
    expect(sizing.overflow).toBe(false);

    const tight = sizeColumns(leaves, expanded, 200, { min: 76, minCollapsed: 28, max: 170 });
    expect(tight.overflow).toBe(true);
  });

  it("only the deepest expansion keeps priority; collapsed siblings shrink", () => {
    const expanded = new Set(["2026", "2026-T1", "2026-01"]);
    const leaves = visibleLeaves(tree, "year", expanded);
    expect(leaves.map((leaf) => leaf.key)).toEqual(["2025", "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02"]);
    const keys = priorityKeys(leaves, expanded);
    expect([...keys]).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  });
});
