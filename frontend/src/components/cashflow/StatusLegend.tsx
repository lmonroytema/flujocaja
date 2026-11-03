import { statusStyle, type StatusInfo } from "./types";

type StatusLegendProps = {
  statuses: StatusInfo[];
  markers: Array<{ codigo: string; etiqueta: string }>;
};

export function StatusLegend({ statuses, markers }: StatusLegendProps) {
  return (
    <div className="space-y-3 text-xs text-white/65">
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <span
            key={status.estado}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${statusStyle(status.estado).chip}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusStyle(status.estado).dot}`} />
            {status.orden}. {status.estado}
            <span className="text-white/45">· {status.responsable}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {markers.map((marker) => (
          <span key={marker.codigo} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5" title={marker.etiqueta}>
            <strong className="text-white/85">{marker.codigo}</strong> {marker.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
