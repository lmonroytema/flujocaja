export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 2,
  }).format(value);
}

export type CurrencyCode = "USD" | "PEN";

const currencySymbols: Record<CurrencyCode, string> = {
  USD: "US$",
  PEN: "S/",
};

/** Monto con símbolo de su moneda (sin conversión). */
export function formatMoney(value: number, currency: CurrencyCode) {
  return `${currencySymbols[currency]} ${new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

/** Monto abreviado (1,2 k / 3,4 M) para la vista compacta. */
export function formatMoneyCompact(value: number, currency: CurrencyCode) {
  return `${currencySymbols[currency]} ${new Intl.NumberFormat("es-PE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

export function formatMonthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
