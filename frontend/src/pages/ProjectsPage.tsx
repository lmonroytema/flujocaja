import { useEffect, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { DataPagination, type PaginationMeta } from "@/components/ui/DataPagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatMoney, type CurrencyCode } from "@/utils/format";

type ProjectRow = {
  id: number;
  project_code: string;
  project_name: string;
  parent_project_code: string | null;
  parent_project_name: string | null;
  client_name: string | null;
  currency_code: CurrencyCode;
  actual_cost_price: string | number | null;
  business_unit: string;
  status_reason: string;
  project_coordinator: string | null;
  payment_milestones_count: number;
};

type ProjectFilters = {
  code: string;
  project: string;
  client: string;
  businessUnit: string;
  status: string;
  coordinator: string;
};

type ProjectsResponse = {
  data: ProjectRow[];
  meta: PaginationMeta;
  filterOptions: {
    businessUnits: string[];
    statusReasons: string[];
    clients: string[];
    coordinators: string[];
  };
};

const initialFilters: ProjectFilters = {
  code: "",
  project: "",
  client: "",
  businessUnit: "",
  status: "",
  coordinator: "",
};

export default function ProjectsPage() {
  const [response, setResponse] = useState<ProjectsResponse | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedFilters = useDebouncedValue(filters, 350);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    if (debouncedFilters.code) params.set("code", debouncedFilters.code);
    if (debouncedFilters.project) params.set("project", debouncedFilters.project);
    if (debouncedFilters.client) params.set("client", debouncedFilters.client);
    if (debouncedFilters.businessUnit) params.set("business_unit", debouncedFilters.businessUnit);
    if (debouncedFilters.status) params.set("status", debouncedFilters.status);
    if (debouncedFilters.coordinator) params.set("coordinator", debouncedFilters.coordinator);

    setLoading(true);
    setError("");

    api
      .get<ProjectsResponse>(`/proyectos?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setResponse(result);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setResponse(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, page, perPage]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Maestro consolidado</p>
        <h2 className="mt-2 font-display text-4xl text-white">Proyectos importados</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Vista maestra para validar el cruce con hitos, revisar responsables, clientes y estados operativos.
        </p>
      </div>

      {error ? (
        <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>
      ) : (
        <Panel className="space-y-6 overflow-hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.24em] text-white/50">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros tipo Excel
              </div>
              <p className="text-sm text-white/60">
                Filtra por columna, navega por páginas y valida el maestro sin cargar todo el dataset en el navegador.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                Registros: <span className="text-white">{response?.meta.total ?? 0}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                Filtros activos: <span className="text-white">{activeFilters}</span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                onClick={clearFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.22em] text-white/40">
                  <th className="pb-3 pr-3">Código</th>
                  <th className="pb-3 pr-3">Proyecto</th>
                  <th className="pb-3 pr-3">Proyecto origen</th>
                  <th className="pb-3 pr-3">Cliente</th>
                  <th className="pb-3 pr-3">Unidad</th>
                  <th className="pb-3 pr-3">Estado</th>
                  <th className="pb-3 pr-3">Coordinador</th>
                  <th className="pb-3 pr-3 text-right">Coste real</th>
                  <th className="pb-3 text-right">Hitos</th>
                </tr>
                <tr className="border-b border-white/8 text-left text-white/60">
                  <th className="pb-4 pr-3">
                    <HeaderInput
                      icon={Search}
                      placeholder="Filtrar"
                      value={filters.code}
                      onChange={(value) => handleFilterChange("code", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3">
                    <HeaderInput
                      placeholder="Proyecto"
                      value={filters.project}
                      onChange={(value) => handleFilterChange("project", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3" />
                  <th className="pb-4 pr-3">
                    <HeaderInput
                      placeholder="Cliente"
                      value={filters.client}
                      onChange={(value) => handleFilterChange("client", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3">
                    <HeaderSelect
                      value={filters.businessUnit}
                      placeholder="Todas"
                      options={response?.filterOptions.businessUnits ?? []}
                      onChange={(value) => handleFilterChange("businessUnit", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3">
                    <HeaderSelect
                      value={filters.status}
                      placeholder="Todos"
                      options={response?.filterOptions.statusReasons ?? []}
                      onChange={(value) => handleFilterChange("status", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3">
                    <HeaderInput
                      placeholder="Coordinador"
                      value={filters.coordinator}
                      onChange={(value) => handleFilterChange("coordinator", value)}
                    />
                  </th>
                  <th className="pb-4 pr-3" />
                  <th className="pb-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-white/6">
                {loading && !response ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-white/45">
                      Cargando proyectos...
                    </td>
                  </tr>
                ) : response?.data.length ? (
                  response.data.map((project) => (
                    <tr key={project.id} className="text-white/75 transition hover:bg-white/[0.03]">
                      <td className="py-4 pr-3 font-medium text-white">{project.project_code}</td>
                      <td className="py-4 pr-3">{project.project_name}</td>
                      <td className="py-4 pr-3">
                        {project.parent_project_code || project.parent_project_name ? (
                          <>
                            <span className="font-medium text-white">{project.parent_project_code}</span>
                            {project.parent_project_name ? (
                              <span className="block text-xs text-white/50">{project.parent_project_name}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                      <td className="py-4 pr-3">{project.client_name ?? "Sin cliente"}</td>
                      <td className="py-4 pr-3">{project.business_unit}</td>
                      <td className="py-4 pr-3">{project.status_reason}</td>
                      <td className="py-4 pr-3">{project.project_coordinator ?? "Sin asignar"}</td>
                      <td className="whitespace-nowrap py-4 pr-3 text-right">
                        {project.actual_cost_price !== null && project.actual_cost_price !== "" ? (
                          formatMoney(Number(project.actual_cost_price), project.currency_code)
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                      <td className="py-4 text-right font-medium text-white">{project.payment_milestones_count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-white/45">
                      No hay proyectos que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {response ? (
            <DataPagination
              meta={response.meta}
              onPageChange={setPage}
              onPerPageChange={(value) => {
                setPerPage(value);
                setPage(1);
              }}
            />
          ) : null}
        </Panel>
      )}
    </div>
  );
}

type HeaderInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  icon?: typeof Search;
};

function HeaderInput({ value, placeholder, onChange, icon: Icon }: HeaderInputProps) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
      {Icon ? <Icon className="h-4 w-4 text-white/40" /> : null}
      <input
        className="w-full bg-transparent outline-none placeholder:text-white/30"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type HeaderSelectProps = {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
};

function HeaderSelect({ value, placeholder, options, onChange }: HeaderSelectProps) {
  return (
    <select
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" className="bg-slate-900 text-white">
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option} className="bg-slate-900 text-white">
          {option}
        </option>
      ))}
    </select>
  );
}
