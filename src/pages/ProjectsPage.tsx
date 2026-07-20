import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";

type ProjectRow = {
  id: number;
  project_code: string;
  project_name: string;
  client_name: string | null;
  business_unit: string;
  status_reason: string;
  project_coordinator: string | null;
  payment_milestones_count: number;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<ProjectRow[]>("/proyectos").then(setProjects).catch(() => setProjects([]));
  }, []);

  const filteredProjects = useMemo(() => {
    const term = search.toLowerCase();

    return projects.filter((project) =>
      [project.project_code, project.project_name, project.client_name, project.business_unit, project.status_reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [projects, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Maestro consolidado</p>
        <h2 className="mt-2 font-display text-4xl text-white">Proyectos importados</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Vista maestra para validar el cruce con hitos, revisar responsables, clientes y estados operativos.
        </p>
      </div>

      <Panel className="space-y-6">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent outline-none placeholder:text-white/35"
            placeholder="Buscar por código, proyecto, cliente o unidad"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="pb-3">Código</th>
                <th className="pb-3">Proyecto</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Unidad</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Coordinador</th>
                <th className="pb-3 text-right">Hitos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="text-white/75">
                  <td className="py-3 font-medium text-white">{project.project_code}</td>
                  <td className="py-3">{project.project_name}</td>
                  <td className="py-3">{project.client_name ?? "Sin cliente"}</td>
                  <td className="py-3">{project.business_unit}</td>
                  <td className="py-3">{project.status_reason}</td>
                  <td className="py-3">{project.project_coordinator ?? "Sin asignar"}</td>
                  <td className="py-3 text-right">{project.payment_milestones_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
