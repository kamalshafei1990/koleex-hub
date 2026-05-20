"use client";

/* ---------------------------------------------------------------------------
   /finance/statements — Phase A.6.

   Seven-tab executive surface that pulls every statement from a single
   page so an operator (or external accountant) can scan the whole
   accounting picture without bouncing between routes.

   Tabs:
     · P&L                → /api/accounting/profit-loss      (A.3)
     · Balance Sheet      → /api/accounting/balance-sheet    (A.1)
     · Cash Flow          → /api/accounting/statements/cash-flow-summary
     · AR Aging           → /api/accounting/statements/ar-aging
     · AP Aging           → /api/accounting/statements/ap-aging
     · Inventory Value    → /api/accounting/statements/inventory-valuation
     · Gross Profit       → /api/accounting/statements/gross-profit

   Date range selector at the top (YTD default). Each tab renders a
   pure table with totals, print-friendly via the global @media print
   rules; the page reuses the Finance design vocabulary (Eyebrow,
   Hairline, low borders, no neon).
   --------------------------------------------------------------------------- */

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";

type Tab = "pl" | "bs" | "cf" | "ar" | "ap" | "inv" | "gp";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "pl",  label: "Profit & Loss" },
  { key: "bs",  label: "Balance Sheet" },
  { key: "cf",  label: "Cash Flow" },
  { key: "ar",  label: "AR Aging" },
  { key: "ap",  label: "AP Aging" },
  { key: "inv", label: "Inventory Value" },
  { key: "gp",  label: "Gross Profit" },
];

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}
function fmtQty(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function FinanceStatements() {
  const { t } = useTranslation(financeT);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yearStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);

  const [tab, setTab] = useState<Tab>("pl");
  const [from, setFrom] = useState(yearStart);
  const [to,   setTo]   = useState(today);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("statements.title", "Statements")}
          subtitle={t("statements.subtitle.long", "Executive financial picture — P&L, Balance Sheet, Cash Flow, aging, valuation, gross profit.")}
          action={
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06] print:hidden"
            >
              Print / PDF
            </button>
          }
        />

        {/* Period bar */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">From</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">To</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-gray-500">{from} → {to}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1 print:hidden">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ${
                  active ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <Hairline />

        {/* Active panel */}
        {tab === "pl"  && <ProfitLossPanel from={from} to={to} />}
        {tab === "bs"  && <BalanceSheetPanel asOf={to} />}
        {tab === "cf"  && <CashFlowPanel from={from} to={to} />}
        {tab === "ar"  && <ArAgingPanel asOf={to} />}
        {tab === "ap"  && <ApAgingPanel asOf={to} />}
        {tab === "inv" && <InventoryValuePanel />}
        {tab === "gp"  && <GrossProfitPanel from={from} to={to} />}
      </div>
    </div>
  );
}

/* ─── Helper: thin fetch wrapper with loading/error ───────────── */

function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(url, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `Failed (${r.status})`));
      setData(j as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error };
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <div className="mb-3">
        <Eyebrow>{title}</Eyebrow>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012] print:border-0 print:bg-transparent">
        {children}
      </div>
    </section>
  );
}

/* ─── Profit & Loss ───────────────────────────────────────────── */

interface PLLine { code?: string; name?: string; label?: string; amount: number }
interface PLSection { label?: string; amount: number; lines?: PLLine[] }
interface PLStatement {
  period: { from: string; to: string };
  currency: string;
  revenue: PLSection;
  cost_of_sales: PLSection;
  operating_expenses: PLSection;
  net_profit: number;
  gross_profit: number;
}

function ProfitLossPanel({ from, to }: { from: string; to: string }) {
  const { data, loading, error } = useJson<{ statement: PLStatement }>(
    `/api/accounting/profit-loss?from=${from}&to=${to}`,
  );
  const s = data?.statement;
  if (loading && !s) return <Panel title="Profit & Loss"><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title="Profit & Loss"><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!s) return null;
  return (
    <Panel title="Profit & Loss">
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <SectionRow label="Revenue" s={s.revenue} accent="text-emerald-200" />
          <SectionRow label="Cost of Sales" s={s.cost_of_sales} accent="text-rose-200" />
          <SubtotalRow label="Gross Profit" value={s.gross_profit} />
          <SectionRow label="Operating Expenses" s={s.operating_expenses} accent="text-rose-200" />
          <tr className="border-t-2 border-white/20">
            <td className="px-4 py-2.5 text-[14px] font-bold">Net Profit</td>
            <td className="px-4 py-2.5 text-right tabular-nums font-mono text-[14px] font-bold">{fmtMoney(s.net_profit)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}
function SectionRow({ label, s, accent }: { label: string; s: PLSection; accent: string }) {
  const lines = s.lines ?? [];
  return (
    <>
      <tr className="bg-white/[0.02]">
        <td className="px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-400">{label}</td>
        <td className={`px-4 py-1.5 text-right tabular-nums font-mono font-medium ${accent}`}>{fmtMoney(s.amount)}</td>
      </tr>
      {lines.map((l, i) => {
        const text = l.name ?? l.label ?? l.code ?? "—";
        return (
          <tr key={`${text}-${i}`} className="border-b border-white/[0.03]">
            <td className="px-4 py-1.5 pl-6 text-gray-300">{l.code ? `${l.code} · ${text}` : text}</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtMoney(l.amount)}</td>
          </tr>
        );
      })}
      {lines.length === 0 && (
        <tr><td colSpan={2} className="px-4 py-1.5 pl-6 text-[11px] text-gray-600">No activity in this section.</td></tr>
      )}
    </>
  );
}
function SubtotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-white/[0.10]">
      <td className="px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-gray-400">{label}</td>
      <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(value)}</td>
    </tr>
  );
}

/* ─── Balance Sheet ───────────────────────────────────────────── */

interface BSSummary {
  as_of: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  current_year_earnings: number;
  balanced_difference: number;
}

function BalanceSheetPanel({ asOf }: { asOf: string }) {
  const { data, loading, error } = useJson<{ summary: BSSummary }>(
    `/api/accounting/balance-sheet?as_of=${asOf}`,
  );
  const s = data?.summary;
  if (loading && !s) return <Panel title="Balance Sheet"><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title="Balance Sheet"><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!s) return null;
  const lAndE = s.total_liabilities + s.total_equity + s.current_year_earnings;
  const reconciled = Math.abs(s.balanced_difference) < 0.05;
  return (
    <Panel title={`Balance Sheet · as of ${s.as_of}`}>
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <tr className="bg-white/[0.02]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">Assets</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_assets)}</td>
          </tr>
          <tr className="bg-white/[0.02]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">Liabilities</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_liabilities)}</td>
          </tr>
          <tr className="bg-white/[0.02]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">Equity</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_equity)}</td>
          </tr>
          <tr className="border-b border-white/[0.03]">
            <td className="px-4 py-1.5 pl-6 text-gray-300">Current year earnings</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtMoney(s.current_year_earnings)}</td>
          </tr>
          <tr className="border-t-2 border-white/20">
            <td className="px-4 py-2 text-[13px] font-bold">Liabilities + Equity + CYE</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(lAndE)}</td>
          </tr>
          {!reconciled && (
            <tr><td colSpan={2} className="px-4 py-2 text-[11px] text-rose-300 bg-rose-500/[0.06]">
              Assets do not reconcile (Δ {fmtMoney(s.balanced_difference)}). Run a trial balance check.
            </td></tr>
          )}
        </tbody>
      </table>
      <div className="border-t border-white/[0.05] px-4 py-2 text-[10.5px] text-gray-500">
        For a full account-by-account view (Cash, AR, Inventory Asset, AP, Owner Capital, Retained Earnings, …) open the Trial Balance or General Ledger pages.
      </div>
    </Panel>
  );
}

/* ─── Cash Flow (simple summary) ──────────────────────────────── */

interface CFSummary { from: string; to: string; cash_in: number; cash_out: number; net_change: number; counts: { in: number; out: number } }
function CashFlowPanel({ from, to }: { from: string; to: string }) {
  const { data, loading, error } = useJson<{ report: CFSummary }>(
    `/api/accounting/statements/cash-flow-summary?from=${from}&to=${to}`,
  );
  const r = data?.report;
  if (loading && !r) return <Panel title="Cash Flow Summary"><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title="Cash Flow Summary"><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title="Cash Flow Summary">
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <tr className="border-b border-white/[0.06]"><td className="px-4 py-2 text-gray-300">Cash in <span className="text-gray-500">({r.counts.in} payments)</span></td><td className="px-4 py-2 text-right tabular-nums font-mono text-emerald-200">{fmtMoney(r.cash_in)}</td></tr>
          <tr className="border-b border-white/[0.06]"><td className="px-4 py-2 text-gray-300">Cash out <span className="text-gray-500">({r.counts.out} payments)</span></td><td className="px-4 py-2 text-right tabular-nums font-mono text-rose-200">{fmtMoney(r.cash_out)}</td></tr>
          <tr className="border-t-2 border-white/20"><td className="px-4 py-2.5 text-[14px] font-bold">Net cash change</td><td className="px-4 py-2.5 text-right tabular-nums font-mono text-[14px] font-bold">{fmtMoney(r.net_change)}</td></tr>
        </tbody>
      </table>
    </Panel>
  );
}

/* ─── AR / AP Aging ──────────────────────────────────────────── */

interface AgingPartyRow { party_id: string | null; party_name: string | null; total_open: number; total_overdue: number; buckets: Record<string, number>; currency: string }
interface AgingReport { as_of: string; buckets: string[]; parties: AgingPartyRow[]; totals: { by_bucket: Record<string, number>; total_open: number; total_overdue: number } }

function AgingPanel({ title, url }: { title: string; url: string }) {
  const { data, loading, error } = useJson<{ report: AgingReport }>(url);
  const r = data?.report;
  if (loading && !r) return <Panel title={title}><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title={title}><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={`${title} · as of ${r.as_of}`}>
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
            <th className="px-4 py-2 text-left">Party</th>
            {r.buckets.map((b) => (
              <th key={b} className="px-4 py-2 text-right">{b}</th>
            ))}
            <th className="px-4 py-2 text-right">Open</th>
            <th className="px-4 py-2 text-right">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {r.parties.length === 0 ? (
            <tr><td colSpan={r.buckets.length + 3} className="px-4 py-6 text-center text-[11px] text-gray-600">No open balances.</td></tr>
          ) : r.parties.map((p) => (
            <tr key={p.party_id ?? p.party_name ?? ""} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="px-4 py-1.5 text-gray-200">{p.party_name ?? "—"}</td>
              {r.buckets.map((b) => (
                <td key={b} className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtMoney(p.buckets[b] ?? 0)}</td>
              ))}
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(p.total_open)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-rose-200">{fmtMoney(p.total_overdue)}</td>
            </tr>
          ))}
        </tbody>
        {r.parties.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td className="px-4 py-2 text-[13px] font-bold">Totals</td>
              {r.buckets.map((b) => (
                <td key={b} className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(r.totals.by_bucket[b] ?? 0)}</td>
              ))}
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(r.totals.total_open)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-rose-200">{fmtMoney(r.totals.total_overdue)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Panel>
  );
}
function ArAgingPanel({ asOf }: { asOf: string }) { return <AgingPanel title="AR Aging" url={`/api/accounting/statements/ar-aging?as_of=${asOf}`} />; }
function ApAgingPanel({ asOf }: { asOf: string }) { return <AgingPanel title="AP Aging" url={`/api/accounting/statements/ap-aging?as_of=${asOf}`} />; }

/* ─── Inventory Value ────────────────────────────────────────── */

interface InvRow { inventory_item_id: string; item_code: string; item_name: string | null; warehouse_id: string; warehouse_code: string; warehouse_name: string; qty_on_hand: number; average_cost: number; inventory_value: number; currency: string }
interface InvReport { as_of: string; rows: InvRow[]; totals: { total_qty: number; total_value: number; by_currency: Record<string, number> } }

function InventoryValuePanel() {
  const { data, loading, error } = useJson<{ report: InvReport }>("/api/accounting/statements/inventory-valuation");
  const r = data?.report;
  if (loading && !r) return <Panel title="Inventory Valuation"><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title="Inventory Valuation"><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={`Inventory Valuation · as of ${r.as_of}`}>
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
            <th className="px-4 py-2 text-left">Code</th>
            <th className="px-4 py-2 text-left">Item</th>
            <th className="px-4 py-2 text-left">Location</th>
            <th className="px-4 py-2 text-right">Qty</th>
            <th className="px-4 py-2 text-right">Avg cost</th>
            <th className="px-4 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">No valued stock.</td></tr>
          ) : r.rows.map((row) => (
            <tr key={`${row.inventory_item_id}-${row.warehouse_id}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="px-4 py-1.5 font-mono text-[11.5px] text-gray-300">{row.item_code}</td>
              <td className="px-4 py-1.5 text-gray-200">{row.item_name ?? "—"}</td>
              <td className="px-4 py-1.5 text-gray-400">{row.warehouse_code} <span className="text-gray-500">· {row.warehouse_name}</span></td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtQty(row.qty_on_hand)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtMoney(row.average_cost)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(row.inventory_value)}</td>
            </tr>
          ))}
        </tbody>
        {r.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td colSpan={3} className="px-4 py-2 text-[13px] font-bold text-right uppercase tracking-[0.08em]">Totals</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtQty(r.totals.total_qty)}</td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-emerald-200">{fmtMoney(r.totals.total_value)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Panel>
  );
}

/* ─── Gross Profit ───────────────────────────────────────────── */

interface GPRow { invoice_id: string; invoice_no: string | null; customer_name: string | null; currency: string; revenue: number; cogs: number; gross_profit: number; margin_pct: number; revenue_status: string; cogs_status: string }
interface GPReport { as_of: string; from: string | null; to: string | null; rows: GPRow[]; totals: { revenue: number; cogs: number; gross_profit: number; margin_pct: number } }

function GrossProfitPanel({ from, to }: { from: string; to: string }) {
  const { data, loading, error } = useJson<{ report: GPReport }>(
    `/api/accounting/statements/gross-profit?from=${from}&to=${to}`,
  );
  const r = data?.report;
  if (loading && !r) return <Panel title="Gross Profit"><div className="px-4 py-6 text-[12px] text-gray-500">Loading…</div></Panel>;
  if (error) return <Panel title="Gross Profit"><div className="px-4 py-6 text-[11px] text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title="Gross Profit per Invoice">
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
            <th className="px-4 py-2 text-left">Invoice</th>
            <th className="px-4 py-2 text-left">Customer</th>
            <th className="px-4 py-2 text-right">Revenue</th>
            <th className="px-4 py-2 text-right">COGS</th>
            <th className="px-4 py-2 text-right">Gross profit</th>
            <th className="px-4 py-2 text-right">Margin %</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-gray-600">No invoices in the window.</td></tr>
          ) : r.rows.map((row) => (
            <tr key={row.invoice_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="px-4 py-1.5 font-mono text-[11.5px] text-gray-300">{row.invoice_no ?? "—"}</td>
              <td className="px-4 py-1.5 text-gray-200">{row.customer_name ?? "—"}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-emerald-200">{fmtMoney(row.revenue)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-rose-200">{fmtMoney(row.cogs)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(row.gross_profit)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{row.revenue > 0 ? `${row.margin_pct.toFixed(1)}%` : "—"}</td>
              <td className="px-4 py-1.5 text-[10.5px] text-gray-500">rev · {row.revenue_status} / cogs · {row.cogs_status}</td>
            </tr>
          ))}
        </tbody>
        {r.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td colSpan={2} className="px-4 py-2 text-[13px] font-bold text-right uppercase tracking-[0.08em]">Totals</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-emerald-200">{fmtMoney(r.totals.revenue)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-rose-200">{fmtMoney(r.totals.cogs)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(r.totals.gross_profit)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{r.totals.revenue > 0 ? `${r.totals.margin_pct.toFixed(1)}%` : "—"}</td>
              <td className="px-4 py-2"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </Panel>
  );
}
