import { create } from "zustand";

type CashFlowStore = {
  year: number;
  month: number;
  setPeriod: (year: number, month: number) => void;
};

const now = new Date();

export const useCashFlowStore = create<CashFlowStore>((set) => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  setPeriod: (year, month) => set({ year, month }),
}));
