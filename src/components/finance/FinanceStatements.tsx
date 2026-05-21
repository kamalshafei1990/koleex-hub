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

const TAB_KEYS: Tab[] = ["pl", "bs", "cf", "ar", "ap", "inv", "gp"];

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
  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "pl",  label: t("statements.tab.pl", "Profit & Loss") },
    { key: "bs",  label: t("statements.tab.bs", "Balance Sheet") },
    { key: "cf",  label: t("statements.tab.cf", "Cash Flow") },
    { key: "ar",  label: t("statements.tab.ar", "AR Aging") },
    { key: "ap",  label: t("statements.tab.ap", "AP Aging") },
    { key: "inv", label: t("statements.tab.inv", "Inventory Value") },
    { key: "gp",  label: t("statements.tab.gp", "Gross Profit") },
  ];
  void TAB_KEYS;
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
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface-hover)] print:hidden"
            >
              {t("statements.printPdf", "Print / PDF")}
            </button>
          }
        />

        {/* Period bar */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("statements.from", "From")}</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("statements.to", "To")}</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{from} → {to}</div>
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
                  active ? "border-[var(--border-color)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]"
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
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] print:border-0 print:bg-transparent">
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
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ statement: PLStatement }>(
    `/api/accounting/profit-loss?from=${from}&to=${to}`,
  );
  const s = data?.statement;
  if (loading && !s) return <Panel title={t("statements.pl.title", "Profit & Loss")}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={t("statements.pl.title", "Profit & Loss")}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!s) return null;
  return (
    <Panel title={t("statements.pl.title", "Profit & Loss")}>
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <SectionRow label={t("statements.pl.revenue", "Revenue")} s={s.revenue} accent="text-emerald-700 dark:text-emerald-200" />
          <SectionRow label={t("statements.pl.cos", "Cost of Sales")} s={s.cost_of_sales} accent="text-rose-700 dark:text-rose-200" />
          <SubtotalRow label={t("statements.pl.gp", "Gross Profit")} value={s.gross_profit} />
          <SectionRow label={t("statements.pl.opex", "Operating Expenses")} s={s.operating_expenses} accent="text-rose-700 dark:text-rose-200" />
          <tr className="border-t-2 border-white/20">
            <td className="px-4 py-2.5 text-[14px] font-bold">{t("statements.pl.np", "Net Profit")}</td>
            <td className="px-4 py-2.5 text-right tabular-nums font-mono text-[14px] font-bold">{fmtMoney(s.net_profit)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}
function SectionRow({ label, s, accent }: { label: string; s: PLSection; accent: string }) {
  const { t } = useTranslation(financeT);
  const lines = s.lines ?? [];
  return (
    <>
      <tr className="bg-[var(--bg-secondary)]">
        <td className="px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</td>
        <td className={`px-4 py-1.5 text-right tabular-nums font-mono font-medium ${accent}`}>{fmtMoney(s.amount)}</td>
      </tr>
      {lines.map((l, i) => {
        const text = l.name ?? l.label ?? l.code ?? "—";
        return (
          <tr key={`${text}-${i}`} className="border-b border-[var(--border-faint)]">
            <td className="px-4 py-1.5 pl-6 text-[var(--text-highlight)]">{l.code ? `${l.code} · ${text}` : text}</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmtMoney(l.amount)}</td>
          </tr>
        );
      })}
      {lines.length === 0 && (
        <tr><td colSpan={2} className="px-4 py-1.5 pl-6 text-[11px] text-[var(--text-ghost)]">{t("statements.pl.noActivity", "No activity in this section.")}</td></tr>
      )}
    </>
  );
}
function SubtotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-[var(--border-color)]">
      <td className="px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</td>
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
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ summary: BSSummary }>(
    `/api/accounting/balance-sheet?as_of=${asOf}`,
  );
  const s = data?.summary;
  if (loading && !s) return <Panel title={t("statements.tab.bs", "Balance Sheet")}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={t("statements.tab.bs", "Balance Sheet")}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!s) return null;
  const lAndE = s.total_liabilities + s.total_equity + s.current_year_earnings;
  const reconciled = Math.abs(s.balanced_difference) < 0.05;
  return (
    <Panel title={t("statements.bs.title", "Balance Sheet · as of {date}").replace("{date}", s.as_of)}>
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <tr className="bg-[var(--bg-secondary)]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{t("statements.bs.assets", "Assets")}</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_assets)}</td>
          </tr>
          <tr className="bg-[var(--bg-secondary)]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{t("statements.bs.liab", "Liabilities")}</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_liabilities)}</td>
          </tr>
          <tr className="bg-[var(--bg-secondary)]">
            <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{t("statements.bs.equity", "Equity")}</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmtMoney(s.total_equity)}</td>
          </tr>
          <tr className="border-b border-[var(--border-faint)]">
            <td className="px-4 py-1.5 pl-6 text-[var(--text-highlight)]">{t("statements.bs.cye", "Current year earnings")}</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmtMoney(s.current_year_earnings)}</td>
          </tr>
          <tr className="border-t-2 border-white/20">
            <td className="px-4 py-2 text-[13px] font-bold">{t("statements.bs.lec", "Liabilities + Equity + CYE")}</td>
            <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(lAndE)}</td>
          </tr>
          {!reconciled && (
            <tr><td colSpan={2} className="px-4 py-2 text-[11px] text-rose-600 dark:text-rose-300 bg-rose-500/[0.06]">
              {t("statements.bs.notReconciled", "Assets do not reconcile (Δ {value}). Run a trial balance check.").replace("{value}", fmtMoney(s.balanced_difference))}
            </td></tr>
          )}
        </tbody>
      </table>
      <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-[10.5px] text-[var(--text-dim)]">
        {t("statements.bs.fullView", "For a full account-by-account view (Cash, AR, Inventory Asset, AP, Owner Capital, Retained Earnings, …) open the Trial Balance or General Ledger pages.")}
      </div>
    </Panel>
  );
}

/* ─── Cash Flow (simple summary) ──────────────────────────────── */

interface CFSummary { from: string; to: string; cash_in: number; cash_out: number; net_change: number; counts: { in: number; out: number } }
function CashFlowPanel({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ report: CFSummary }>(
    `/api/accounting/statements/cash-flow-summary?from=${from}&to=${to}`,
  );
  const r = data?.report;
  if (loading && !r) return <Panel title={t("statements.cf.title", "Cash Flow Summary")}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={t("statements.cf.title", "Cash Flow Summary")}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={t("statements.cf.title", "Cash Flow Summary")}>
      <table className="min-w-full text-[12.5px]">
        <tbody>
          <tr className="border-b border-[var(--border-subtle)]"><td className="px-4 py-2 text-[var(--text-highlight)]">{t("statements.cf.in", "Cash in")} <span className="text-[var(--text-dim)]">{t("statements.cf.payments", "({n} payments)").replace("{n}", String(r.counts.in))}</span></td><td className="px-4 py-2 text-right tabular-nums font-mono text-emerald-700 dark:text-emerald-200">{fmtMoney(r.cash_in)}</td></tr>
          <tr className="border-b border-[var(--border-subtle)]"><td className="px-4 py-2 text-[var(--text-highlight)]">{t("statements.cf.out", "Cash out")} <span className="text-[var(--text-dim)]">{t("statements.cf.payments", "({n} payments)").replace("{n}", String(r.counts.out))}</span></td><td className="px-4 py-2 text-right tabular-nums font-mono text-rose-700 dark:text-rose-200">{fmtMoney(r.cash_out)}</td></tr>
          <tr className="border-t-2 border-white/20"><td className="px-4 py-2.5 text-[14px] font-bold">{t("statements.cf.net", "Net cash change")}</td><td className="px-4 py-2.5 text-right tabular-nums font-mono text-[14px] font-bold">{fmtMoney(r.net_change)}</td></tr>
        </tbody>
      </table>
    </Panel>
  );
}

/* ─── AR / AP Aging ──────────────────────────────────────────── */

interface AgingPartyRow { party_id: string | null; party_name: string | null; total_open: number; total_overdue: number; buckets: Record<string, number>; currency: string }
interface AgingReport { as_of: string; buckets: string[]; parties: AgingPartyRow[]; totals: { by_bucket: Record<string, number>; total_open: number; total_overdue: number } }

function AgingPanel({ title, url }: { title: string; url: string }) {
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ report: AgingReport }>(url);
  const r = data?.report;
  if (loading && !r) return <Panel title={title}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={title}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={t("statements.aging.title", "{title} · as of {date}").replace("{title}", title).replace("{date}", r.as_of)}>
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
            <th className="px-4 py-2 text-left">{t("statements.aging.party", "Party")}</th>
            {r.buckets.map((b) => (
              <th key={b} className="px-4 py-2 text-right">{b}</th>
            ))}
            <th className="px-4 py-2 text-right">{t("statements.aging.open", "Open")}</th>
            <th className="px-4 py-2 text-right">{t("statements.aging.overdue", "Overdue")}</th>
          </tr>
        </thead>
        <tbody>
          {r.parties.length === 0 ? (
            <tr><td colSpan={r.buckets.length + 3} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{t("statements.aging.empty", "No open balances.")}</td></tr>
          ) : r.parties.map((p) => (
            <tr key={p.party_id ?? p.party_name ?? ""} className="border-b border-[var(--border-faint)] hover:bg-[var(--bg-secondary)]">
              <td className="px-4 py-1.5 text-[var(--text-highlight)]">{p.party_name ?? "—"}</td>
              {r.buckets.map((b) => (
                <td key={b} className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmtMoney(p.buckets[b] ?? 0)}</td>
              ))}
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(p.total_open)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-rose-700 dark:text-rose-200">{fmtMoney(p.total_overdue)}</td>
            </tr>
          ))}
        </tbody>
        {r.parties.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td className="px-4 py-2 text-[13px] font-bold">{t("statements.aging.totals", "Totals")}</td>
              {r.buckets.map((b) => (
                <td key={b} className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(r.totals.by_bucket[b] ?? 0)}</td>
              ))}
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtMoney(r.totals.total_open)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-rose-700 dark:text-rose-200">{fmtMoney(r.totals.total_overdue)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Panel>
  );
}
function ArAgingPanel({ asOf }: { asOf: string }) {
  const { t } = useTranslation(financeT);
  return <AgingPanel title={t("statements.tab.ar", "AR Aging")} url={`/api/accounting/statements/ar-aging?as_of=${asOf}`} />;
}
function ApAgingPanel({ asOf }: { asOf: string }) {
  const { t } = useTranslation(financeT);
  return <AgingPanel title={t("statements.tab.ap", "AP Aging")} url={`/api/accounting/statements/ap-aging?as_of=${asOf}`} />;
}

/* ─── Inventory Value ────────────────────────────────────────── */

interface InvRow { inventory_item_id: string; item_code: string; item_name: string | null; warehouse_id: string; warehouse_code: string; warehouse_name: string; qty_on_hand: number; average_cost: number; inventory_value: number; currency: string }
interface InvReport { as_of: string; rows: InvRow[]; totals: { total_qty: number; total_value: number; by_currency: Record<string, number> } }

function InventoryValuePanel() {
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ report: InvReport }>("/api/accounting/statements/inventory-valuation");
  const r = data?.report;
  if (loading && !r) return <Panel title={t("statements.tab.inv", "Inventory Value")}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={t("statements.tab.inv", "Inventory Value")}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={t("statements.inv.title", "Inventory Valuation · as of {date}").replace("{date}", r.as_of)}>
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
            <th className="px-4 py-2 text-left">{t("statements.inv.code", "Code")}</th>
            <th className="px-4 py-2 text-left">{t("statements.inv.item", "Item")}</th>
            <th className="px-4 py-2 text-left">{t("statements.inv.location", "Location")}</th>
            <th className="px-4 py-2 text-right">{t("statements.inv.qty", "Qty")}</th>
            <th className="px-4 py-2 text-right">{t("statements.inv.avgCost", "Avg cost")}</th>
            <th className="px-4 py-2 text-right">{t("statements.inv.value", "Value")}</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{t("statements.inv.empty", "No valued stock.")}</td></tr>
          ) : r.rows.map((row) => (
            <tr key={`${row.inventory_item_id}-${row.warehouse_id}`} className="border-b border-[var(--border-faint)] hover:bg-[var(--bg-secondary)]">
              <td className="px-4 py-1.5 font-mono text-[11.5px] text-[var(--text-highlight)]">{row.item_code}</td>
              <td className="px-4 py-1.5 text-[var(--text-highlight)]">{row.item_name ?? "—"}</td>
              <td className="px-4 py-1.5 text-[var(--text-secondary)]">{row.warehouse_code} <span className="text-[var(--text-dim)]">· {row.warehouse_name}</span></td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtQty(row.qty_on_hand)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmtMoney(row.average_cost)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(row.inventory_value)}</td>
            </tr>
          ))}
        </tbody>
        {r.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td colSpan={3} className="px-4 py-2 text-[13px] font-bold text-right uppercase tracking-[0.08em]">{t("statements.aging.totals", "Totals")}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold">{fmtQty(r.totals.total_qty)}</td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-emerald-700 dark:text-emerald-200">{fmtMoney(r.totals.total_value)}</td>
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
  const { t } = useTranslation(financeT);
  const { data, loading, error } = useJson<{ report: GPReport }>(
    `/api/accounting/statements/gross-profit?from=${from}&to=${to}`,
  );
  const r = data?.report;
  if (loading && !r) return <Panel title={t("statements.tab.gp", "Gross Profit")}><div className="px-4 py-6 text-[12px] text-[var(--text-dim)]">{t("statements.loading", "Loading…")}</div></Panel>;
  if (error) return <Panel title={t("statements.tab.gp", "Gross Profit")}><div className="px-4 py-6 text-[11px] text-rose-600 dark:text-rose-300">{error}</div></Panel>;
  if (!r) return null;
  return (
    <Panel title={t("statements.gp.title", "Gross Profit per Invoice")}>
      <table className="min-w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
            <th className="px-4 py-2 text-left">{t("statements.gp.invoice", "Invoice")}</th>
            <th className="px-4 py-2 text-left">{t("statements.gp.customer", "Customer")}</th>
            <th className="px-4 py-2 text-right">{t("statements.gp.revenue", "Revenue")}</th>
            <th className="px-4 py-2 text-right">{t("statements.gp.cogs", "COGS")}</th>
            <th className="px-4 py-2 text-right">{t("statements.gp.gp", "Gross profit")}</th>
            <th className="px-4 py-2 text-right">{t("statements.gp.margin", "Margin %")}</th>
            <th className="px-4 py-2 text-left">{t("statements.gp.status", "Status")}</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{t("statements.gp.empty", "No invoices in the window.")}</td></tr>
          ) : r.rows.map((row) => (
            <tr key={row.invoice_id} className="border-b border-[var(--border-faint)] hover:bg-[var(--bg-secondary)]">
              <td className="px-4 py-1.5 font-mono text-[11.5px] text-[var(--text-highlight)]">{row.invoice_no ?? "—"}</td>
              <td className="px-4 py-1.5 text-[var(--text-highlight)]">{row.customer_name ?? "—"}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-emerald-700 dark:text-emerald-200">{fmtMoney(row.revenue)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-rose-700 dark:text-rose-200">{fmtMoney(row.cogs)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmtMoney(row.gross_profit)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{row.revenue > 0 ? `${row.margin_pct.toFixed(1)}%` : "—"}</td>
              <td className="px-4 py-1.5 text-[10.5px] text-[var(--text-dim)]">{t("statements.gp.statusLine", "rev · {rev} / cogs · {cogs}").replace("{rev}", row.revenue_status).replace("{cogs}", row.cogs_status)}</td>
            </tr>
          ))}
        </tbody>
        {r.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td colSpan={2} className="px-4 py-2 text-[13px] font-bold text-right uppercase tracking-[0.08em]">{t("statements.aging.totals", "Totals")}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-emerald-700 dark:text-emerald-200">{fmtMoney(r.totals.revenue)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono text-[13px] font-bold text-rose-700 dark:text-rose-200">{fmtMoney(r.totals.cogs)}</td>
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
