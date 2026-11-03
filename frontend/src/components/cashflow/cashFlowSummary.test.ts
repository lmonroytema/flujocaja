import { describe, expect, it } from "vitest";
import { buildHeaderRows, buildPeriodTree, nodesAtLevel, visibleLeaves } from "./periods";
import { buildSummaryColumns, expenseCell } from "./cashFlowSummary";
import type { CashFlowSummary, MonthGroup } from "./types";

function month(anio: number, mes: number, mondays: string[]): MonthGroup {
  return {
    clave: `${anio}-${String(mes).padStart(2, "0")}`,
    anio,
    mes,
    etiqueta: `M${mes} ${anio}`,
    semanas: mondays.map((monday, index) => ({
      clave: monday,
      indice: index + 1,
      fechaInicio: monday,
      fechaFin: monday,
      etiqueta: monday,
    })),
  };
}

const summary: CashFlowSummary = {
  desde: "2026-07",
  hasta: "2026-08",
  alcance: "rango",
  monedaReporte: "PEN",
  meses: [month(2026, 7, ["2026-07-06", "2026-07-13"]), month(2026, 8, ["2026-08-03"])],
  tiposCambio: {},
  saldoInicial: { fechaInicio: "2026-07-06", totalPen: 1000, cuentas: [], cuentasSinSaldo: 0 },
  ingresos: { porSemana: { "2026-07-06": 500, "2026-07-13": 0, "2026-08-03": 200 }, total: 700, sinFecha: { PEN: 0, USD: 0 } },
  gastos: {
    disponible: true,
    mensaje: null,
    porSemana: {
      "2026-07-13": { pagado: 300, compromiso: 100, total: 400 },
      "2026-08-03": { pagado: 0, compromiso: 2000, total: 2000 },
    },
    totales: { pagado: 300, compromiso: 2100, total: 2400 },
    filas: [
      {
        clave: "P-1|Repuestos",
        proyectoCodigo: "P-1",
        proyecto: "P-1",
        categoria: "Repuestos",
        celdas: { "2026-07-13": { pagado: 300, compromiso: 100, total: 400 } },
        totales: { pagado: 300, compromiso: 100, total: 400 },
      },
    ],
  },
};

describe("buildSummaryColumns", () => {
  it("encadena el saldo final de cada semana como saldo inicial de la siguiente", () => {
    const tree = buildPeriodTree(summary.meses);
    const columns = buildSummaryColumns(summary, nodesAtLevel(tree, "week"));

    expect(columns.map((column) => [column.saldoInicial, column.ingresos, column.gastos.total, column.saldoFinal])).toEqual([
      [1000, 500, 0, 1500],
      [1500, 0, 400, 1100],
      [1100, 200, 2000, -700],
    ]);
  });

  it("agrupa por mes, trimestre y año con el mismo saldo final", () => {
    const tree = buildPeriodTree(summary.meses);
    const months = buildSummaryColumns(summary, nodesAtLevel(tree, "month"));
    const years = buildSummaryColumns(summary, nodesAtLevel(tree, "year"));

    expect(months.map((column) => column.saldoFinal)).toEqual([1100, -700]);
    expect(months[0].gastos).toEqual({ pagado: 300, compromiso: 100, total: 400 });
    expect(years).toHaveLength(1);
    expect(years[0]).toMatchObject({ saldoInicial: 1000, ingresos: 700, saldoFinal: -700 });
  });

  it("suma el detalle de gastos por período y deja vacío lo que no tiene movimiento", () => {
    const tree = buildPeriodTree(summary.meses);
    const [july, august] = nodesAtLevel(tree, "month");

    expect(expenseCell(summary.gastos.filas[0], july)).toEqual({ pagado: 300, compromiso: 100, total: 400 });
    expect(expenseCell(summary.gastos.filas[0], august)).toBeUndefined();
  });
});

describe("columnas expandibles del detalle de gastos", () => {
  it("al expandir un mes muestra sus semanas bajo el encabezado del mes", () => {
    const tree = buildPeriodTree(summary.meses);
    const leaves = visibleLeaves(tree, "month", new Set(["2026-07"]));

    expect(leaves.map((leaf) => leaf.key)).toEqual(["2026-07-06", "2026-07-13", "2026-08"]);

    const rows = buildHeaderRows(leaves, 1, 3, () => 100);

    expect(rows[1].map((cell) => [cell.node.key, cell.colSpan, cell.isLeaf])).toEqual([
      ["2026-07", 2, false],
      ["2026-08", 1, true],
    ]);
    expect(rows[2].map((cell) => cell.node.key)).toEqual(["2026-07-06", "2026-07-13"]);
    expect(expenseCell(summary.gastos.filas[0], leaves[1])).toEqual({ pagado: 300, compromiso: 100, total: 400 });
  });
});

describe("saldo encadenado con columnas expandidas", () => {
  it("el saldo final de cada período (semana o mes) es el saldo inicial del siguiente", () => {
    const tree = buildPeriodTree(summary.meses);
    const leaves = visibleLeaves(tree, "month", new Set(["2026-07"]));
    const columns = buildSummaryColumns(summary, leaves);

    expect(columns.map((column) => [column.node.key, column.saldoInicial, column.saldoFinal])).toEqual([
      ["2026-07-06", 1000, 1500],
      ["2026-07-13", 1500, 1100],
      ["2026-08", 1100, -700],
    ]);
  });
});
