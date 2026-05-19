"use client";

/* ---------------------------------------------------------------------------
   /finance/setup — Financial Onboarding dashboard.

   Single-page operator surface for first-time company setup. Ten cards
   covering the minimum financial data a company needs before posting
   journals. Each card:
     · shows entered count + total
     · shows a status dot (empty / started / complete)
     · opens a drawer with a small form when clicked

   No new engines, no new ERP phases. The dashboard reads from
   /api/finance/setup/status and writes through the small per-area
   endpoints under /api/finance/setup/*.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";
import RrIcon from "@/components/ui/RrIcon";

type CardKey =
  | "base_currency" | "bank_accounts" | "cash_accounts" | "opening_balances"
  | "customers_ar" | "suppliers_ap" | "assets" | "loans" | "equity" | "fx_rates";

type CardStatus = "empty" | "started" | "complete";

interface SetupCard {
  key: CardKey;
  title: string;
  hint: string;
  status: CardStatus;
  count: number;
  total: number;
  currency: string;
  href: string;
}
interface SetupSnapshot {
  tenant_id: string;
  base_currency: string;
  ready: boolean;
  completion: number;
  cards: SetupCard[];
}

function fmtMoney(n: number, currency: string) {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "—";
  return `${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/* ─── Status dot ──────────────────────────────────────────────── */
function StatusDot({ status }: { status: CardStatus }) {
  const cls =
    status === "complete" ? "bg-emerald-400/80" :
    status === "started"  ? "bg-amber-300/80"   :
                            "bg-white/[0.10]";
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

/* ─── Main page ───────────────────────────────────────────────── */

export default function FinanceSetup() {
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/finance/setup/status", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      setSnapshot(j.snapshot as SetupSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* Hash-to-drawer: /finance/setup#assets now opens the Assets drawer
     directly. Discoverability fix — operators land here from
     /finance/data-entry expecting an entry form, not a card grid. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    function syncFromHash() {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) { setActiveCard(null); return; }
      const validKeys: CardKey[] = [
        "base_currency", "bank_accounts", "cash_accounts", "opening_balances",
        "customers_ar", "suppliers_ap", "assets", "loans", "equity", "fx_rates",
      ];
      if (validKeys.includes(raw as CardKey)) setActiveCard(raw as CardKey);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const pct = Math.round(((snapshot?.completion ?? 0) * 100));
  const startedCount = snapshot?.cards.filter((c) => c.status !== "empty").length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Financial Setup"
          subtitle="One-time onboarding. Fill the cards below in any order; the dashboard tracks progress."
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Progress strip */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <Eyebrow>Setup progress</Eyebrow>
              <div className="mt-1 text-[15px] text-gray-200">{startedCount} of {snapshot?.cards.length ?? 10} sections started</div>
              <div className="mt-1 text-[11px] text-gray-500">
                {snapshot?.ready
                  ? "Looks ready — you can start using the Finance app while the rest fills in."
                  : "Once half the cards are started, the Finance app is workable."}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[22px] tabular-nums tracking-tight">{pct}%</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{snapshot?.base_currency ?? "CNY"}</div>
            </div>
          </div>
          <div aria-hidden className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full bg-emerald-400/60 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Hairline />

        {/* Recommended order — operator guidance. */}
        {snapshot && (
          <SetupGuidance snapshot={snapshot} />
        )}

        {/* Card grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(snapshot?.cards ?? []).map((c) => (
            <button
              key={c.key}
              id={c.key}
              type="button"
              onClick={() => setActiveCard(c.key)}
              disabled={loading}
              className="group text-left rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5 transition-colors hover:bg-white/[0.025] focus:outline-none focus:ring-1 focus:ring-white/[0.10]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                  <StatusDot status={c.status} />
                  {c.status}
                </div>
                <RrIcon name="arrow-up-right" size={11} />
              </div>
              <div className="mt-2 text-[14px] font-medium text-[var(--text-primary)]">{c.title}</div>
              <div className="mt-1 text-[11px] text-gray-500">{c.hint}</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Count</div>
                  <div className="mt-0.5 font-mono text-[15px] tabular-nums">{c.count}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Total</div>
                  <div className="mt-0.5 font-mono text-[15px] tabular-nums">{c.key === "fx_rates" || c.key === "base_currency" ? "—" : fmtMoney(c.total, c.currency)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeCard && snapshot && (
        <SetupDrawer
          cardKey={activeCard}
          baseCurrency={snapshot.base_currency}
          onClose={() => setActiveCard(null)}
          onChange={() => { void load(); }}
        />
      )}
    </div>
  );
}

/* ─── Drawer chrome ──────────────────────────────────────────── */

function DrawerShell({
  title, subtitle, onClose, children, footer,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-lg flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">{title}</h2>
            {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Reusable inputs ────────────────────────────────────────── */

const inputCls = "w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]";
const labelCls = "mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500";

/* ─── Drawer router ──────────────────────────────────────────── */

function SetupDrawer({
  cardKey, baseCurrency, onClose, onChange,
}: { cardKey: CardKey; baseCurrency: string; onClose: () => void; onChange: () => void }) {
  if (cardKey === "base_currency") return <BaseCurrencyDrawer onClose={onClose} onChange={onChange} />;
  if (cardKey === "bank_accounts") return <BankAccountsDrawer baseCurrency={baseCurrency} onClose={onClose} onChange={onChange} />;
  if (cardKey === "fx_rates")      return <FxRatesDrawer baseCurrency={baseCurrency} onClose={onClose} onChange={onChange} />;
  if (cardKey === "assets")        return <AssetsDrawer baseCurrency={baseCurrency} onClose={onClose} onChange={onChange} />;
  /* All other cards funnel into the opening-balances drawer with a
     pre-selected category so the user lands on the right form. */
  const category =
    cardKey === "cash_accounts"     ? "cash" :
    cardKey === "customers_ar"      ? "customer_receivable" :
    cardKey === "suppliers_ap"      ? "supplier_payable" :
    cardKey === "loans"             ? "loan" :
    cardKey === "equity"            ? "owner_capital" :
    /* opening_balances catch-all */ "other";
  return <OpeningBalancesDrawer category={category as OBCategory} baseCurrency={baseCurrency} onClose={onClose} onChange={onChange} />;
}

/* ─── Base currency ──────────────────────────────────────────── */

function BaseCurrencyDrawer({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/finance/setup/base-currency", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (r.ok) setCode(j.base_currency || "USD");
    })();
  }, []);

  const save = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/finance/setup/base-currency", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_currency: code.trim().toUpperCase() }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      onChange(); onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerShell
      title="Company Base Currency"
      subtitle="The currency every other number defaults to."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">Cancel</button>
          <button onClick={save} disabled={submitting || !code} className="rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{submitting ? "Saving…" : "Save"}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <div className={labelCls}>ISO currency code</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="USD, EUR, AED, EGP, CNY…"
            maxLength={3}
            className={`${inputCls} font-mono uppercase`}
          />
          <div className="mt-1 text-[10.5px] text-gray-500">Three-letter ISO 4217 code. This value sits on the tenant record and is used everywhere a default is needed.</div>
        </label>
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
      </div>
    </DrawerShell>
  );
}

/* ─── Bank accounts ──────────────────────────────────────────── */

interface BankRow { id: string; bank_name: string | null; account_name: string | null; account_number: string | null; iban: string | null; swift_code: string | null; currency: string; opening_balance: number; is_primary: boolean; status: string }

function BankAccountsDrawer({ baseCurrency, onClose, onChange }: { baseCurrency: string; onClose: () => void; onChange: () => void }) {
  const [rows, setRows] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swift, setSwift] = useState("");
  const [iban, setIban] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [opening, setOpening] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/finance/bank-accounts", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      setRows(((j.accounts ?? []) as BankRow[]).filter((b) => b.status !== "archived"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!name.trim() && !bank.trim()) { setError("Provide bank or account name"); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/finance/bank-accounts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: bank.trim() || name.trim(),
          account_name: name.trim() || bank.trim(),
          account_number: accountNumber.trim() || null,
          swift_code: swift.trim().toUpperCase() || null,
          iban: iban.trim().toUpperCase() || null,
          currency: currency.trim().toUpperCase() || "USD",
          opening_balance: Number(opening) || 0,
          status: "active",
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      setName(""); setBank(""); setAccountNumber(""); setSwift(""); setIban(""); setOpening("");
      await load();
      onChange();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerShell title="Bank Accounts" subtitle="Operating accounts, FX sub-accounts, savings — every bank you transact through." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className={labelCls}>New bank account</div>
          <input placeholder="Account name (e.g. Main USD)"  value={name}          onChange={(e) => setName(e.target.value)}          className={inputCls} />
          <input placeholder="Bank name (e.g. HSBC)"          value={bank}          onChange={(e) => setBank(e.target.value)}          className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputCls} />
            <input placeholder="SWIFT / BIC"     value={swift}         onChange={(e) => setSwift(e.target.value.toUpperCase())} className={`${inputCls} font-mono uppercase`} />
            <input placeholder="IBAN"            value={iban}          onChange={(e) => setIban(e.target.value.toUpperCase())}  className={`${inputCls} font-mono uppercase`} />
            <input placeholder="Currency (USD)"  value={currency}      onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className={`${inputCls} font-mono uppercase`} />
          </div>
          <input type="number" min="0" step="0.01" placeholder="Opening balance" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${inputCls} tabular-nums`} />
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
          <button onClick={save} disabled={submitting} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{submitting ? "Saving…" : "Add bank account"}</button>
        </div>

        <div>
          <div className={labelCls}>Existing accounts ({rows.length})</div>
          {loading ? <div className="text-[11px] text-gray-500">Loading…</div> : rows.length === 0 ? (
            <div className="rounded-md border border-white/[0.04] px-3 py-3 text-[11px] text-gray-600">No bank accounts yet.</div>
          ) : (
            <ul className="space-y-1">
              {rows.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5 text-[11.5px]">
                  <div>
                    <div className="text-gray-200">{b.account_name ?? b.bank_name ?? "—"} <span className="text-gray-500">· {b.currency}</span></div>
                    <div className="text-[10.5px] text-gray-500 font-mono">{b.account_number ?? "—"}{b.swift_code ? ` · ${b.swift_code}` : ""}</div>
                  </div>
                  <span className="font-mono tabular-nums">{Number(b.opening_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

/* ─── FX Rates ───────────────────────────────────────────────── */

interface FxRow { id: string; from_currency: string; to_currency: string; rate: number; effective_date: string; notes: string | null }

function FxRatesDrawer({ baseCurrency, onClose, onChange }: { baseCurrency: string; onClose: () => void; onChange: () => void }) {
  const [rows, setRows] = useState<FxRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(baseCurrency);
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/finance/setup/fx-rates", { credentials: "include", cache: "no-store" });
    const j = await r.json();
    if (r.ok) setRows((j.rates ?? []) as FxRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/finance/setup/fx-rates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_currency: from.trim().toUpperCase(),
          to_currency: to.trim().toUpperCase(),
          rate: Number(rate),
          effective_date: date,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      setRate(""); setNotes("");
      await load(); onChange();
    } finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this rate?")) return;
    await fetch(`/api/finance/setup/fx-rates/${id}`, { method: "DELETE", credentials: "include" });
    await load(); onChange();
  };

  return (
    <DrawerShell title="FX Rates" subtitle="Manual rates for foreign-currency transactions. Used when a movement needs converting back to the base currency." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className={labelCls}>New rate</div>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="From" value={from} onChange={(e) => setFrom(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className={`${inputCls} font-mono uppercase`} />
            <input placeholder="To"   value={to}   onChange={(e) => setTo(e.target.value.toUpperCase().slice(0, 3))}   maxLength={3} className={`${inputCls} font-mono uppercase`} />
            <input type="number" min="0" step="0.00000001" placeholder="Rate" value={rate} onChange={(e) => setRate(e.target.value)} className={`${inputCls} tabular-nums`} />
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
          <button onClick={save} disabled={submitting || !from || !to || !rate} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{submitting ? "Saving…" : "Add rate"}</button>
        </div>

        <div>
          <div className={labelCls}>Existing rates ({rows.length})</div>
          {loading ? <div className="text-[11px] text-gray-500">Loading…</div> : rows.length === 0 ? (
            <div className="rounded-md border border-white/[0.04] px-3 py-3 text-[11px] text-gray-600">No rates configured. Anything in the base currency will be passed through unchanged.</div>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5 text-[11.5px]">
                  <div>
                    <div className="text-gray-200"><span className="font-mono">{r.from_currency} → {r.to_currency}</span> · <span className="tabular-nums">{Number(r.rate).toLocaleString("en-US", { maximumFractionDigits: 8 })}</span></div>
                    <div className="text-[10.5px] text-gray-500">{r.effective_date}{r.notes ? ` · ${r.notes}` : ""}</div>
                  </div>
                  <button onClick={() => remove(r.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

/* ─── Assets ─────────────────────────────────────────────────── */

interface AssetRow { id: string; name: string; category: string | null; purchase_value: number; purchase_date: string | null; depreciation_method: string; useful_life_years: number | null; currency: string; notes: string | null; status: string }

const DEPRECIATION_METHODS: Array<{ value: string; label: string }> = [
  { value: "straight_line",      label: "Straight line" },
  { value: "declining_balance",  label: "Declining balance" },
  { value: "none",               label: "None" },
];

function AssetsDrawer({ baseCurrency, onClose, onChange }: { baseCurrency: string; onClose: () => void; onChange: () => void }) {
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("straight_line");
  const [life, setLife] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/finance/setup/assets", { credentials: "include", cache: "no-store" });
    const j = await r.json();
    if (r.ok) setRows((j.assets ?? []) as AssetRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!name.trim()) { setError("name required"); return; }
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) { setError("purchase value required"); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/finance/setup/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          purchase_value: v,
          purchase_date: date || null,
          depreciation_method: method,
          useful_life_years: life ? Number(life) : null,
          currency: currency.trim().toUpperCase() || "USD",
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      setName(""); setCategory(""); setValue(""); setDate(""); setLife(""); setNotes("");
      await load(); onChange();
    } finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Archive this asset?")) return;
    await fetch(`/api/finance/setup/assets/${id}`, { method: "DELETE", credentials: "include" });
    await load(); onChange();
  };

  return (
    <DrawerShell title="Assets" subtitle="Buildings, vehicles, machinery, IT — anything depreciable." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className={labelCls}>New asset</div>
          <input placeholder="Asset name (e.g. Forklift FL-2026)" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Category (e.g. Machinery)" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
            <input type="number" min="0" step="0.01" placeholder="Purchase value" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} tabular-nums`} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <input type="number" min="0" step="0.1" placeholder="Useful life (years)" value={life} onChange={(e) => setLife(e.target.value)} className={`${inputCls} tabular-nums`} />
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              {DEPRECIATION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className={`${inputCls} font-mono uppercase`} />
          </div>
          <textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
          <button onClick={save} disabled={submitting} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{submitting ? "Saving…" : "Add asset"}</button>
        </div>

        <div>
          <div className={labelCls}>Existing assets ({rows.length})</div>
          {loading ? <div className="text-[11px] text-gray-500">Loading…</div> : rows.length === 0 ? (
            <div className="rounded-md border border-white/[0.04] px-3 py-3 text-[11px] text-gray-600">No assets registered yet.</div>
          ) : (
            <ul className="space-y-1">
              {rows.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5 text-[11.5px]">
                  <div>
                    <div className="text-gray-200">{a.name} {a.category && <span className="text-gray-500">· {a.category}</span>}</div>
                    <div className="text-[10.5px] text-gray-500">{a.purchase_date ?? "—"} · {a.depreciation_method}{a.useful_life_years ? ` · ${a.useful_life_years}y` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums">{Number(a.purchase_value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {a.currency}</div>
                    <button onClick={() => remove(a.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Archive</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

/* ─── Opening balances (cash / loan / AR / AP / equity / other) ─── */

type OBCategory = "cash" | "owner_capital" | "loan" | "customer_receivable" | "supplier_payable" | "fixed_asset" | "inventory" | "other";

const CATEGORY_META: Record<OBCategory, { title: string; hint: string; placeholder: string }> = {
  cash:                { title: "Cash Accounts",         hint: "Physical cash on hand and petty-cash floats.",                placeholder: "Main petty cash" },
  owner_capital:       { title: "Equity / Capital",      hint: "Owner-injected capital at company formation.",                placeholder: "Founder contribution" },
  loan:                { title: "Loans & Liabilities",   hint: "Bank loans, long-term debt, shareholder loans.",              placeholder: "HSBC term loan" },
  customer_receivable: { title: "Customers Receivable",  hint: "Outstanding balances customers owe at go-live.",              placeholder: "Customer XYZ — invoice INV-2025-01" },
  supplier_payable:    { title: "Suppliers Payable",     hint: "Outstanding balances owed to suppliers at go-live.",          placeholder: "Supplier ABC — invoice 5512" },
  fixed_asset:         { title: "Fixed Asset Opening",   hint: "Opening book value of an asset (independent from the Asset register).", placeholder: "Office equipment opening" },
  inventory:           { title: "Inventory Opening",     hint: "Opening inventory value snapshot.",                           placeholder: "Warehouse opening value" },
  other:               { title: "Other Opening Balances", hint: "Anything that doesn't fit the categories above.",            placeholder: "Misc opening" },
};

interface OBRow { id: string; category: OBCategory; label: string; amount: number; currency: string; notes: string | null; created_at: string }

function OpeningBalancesDrawer({ category, baseCurrency, onClose, onChange }: { category: OBCategory; baseCurrency: string; onClose: () => void; onChange: () => void }) {
  const meta = CATEGORY_META[category];
  const [rows, setRows] = useState<OBRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/finance/setup/opening-balances?category=${encodeURIComponent(category)}`, { credentials: "include", cache: "no-store" });
    const j = await r.json();
    if (r.ok) setRows((j.entries ?? []) as OBRow[]);
    setLoading(false);
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!label.trim()) { setError("Label required"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) { setError("Amount must be ≥ 0"); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/finance/setup/opening-balances", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          label: label.trim(),
          amount: amt,
          currency: currency.trim().toUpperCase() || "USD",
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      setLabel(""); setAmount(""); setNotes("");
      await load(); onChange();
    } finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/finance/setup/opening-balances/${id}`, { method: "DELETE", credentials: "include" });
    await load(); onChange();
  };

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + Number(r.amount || 0));
    return Array.from(m.entries());
  }, [rows]);

  return (
    <DrawerShell title={meta.title} subtitle={meta.hint} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className={labelCls}>New entry</div>
          <input placeholder={meta.placeholder} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} tabular-nums`} />
            <input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className={`${inputCls} font-mono uppercase`} />
          </div>
          <textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
          <button onClick={save} disabled={submitting} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{submitting ? "Saving…" : "Add entry"}</button>
        </div>

        <div>
          <div className={labelCls}>Entries ({rows.length})</div>
          {loading ? <div className="text-[11px] text-gray-500">Loading…</div> : rows.length === 0 ? (
            <div className="rounded-md border border-white/[0.04] px-3 py-3 text-[11px] text-gray-600">No entries yet. Each entry is a single opening figure for this category.</div>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5 text-[11.5px]">
                  <div>
                    <div className="text-gray-200">{r.label}</div>
                    <div className="text-[10.5px] text-gray-500">{r.created_at.slice(0, 10)}{r.notes ? ` · ${r.notes}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums">{Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.currency}</div>
                    <button onClick={() => remove(r.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totalsByCurrency.length > 0 && (
            <div className="mt-3 border-t border-white/[0.05] pt-2 text-right text-[11px] tabular-nums">
              {totalsByCurrency.map(([cur, t]) => (
                <div key={cur}>
                  <span className="text-gray-500">Total {cur}</span>{" "}
                  <span className="font-mono">{t.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

/* ─── Setup guidance — operator-friendly checklist + warnings ─── */

function SetupGuidance({ snapshot }: { snapshot: SetupSnapshot }) {
  /* Recommended setup order — operators repeatedly asked "where do I
     start?" The checklist below is the answer: do these in this
     order and the rest unlocks. */
  const order: Array<{ key: CardKey; label: string; why: string }> = [
    { key: "base_currency",   label: "Main Operating Currency",     why: "Locks the books in your reporting currency." },
    { key: "bank_accounts",   label: "Bank Accounts",                why: "Tells the system where cash is held." },
    { key: "fx_rates",        label: "Exchange Rates",               why: "Required if you sell in USD and operate in CNY." },
    { key: "opening_balances", label: "Starting Company Position",   why: "Day-zero snapshot — assets, liabilities, balances." },
    { key: "customers_ar",    label: "Money Customers Owe Us",       why: "Outstanding AR at go-live." },
    { key: "suppliers_ap",    label: "Money We Owe Suppliers",       why: "Outstanding AP at go-live." },
    { key: "assets",          label: "Assets",                       why: "Fixed assets + equipment register." },
    { key: "equity",          label: "Owner Capital",                why: "Founder + investor contributions." },
  ];

  const cardByKey = new Map(snapshot.cards.map((c) => [c.key, c]));
  const isCN = snapshot.base_currency === "CNY";
  const fxCard = cardByKey.get("fx_rates");
  const fxMissing = !fxCard || fxCard.count === 0;
  const firstEmpty = order.find((o) => (cardByKey.get(o.key)?.status ?? "empty") === "empty");

  return (
    <section className="space-y-3">
      {/* Warnings strip — only render when there's something to say. */}
      {(!isCN || fxMissing) && (
        <div className="space-y-2">
          {!isCN && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-300/[0.06] px-3 py-2 text-[11.5px] text-amber-100">
              <RrIcon name="info" size={12} className="mt-0.5" />
              <div>
                <div className="font-medium">Main operating currency is {snapshot.base_currency}, not CNY.</div>
                <div className="text-[10.5px] text-amber-200/80">
                  KOLEEX tenants normally use CNY. Change it in the "Main Operating Currency" card if this isn't a foreign subsidiary.
                </div>
              </div>
            </div>
          )}
          {isCN && fxMissing && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-300/[0.06] px-3 py-2 text-[11.5px] text-amber-100">
              <RrIcon name="balance-scale-left" size={12} className="mt-0.5" />
              <div>
                <div className="font-medium">USD → CNY exchange rate is missing.</div>
                <div className="text-[10.5px] text-amber-200/80">
                  You sell in USD and operate in CNY — add a USD → CNY rate so customer payments convert correctly.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommended order — a clean checklist, not a wizard. */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Recommended order</div>
          {firstEmpty && (
            <button
              type="button"
              onClick={() => {
                document.getElementById(firstEmpty.key)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="text-[10.5px] text-emerald-200 hover:text-emerald-100"
            >
              Start here: {firstEmpty.label} →
            </button>
          )}
        </div>
        <ol className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {order.map((step, i) => {
            const card = cardByKey.get(step.key);
            const status = card?.status ?? "empty";
            const tone =
              status === "complete" ? "border-emerald-400/30 bg-emerald-500/[0.06]" :
              status === "started"  ? "border-amber-400/30 bg-amber-500/[0.06]"   :
                                      "border-white/[0.05] bg-white/[0.012]";
            const dot =
              status === "complete" ? "bg-emerald-400/80" :
              status === "started"  ? "bg-amber-300/80"   :
                                      "bg-white/[0.10]";
            return (
              <li key={step.key} className={`flex gap-2 rounded-md border px-3 py-2 ${tone}`}>
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden style={{ background: undefined }}>
                  <span className={`block h-full w-full rounded-full ${dot}`} />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.10em] text-gray-500">Step {i + 1}</div>
                  <div className="text-[12px] font-medium">{step.label}</div>
                  <div className="text-[10px] text-gray-500">{step.why}</div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 text-[10.5px] text-gray-500">
          You can fill these in any order — the system uses what's there. The Finance app becomes fully usable once at least half the cards are started.
        </div>
      </div>
    </section>
  );
}
