import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { formatMoney, formatShortDate } from "@/utils/format";
import { statusStyle, type Marker, type MilestoneDetail } from "./types";

export type CellSelection = {
  titulo: string;
  subtitulo: string;
  hitos: MilestoneDetail[];
  marcadores: Marker[];
};

type MilestoneCellPopoverProps = {
  selection: CellSelection | null;
  onClose: () => void;
};

/** Panel de detalle de una celda (semana o "Sin fecha") de un proyecto. */
export function MilestoneCellPopover({ selection, onClose }: MilestoneCellPopoverProps) {
  useEffect(() => {
    if (!selection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, selection]);

  if (!selection) {
    return null;
  }

  // Se monta en <body> para que ningún ancestro con backdrop-filter/transform limite el overlay "fixed".
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/10 bg-ink-900 p-6 text-white shadow-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-mint-400">{selection.subtitulo}</p>
            <h3 className="mt-2 font-display text-2xl">{selection.titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/70 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selection.hitos.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Hitos con monto en este período</p>
            {selection.hitos.map((hito) => (
              <div key={hito.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {hito.codigo ?? "-"} · {hito.nombre}
                  </span>
                  <span className="font-medium">{formatMoney(hito.monto, hito.moneda)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 ${statusStyle(hito.estado).chip}`}>{hito.estado}</span>
                  {hito.responsable && <span className="text-white/55">Responsable: {hito.responsable}</span>}
                  {hito.factura && <span className="text-white/55">Factura: {hito.factura}</span>}
                  {hito.fechaCaja && <span className="text-white/55">Fecha de caja: {formatShortDate(hito.fechaCaja)}</span>}
                  {hito.discrepancia && (
                    <span className="inline-flex items-center gap-1 text-amberx-400">
                      <AlertTriangle className="h-3 w-3" /> Excel indica "{hito.estadoExcel}"
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/55">
                  {Object.entries(hito.fechas)
                    .filter(([, value]) => value)
                    .map(([code, value]) => (
                      <span key={code} className="rounded-md border border-white/10 px-2 py-0.5">
                        {code}: {formatShortDate(value)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selection.marcadores.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Fechas del archivo en este período</p>
            <ul className="mt-3 space-y-1 text-sm text-white/75">
              {selection.marcadores.map((marker, index) => (
                <li key={`${marker.tipo}-${marker.hito}-${index}`}>
                  <strong className="text-white">{marker.tipo}</strong> {marker.etiqueta} · {marker.hito ?? "-"} ·{" "}
                  {formatShortDate(marker.fecha)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
