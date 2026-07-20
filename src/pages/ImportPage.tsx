import { useEffect, useState } from "react";
import { CheckCircle2, FileUp, RefreshCcw } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";

type ImportBatch = {
  id: number;
  source_type: string;
  original_file_name: string;
  sheet_name: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  imported_at: string;
  errors?: string[];
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

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await api.postFile<ImportBatch>(endpoint, file);
      setMessage(`Importación lista: ${response.inserted_rows} nuevas y ${response.updated_rows} actualizadas.`);
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
    </Panel>
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
            Sube primero el maestro de proyectos y luego el libro de hitos. El sistema hace upsert por identificadores
            externos y registra trazabilidad por lote.
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
