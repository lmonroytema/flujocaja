import type { PeriodNode } from "./periods";
import type { CashFlowSummary, ExpenseAmounts, ExpenseRow } from "./types";

export type SummaryColumn = {
  node: PeriodNode;
  saldoInicial: number;
  ingresos: number;
  gastos: ExpenseAmounts;
  saldoFinal: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function emptyExpense(): ExpenseAmounts {
  return { pagado: 0, compromiso: 0, total: 0 };
}

/** Suma los gastos semanales de un período. */
export function sumExpenses(byWeek: Record<string, ExpenseAmounts>, weeks: string[]): ExpenseAmounts {
  const result = emptyExpense();

  for (const week of weeks) {
    const amounts = byWeek[week];

    if (!amounts) continue;

    result.pagado = round(result.pagado + amounts.pagado);
    result.compromiso = round(result.compromiso + amounts.compromiso);
    result.total = round(result.total + amounts.total);
  }

  return result;
}

export function expenseCell(row: ExpenseRow, node: PeriodNode): ExpenseAmounts | undefined {
  const found = node.weeks.some((week) => row.celdas[week]);

  return found ? sumExpenses(row.celdas, node.weeks) : undefined;
}

/**
 * Columnas del flujo: saldo inicial (el saldo en bancos para la primera, el saldo final de la anterior
 * para las demás) + ingresos − gastos = saldo final.
 */
export function buildSummaryColumns(summary: CashFlowSummary, nodes: PeriodNode[]): SummaryColumn[] {
  let balance = summary.saldoInicial.totalPen;

  return nodes.map((node) => {
    const ingresos = round(node.weeks.reduce((total, week) => total + (summary.ingresos.porSemana[week] ?? 0), 0));
    const gastos = sumExpenses(summary.gastos.porSemana, node.weeks);
    const saldoInicial = balance;
    const saldoFinal = round(saldoInicial + ingresos - gastos.total);
    balance = saldoFinal;

    return { node, saldoInicial, ingresos, gastos, saldoFinal };
  });
}
