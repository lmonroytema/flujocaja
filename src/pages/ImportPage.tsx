import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileUp, RefreshCcw } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { useCashFlowStore } from "@/store/useCashFlowStore";

type ImportSummary = {
  modo?: string;
  estados?: Record<string, number>;
  hitosSinFecha?: number;
  discrepancias?: number;
  detalleDiscrepancias?: Array<{ fila: number; proyecto: string; hito: string | null; estadoExcel: string; estadoCalculado: string }>;
  columnasOpcionalesPresentes?: string[];
  proyectosEliminados?: number;
  hitosEliminadosEnCascada?: number;
};

type ImportBatch = {
  id: number;
  source_type: string;
  original_file_name: string;
  sheet_name: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  deleted_rows?: number;
  imported_at: string;
  errors?: string[];
  summary?: ImportSummary | null;
};

type ImportCardProps = {
  title: string;
  endpoint: string;
  description: string;
  onImported: () => void;
};

function ImportCard({ title, endpoint, description, onImported }: ImportCardProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportBatch | null>(null);
  const bumpReportVersion = useCashFlowStore((state) => state.bumpReportVersion);

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const response = await api.postFile<ImportBatch>(endpoint, file);
      setMessage(
        response.source_type === "milestones"
          ? `Reemplazo total listo: ${response.deleted_rows ?? 0} hitos anteriores eliminados, ${response.inserted_rows} cargados, ${response.skipped_rows} omitidos.`
          : `Reemplazo total listo: ${response.inserted_rows} nuevos, ${response.updated_rows} actualizados, ${response.deleted_rows ?? 0} eliminados, ${response.skipped_rows} omitidos.`,
      );
      setResult(response);
      bumpReportVersion();
      onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo importar el archivo.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-mint-400">{title}</p>
          <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>
        </div>
        <div className="rounded-2xl border border-mint-400/20 bg-mint-400/10 p-3 text-mint-400">
          <FileUp className="h-5 w-5" />
        </div>
      </div>

      <label className="mt-6 flex cursor-pointer items-center justify-center rounded-[24px] border border-dashed border-white/12 bg-white/[0.025] px-4 py-8 text-sm text-white/65 transition hover:border-mint-400/35 hover:bg-white/[0.05]">
        <input className="hidden" type="file" accept=".xlsx,.xls" onChange={handleFileSelection} />
        {loading ? "Procesando archivo..." : "Seleccionar archivo Excel"}
      </label>

      {message && <p className="mt-4 text-sm text-white/70">{message}</p>}
      {result && <ImportResultDetail batch={result} />}
    </Panel>
  );
}

function ImportResultDetail({ batch }: { batch: ImportBatch }) {
  const summary = batch.summary ?? {};
  const mismatches = summary.detalleDiscrepancias ?? [];

  return (
    <div className="mt-4 space-y-3 text-sm text-white/70">
      {summary.estados && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.estados).map(([status, total]) => (
            <span key={status} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
              {status}: <strong className="text-white">{total}</strong>
            </span>
          ))}
          {summary.hitosSinFecha !== undefined && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
              Sin fecha de caja: <strong className="text-white">{summary.hitosSinFecha}</strong>
            </span>
          )}
        </div>
      )}

      {batch.source_type === "projects" && (summary.hitosEliminadosEnCascada ?? 0) > 0 && (
        <p className="text-amberx-400">
          Se eliminaron {summary.hitosEliminadosEnCascada} hitos de proyectos que ya no vienen en el archivo.
        </p>
      )}

      {mismatches.length > 0 && (
        <details className="rounded-2xl border border-amberx-500/30 bg-amberx-500/5 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-amberx-400">
            <AlertTriangle className="h-4 w-4" />
            {summary.discrepancias} hito(s) con Estatus del Excel distinto al estado calculado por fechas
          </summary>
          <div className="mt-3 max-h-60 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-white/45">
                <tr>
                  <th className="pb-2">Fila</th>
                  <th className="pb-2">Proyecto</th>
                  <th className="pb-2">Hito</th>
                  <th className="pb-2">Estatus Excel</th>
                  <th className="pb-2">Estado calculado</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map((item) => (
                  <tr key={`${item.fila}-${item.hito}`}>
                    <td className="py-1">{item.fila}</td>
                    <td className="py-1">{item.proyecto}</td>
                    <td className="py-1">{item.hito ?? "-"}</td>
                    <td className="py-1">{item.estadoExcel}</td>
                    <td className="py-1 text-white">{item.estadoCalculado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {batch.errors && batch.errors.length > 0 && (
        <details className="rounded-2xl border border-white/10 p-3">
          <summary className="cursor-pointer">{batch.errors.length} observación(es) de la carga</summary>
          <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs">
            {batch.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {batch.source_type === "milestones" && (
        <Link
          to="/flujo-caja/ingresos"
          className="inline-flex items-center gap-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-2 text-white hover:bg-mint-400/20"
        >
          Ver flujo de caja actualizado
        </Link>
      )}
    </div>
  );
}

export default function ImportPage() {
  const [history, setHistory] = useState<ImportBatch[]>([]);

  const loadHistory = () => {
    api.get<ImportBatch[]>("/importaciones").then(setHistory).catch(() => setHistory([]));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Control de carga</p>
          <h2 className="mt-2 font-display text-4xl text-white">Importaciones Project Hub</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Sube primero el maestro de proyectos y luego el libro de hitos. Cada carga reemplaza por completo la
            información anterior, de modo que el flujo refleja el estado a la fecha de importación.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.08]"
        >
          <RefreshCcw className="h-4 w-4" />
          Actualizar historial
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ImportCard
          title="Proyectos"
          endpoint="/importaciones/proyectos"
          description="Carga el libro con la hoja SP Proyectos Producción. El nombre del archivo puede variar."
          onImported={loadHistory}
        />
        <ImportCard
          title="Hitos de pago"
          endpoint="/importaciones/hitos"
          description="Carga el libro Hito de pago de proyectos. El sistema vincula automáticamente contra el código del proyecto."
          onImported={loadHistory}
        />
      </div>

      <Panel>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-mint-400" />
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Trazabilidad</p>
            <h3 className="mt-2 font-display text-2xl text-white">Historial reciente</h3>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Archivo</th>
                <th className="pb-3">Hoja</th>
                <th className="pb-3 text-right">Insertadas</th>
                <th className="pb-3 text-right">Actualizadas</th>
                <th className="pb-3 text-right">Eliminadas</th>
                <th className="pb-3 text-right">Omitidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {history.map((item) => (
                <tr key={item.id} className="text-white/75">
                  <td className="py-3 capitalize">{item.source_type}</td>
                  <td className="py-3">{item.original_file_name}</td>
                  <td className="py-3">{item.sheet_name}</td>
                  <td className="py-3 text-right">{item.inserted_rows}</td>
                  <td className="py-3 text-right">{item.updated_rows}</td>
                  <td className="py-3 text-right">{item.deleted_rows ?? 0}</td>
                  <td className="py-3 text-right">{item.skipped_rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
