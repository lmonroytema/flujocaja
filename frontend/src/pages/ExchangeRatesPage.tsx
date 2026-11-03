import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { useCashFlowStore } from "@/store/useCashFlowStore";

type PeriodRate = {
  id: number;
  label: string;
  rates: Array<{
    id: number;
    currencyCode: string;
    rateToPen: number;
  }>;
};

export default function ExchangeRatesPage() {
  const { year, month } = useCashFlowStore();
  const [periods, setPeriods] = useState<PeriodRate[]>([]);
  const [message, setMessage] = useState("");

  const loadPeriods = useCallback(() => {
    api.get<PeriodRate[]>(`/tipos-cambio?year=${year}&month=${month}`).then(setPeriods).catch(() => setPeriods([]));
  }, [month, year]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  async function saveRate(rateId: number, rateToPen: number) {
    await api.put(`/tipos-cambio/${rateId}`, { rate_to_pen: rateToPen });
    setMessage("Tipo de cambio actualizado.");
    loadPeriods();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Configuración</p>
        <h2 className="mt-2 font-display text-4xl text-white">Tipos de cambio semanales</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Ajusta la tasa USD a PEN por cada semana laboral del período activo para que el reporte replique el criterio
          financiero esperado.
        </p>
      </div>

      {message && <Panel className="border-mint-400/30 text-mint-400">{message}</Panel>}

      <div className="grid gap-4 xl:grid-cols-2">
        {periods.map((period) => {
          const usdRate = period.rates.find((rate) => rate.currencyCode === "USD");

          return (
            <Panel key={period.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Semana</p>
                  <h3 className="mt-2 font-display text-2xl text-white">{period.label}</h3>
                </div>
                <Save className="h-5 w-5 text-mint-400" />
              </div>

              {usdRate && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div>
                    <p className="text-xs text-white/45">USD a PEN</p>
                    <input
                      className="mt-2 w-40 rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      type="number"
                      step="0.0001"
                      defaultValue={usdRate.rateToPen}
                      onBlur={(event) => saveRate(usdRate.id, Number(event.target.value))}
                    />
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
