import { useMemo, useState } from "react";
import { FilePenLine, FileText, HandCoins, Search, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/utils/api";
import { formatCurrency } from "@/utils/format";

type FinanceRow = {
  id: number | string;
  fecha?: string | null;
  importe?: number | string | null;
  numero_factura?: string | null;
  descripcion?: string | null;
  etapa?: string | null;
};

type OrderFinanceResponse = {
  compromisos: FinanceRow[];
  facturados: FinanceRow[];
  pagados: FinanceRow[];
  summary: {
    comprometido: number;
    facturado: number;
    pagado: number;
    saldo_por_facturar: number;
    saldo_por_pagar: number;
  };
};

type FormState = {
  fecha: string;
  importe: string;
  numeroFactura: string;
};

function buildEmptyForm(): FormState {
  return {
    fecha: "",
    importe: "",
    numeroFactura: "",
  };
}

function isPositiveAmount(value: string): boolean {
  return Number(value) > 0;
}

export default function PurchaseOrderFinancePage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [activeOrder, setActiveOrder] = useState("");
  const [report, setReport] = useState<OrderFinanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invoiceForm, setInvoiceForm] = useState<FormState>(buildEmptyForm);
  const [paymentForm, setPaymentForm] = useState<FormState>(buildEmptyForm);
  const [editTarget, setEditTarget] = useState<{ id: string; stage: "FACTURADO" | "PAGADO" } | null>(null);
  const [editForm, setEditForm] = useState<FormState>(buildEmptyForm);

  const loadOrder = async (candidateOrder?: string, options?: { preserveMessage?: boolean }) => {
    const order = (candidateOrder ?? orderNumber).trim();

    if (!order) {
      setError("Ingresa un número de orden para consultar su detalle financiero.");
      return false;
    }

    setLoading(true);
    setError("");

    if (!options?.preserveMessage) {
      setMessage("");
    }

    try {
      const response = await api.get<OrderFinanceResponse>(`/integraciones/compras/ordenes/${encodeURIComponent(order)}/finanzas`);
      setReport(response);
      setActiveOrder(order);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer el detalle financiero de la orden.");
      setReport(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!activeOrder) {
      setError("Primero debes consultar una orden.");
      return;
    }

    if (!invoiceForm.fecha || !isPositiveAmount(invoiceForm.importe) || !invoiceForm.numeroFactura.trim()) {
      setError("Para registrar una facturación debes completar fecha, importe y número de factura.");
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.post(`/integraciones/compras/ordenes/${encodeURIComponent(activeOrder)}/facturados`, {
        fecha: invoiceForm.fecha,
        importe: Number(invoiceForm.importe),
        numero_factura: invoiceForm.numeroFactura,
      });
      setInvoiceForm(buildEmptyForm());
      const refreshed = await loadOrder(activeOrder, { preserveMessage: true });

      if (refreshed) {
        setMessage("Facturación parcial registrada correctamente.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la facturación.");
    }
  };

  const handleCreatePayment = async () => {
    if (!activeOrder) {
      setError("Primero debes consultar una orden.");
      return;
    }

    if (!paymentForm.fecha || !isPositiveAmount(paymentForm.importe)) {
      setError("Para registrar un pago debes completar fecha e importe.");
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.post(`/integraciones/compras/ordenes/${encodeURIComponent(activeOrder)}/pagados`, {
        fecha: paymentForm.fecha,
        importe: Number(paymentForm.importe),
      });
      setPaymentForm(buildEmptyForm());
      const refreshed = await loadOrder(activeOrder, { preserveMessage: true });

      if (refreshed) {
        setMessage("Pago parcial registrado correctamente.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar el pago.");
    }
  };

  const startEdit = (row: FinanceRow, stage: "FACTURADO" | "PAGADO") => {
    setEditTarget({ id: String(row.id), stage });
    setEditForm({
      fecha: row.fecha ?? "",
      importe: row.importe != null ? String(row.importe) : "",
      numeroFactura: row.numero_factura ?? "",
    });
  };

  const handleUpdateFinance = async () => {
    if (!editTarget) {
      return;
    }

    if (!editForm.fecha || !isPositiveAmount(editForm.importe)) {
      setError("Para actualizar la fila debes completar fecha e importe.");
      return;
    }

    if (editTarget.stage === "FACTURADO" && !editForm.numeroFactura.trim()) {
      setError("La fila FACTURADO requiere número de factura.");
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.put(`/integraciones/compras/finanzas/${editTarget.id}`, {
        fecha: editForm.fecha,
        importe: Number(editForm.importe),
        numero_factura: editTarget.stage === "FACTURADO" ? editForm.numeroFactura : undefined,
      });
      setEditTarget(null);
      setEditForm(buildEmptyForm());
      const refreshed = await loadOrder(activeOrder, { preserveMessage: true });

      if (refreshed) {
        setMessage(`Fila ${editTarget.stage.toLowerCase()} actualizada correctamente.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la fila financiera.");
    }
  };

  const handleDeleteFinance = async (financeId: string) => {
    if (!window.confirm("¿Deseas eliminar esta fila financiera?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/integraciones/compras/finanzas/${financeId}`);
      const refreshed = await loadOrder(activeOrder, { preserveMessage: true });

      if (refreshed) {
        setMessage("Fila financiera eliminada correctamente.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la fila financiera.");
    }
  };

  const rowsCount = useMemo(() => {
    if (!report) {
      return 0;
    }

    return report.compromisos.length + report.facturados.length + report.pagados.length;
  }, [report]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Integración externa</p>
        <h2 className="mt-2 font-display text-4xl text-white">Detalle financiero por orden</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Consulta compromisos, facturaciones parciales, pagos parciales y saldos de una orden de compra o servicio.
        </p>
      </div>

      {message ? <Panel className="border-emerald-400/30 text-emerald-300">{message}</Panel> : null}
      {error ? <Panel className="border-rose-400/30 text-rose-300">{error}</Panel> : null}

      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <label className="block flex-1 space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">Número de orden</span>
            <input
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="OC-26-1617 / OS-26-0450"
              className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadOrder()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? "Consultando..." : "Consultar orden"}
          </button>
        </div>
      </Panel>

      {report ? (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <Panel>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Comprometido</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(report.summary.comprometido)}</p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Facturado</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(report.summary.facturado)}</p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Pagado</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(report.summary.pagado)}</p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Saldo por facturar</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(report.summary.saldo_por_facturar)}</p>
            </Panel>
            <Panel>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Saldo por pagar</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(report.summary.saldo_por_pagar)}</p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">Orden activa</p>
                  <h3 className="mt-2 font-display text-2xl text-white">{activeOrder}</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">
                  {rowsCount} registros financieros
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-white">
                    <FileText className="h-4 w-4 text-amber-300" />
                    Compromisos
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/40">
                          <th className="pb-3">Fecha</th>
                          <th className="pb-3">Detalle</th>
                          <th className="pb-3 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {report.compromisos.map((row) => (
                          <tr key={String(row.id)} className="text-white/75">
                            <td className="py-3">{row.fecha ?? "-"}</td>
                            <td className="py-3">{row.descripcion ?? row.etapa ?? "Compromiso"}</td>
                            <td className="py-3 text-right">{formatCurrency(Number(row.importe ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white">
                      <FilePenLine className="h-4 w-4 text-mint-400" />
                      Registrar facturación parcial
                    </div>
                    <div className="mt-4 space-y-3">
                      <input
                        type="date"
                        value={invoiceForm.fecha}
                        onChange={(event) => setInvoiceForm((current) => ({ ...current, fecha: event.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={invoiceForm.importe}
                        onChange={(event) => setInvoiceForm((current) => ({ ...current, importe: event.target.value }))}
                        placeholder="Importe"
                        className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      />
                      <input
                        value={invoiceForm.numeroFactura}
                        onChange={(event) => setInvoiceForm((current) => ({ ...current, numeroFactura: event.target.value }))}
                        placeholder="Número de factura"
                        className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateInvoice()}
                        className="rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22]"
                      >
                        Agregar facturación
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white">
                      <HandCoins className="h-4 w-4 text-sky-300" />
                      Registrar pago parcial
                    </div>
                    <div className="mt-4 space-y-3">
                      <input
                        type="date"
                        value={paymentForm.fecha}
                        onChange={(event) => setPaymentForm((current) => ({ ...current, fecha: event.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={paymentForm.importe}
                        onChange={(event) => setPaymentForm((current) => ({ ...current, importe: event.target.value }))}
                        placeholder="Importe"
                        className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreatePayment()}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                      >
                        Agregar pago
                      </button>
                    </div>
                  </div>

                  {editTarget ? (
                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">Edición</p>
                      <h4 className="mt-2 text-lg font-semibold text-white">Editar fila {editTarget.stage}</h4>
                      <div className="mt-4 space-y-3">
                        <input
                          type="date"
                          value={editForm.fecha}
                          onChange={(event) => setEditForm((current) => ({ ...current, fecha: event.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.importe}
                          onChange={(event) => setEditForm((current) => ({ ...current, importe: event.target.value }))}
                          placeholder="Importe"
                          className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                        />
                        {editTarget.stage === "FACTURADO" ? (
                          <input
                            value={editForm.numeroFactura}
                            onChange={(event) => setEditForm((current) => ({ ...current, numeroFactura: event.target.value }))}
                            placeholder="Número de factura"
                            className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-white outline-none"
                          />
                        ) : null}
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleUpdateFinance()}
                            className="rounded-full bg-[#b30f28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#970d22]"
                          >
                            Guardar cambios
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(null);
                              setEditForm(buildEmptyForm());
                            }}
                            className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                          >
                            Cancelar edición
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <h3 className="font-display text-2xl text-white">Facturaciones parciales</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40">
                      <th className="pb-3">Fecha</th>
                      <th className="pb-3">Factura</th>
                      <th className="pb-3 text-right">Importe</th>
                      <th className="pb-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {report.facturados.map((row) => (
                      <tr key={String(row.id)} className="text-white/75">
                        <td className="py-3">{row.fecha ?? "-"}</td>
                        <td className="py-3">{row.numero_factura ?? "-"}</td>
                        <td className="py-3 text-right">{formatCurrency(Number(row.importe ?? 0))}</td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(row, "FACTURADO")}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white transition hover:bg-white/[0.08]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteFinance(String(row.id))}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-400/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel>
              <h3 className="font-display text-2xl text-white">Pagos parciales</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40">
                      <th className="pb-3">Fecha</th>
                      <th className="pb-3 text-right">Importe</th>
                      <th className="pb-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {report.pagados.map((row) => (
                      <tr key={String(row.id)} className="text-white/75">
                        <td className="py-3">{row.fecha ?? "-"}</td>
                        <td className="py-3 text-right">{formatCurrency(Number(row.importe ?? 0))}</td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(row, "PAGADO")}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white transition hover:bg-white/[0.08]"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteFinance(String(row.id))}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-400/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
