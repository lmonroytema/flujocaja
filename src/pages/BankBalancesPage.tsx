import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Landmark, Plus, Power, Trash2 } from "lucide-react";
import { api } from "@/utils/api";
import { Panel } from "@/components/ui/Panel";
import { formatMoney, formatShortDate, type CurrencyCode } from "@/utils/format";

type BankBalance = { id: number; fecha: string; monto: number; notas: string | null };

type BankAccount = {
  id: number;
  banco: string;
  cuenta: string;
  numero: string | null;
  moneda: CurrencyCode;
  activa: boolean;
  saldos: BankBalance[];
};

const today = () => new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30";

export default function BankBalancesPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState({ bank_name: "", account_name: "", account_number: "", currency_code: "PEN" });

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: BankAccount[] }>("/bancos/cuentas")
      .then((response) => setAccounts(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setMessage("");

    try {
      await action();
      setMessage(success);
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    }
  };

  const totals = useMemo(() => {
    const result: Record<CurrencyCode, number> = { PEN: 0, USD: 0 };

    for (const account of accounts) {
      if (account.activa && account.saldos[0]) {
        result[account.moneda] += account.saldos[0].monto;
      }
    }

    return result;
  }, [accounts]);

  const createAccount = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.post("/bancos/cuentas", newAccount);
      setNewAccount({ bank_name: "", account_name: "", account_number: "", currency_code: newAccount.currency_code });
    }, "Cuenta registrada.");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-mint-400">Configuración</p>
        <h2 className="mt-2 font-display text-4xl text-white">Saldos en bancos</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
          Registra cada cuenta bancaria y su saldo a una fecha de corte. El flujo de caja toma, por cada cuenta activa, el
          saldo más reciente hasta el inicio del período consultado (si la cuenta no tiene uno anterior, usa su primer
          saldo registrado). Los saldos en dólares se convierten a soles con el tipo de cambio de la primera semana.
        </p>
      </div>

      {message && <Panel className="border-mint-400/30 text-mint-400">{message}</Panel>}
      {error && <Panel className="border-amberx-500/30 text-amberx-400">{error}</Panel>}

      <div className="grid gap-4 md:grid-cols-2">
        {(["PEN", "USD"] as CurrencyCode[]).map((currency) => (
          <Panel key={currency}>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Último saldo · cuentas en {currency}</p>
            <p className="mt-2 font-display text-3xl text-white">{formatMoney(totals[currency], currency)}</p>
          </Panel>
        ))}
      </div>

      <Panel>
        <form onSubmit={createAccount} className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_120px_auto]">
          <input
            required
            className={inputClass}
            placeholder="Banco (ej. BCP)"
            value={newAccount.bank_name}
            onChange={(e) => setNewAccount({ ...newAccount, bank_name: e.target.value })}
          />
          <input
            required
            className={inputClass}
            placeholder="Cuenta (ej. Corriente soles)"
            value={newAccount.account_name}
            onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="N.º de cuenta (opcional)"
            value={newAccount.account_number}
            onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
          />
          <select
            className={inputClass}
            value={newAccount.currency_code}
            onChange={(e) => setNewAccount({ ...newAccount, currency_code: e.target.value })}
          >
            <option value="PEN" className="bg-slate-900">PEN</option>
            <option value="USD" className="bg-slate-900">USD</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-2 text-sm text-white transition hover:bg-mint-400/20"
          >
            <Plus className="h-4 w-4" /> Agregar cuenta
          </button>
        </form>
      </Panel>

      {loading && !accounts.length ? (
        <div className="h-40 animate-pulse rounded-[28px] bg-white/[0.05]" />
      ) : accounts.length === 0 ? (
        <Panel className="text-white/60">Aún no hay cuentas registradas.</Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  run,
}: {
  account: BankAccount;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [form, setForm] = useState({ balance_date: today(), amount: "", notes: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.post(`/bancos/cuentas/${account.id}/saldos`, {
        balance_date: form.balance_date,
        amount: Number(form.amount),
        notes: form.notes || null,
      });
      setForm({ ...form, amount: "", notes: "" });
    }, "Saldo registrado.");
  };

  return (
    <Panel className={`space-y-4 ${account.activa ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Landmark className="mt-1 h-5 w-5 text-mint-400" />
          <div>
            <h3 className="font-display text-xl text-white">
              {account.banco} · {account.cuenta}
            </h3>
            <p className="text-xs text-white/50">
              {account.moneda}
              {account.numero ? ` · ${account.numero}` : ""}
              {account.activa ? "" : " · inactiva (no suma al flujo)"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            title={account.activa ? "Desactivar" : "Activar"}
            onClick={() =>
              void run(
                () =>
                  api.put(`/bancos/cuentas/${account.id}`, {
                    bank_name: account.banco,
                    account_name: account.cuenta,
                    account_number: account.numero,
                    currency_code: account.moneda,
                    is_active: !account.activa,
                  }),
                account.activa ? "Cuenta desactivada." : "Cuenta activada.",
              )
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70 hover:bg-white/[0.08]"
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Eliminar cuenta y sus saldos"
            onClick={() => {
              if (window.confirm(`¿Eliminar la cuenta ${account.banco} · ${account.cuenta} y todos sus saldos?`)) {
                void run(() => api.delete(`/bancos/cuentas/${account.id}`), "Cuenta eliminada.");
              }
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-amberx-400 hover:bg-white/[0.08]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[150px_1fr_1fr_auto]">
        <input
          required
          type="date"
          className={inputClass}
          value={form.balance_date}
          onChange={(e) => setForm({ ...form, balance_date: e.target.value })}
        />
        <input
          required
          type="number"
          step="0.01"
          className={inputClass}
          placeholder={`Saldo en ${account.moneda}`}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Nota (opcional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button
          type="submit"
          className="rounded-2xl border border-mint-400/30 bg-mint-400/10 px-4 py-2 text-sm text-white transition hover:bg-mint-400/20"
        >
          Guardar saldo
        </button>
      </form>
      <p className="text-[11px] text-white/40">Si ya existe un saldo en esa fecha, se reemplaza.</p>

      {account.saldos.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-white/45">
              <th className="py-1">Fecha de corte</th>
              <th className="py-1 text-right">Saldo</th>
              <th className="py-1 pl-3">Nota</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {account.saldos.map((balance, index) => (
              <tr key={balance.id} className="border-t border-white/6 text-white/80">
                <td className="py-1.5">
                  {formatShortDate(balance.fecha)}
                  {index === 0 && <span className="ml-2 text-[10px] text-mint-400">último</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(balance.monto, account.moneda)}</td>
                <td className="py-1.5 pl-3 text-white/50">{balance.notas ?? ""}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    title="Eliminar saldo"
                    onClick={() => void run(() => api.delete(`/bancos/saldos/${balance.id}`), "Saldo eliminado.")}
                    className="text-white/40 hover:text-amberx-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-white/50">Sin saldos registrados.</p>
      )}
    </Panel>
  );
}
