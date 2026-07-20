import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type DataPaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

export function DataPagination({
  meta,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: DataPaginationProps) {
  const pages = buildVisiblePages(meta.current_page, meta.last_page);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-t border-white/8 pt-4 text-sm text-white/65 xl:flex-row xl:items-center xl:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Mostrando <span className="text-white">{meta.from ?? 0}</span>-
          <span className="text-white">{meta.to ?? 0}</span> de{" "}
          <span className="text-white">{meta.total}</span> registros
        </span>

        <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/70">
          <span>Filas</span>
          <select
            className="bg-transparent text-white outline-none"
            value={meta.per_page}
            onChange={(event) => onPerPageChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option} className="bg-slate-900 text-white">
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(meta.current_page - 1)}
          disabled={meta.current_page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>

        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-white/40">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={cn(
                "min-w-10 rounded-2xl border px-3 py-2 transition",
                page === meta.current_page
                  ? "border-mint-400/60 bg-mint-400/15 text-white"
                  : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]",
              )}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onPageChange(meta.current_page + 1)}
          disabled={meta.current_page >= meta.last_page}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function buildVisiblePages(currentPage: number, lastPage: number): Array<number | "ellipsis"> {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, lastPage, currentPage - 1, currentPage, currentPage + 1]);
  const normalizedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= lastPage)
    .sort((left, right) => left - right);

  const visiblePages: Array<number | "ellipsis"> = [];

  normalizedPages.forEach((page, index) => {
    const previousPage = normalizedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      visiblePages.push("ellipsis");
    }

    visiblePages.push(page);
  });

  return visiblePages;
}
