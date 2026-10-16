import { create } from "zustand";

export type RangePreset = "current" | "next3" | "next6" | "next12" | "year" | "custom" | "all";

type CashFlowStore = {
  year: number;
  month: number;
  setPeriod: (year: number, month: number) => void;
  /** Rango del flujo semanal (formato YYYY-MM). */
  preset: RangePreset;
  from: string;
  to: string;
  setRange: (preset: RangePreset, from?: string, to?: string) => void;
  /** Se incrementa tras cada importación para forzar el refresco del reporte. */
  reportVersion: number;
  bumpReportVersion: () => void;
};

const now = new Date();

export function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(monthKey: string, months: number) {
  const [year, month] = monthKey.split("-").map(Number);

  return toMonthKey(new Date(year, month - 1 + months, 1));
}

export function resolvePresetRange(preset: RangePreset, from: string, to: string) {
  const current = toMonthKey(new Date());

  switch (preset) {
    case "current":
      return { from: current, to: current };
    case "next3":
      return { from: current, to: addMonths(current, 2) };
    case "next6":
      return { from: current, to: addMonths(current, 5) };
    case "next12":
      return { from: current, to: addMonths(current, 11) };
    case "year": {
      const year = new Date().getFullYear();

      return { from: `${year}-01`, to: `${year}-12` };
    }
    default:
      return { from, to };
  }
}

export const useCashFlowStore = create<CashFlowStore>((set) => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  setPeriod: (year, month) => set({ year, month }),
  preset: "current",
  from: toMonthKey(now),
  to: toMonthKey(now),
  setRange: (preset, from, to) =>
    set((state) => {
      const range = resolvePresetRange(preset, from ?? state.from, to ?? state.to);

      return { preset, from: range.from, to: range.to };
    }),
  reportVersion: 0,
  bumpReportVersion: () => set((state) => ({ reportVersion: state.reportVersion + 1 })),
}));
