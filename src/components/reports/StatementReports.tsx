"use client";

/* ---------------------------------------------------------------------------
   /reports/statements — Refactored financial statements view.

   Same data sources as /finance/statements but using the unified
   ReportUi primitives: cleaner hierarchy, tighter spacing, deliberate
   subtotal visibility, and a polished print layout.
   --------------------------------------------------------------------------- */

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReportShell, ReportFilters, ReportToolbar, ReportSection, ReportRow,
  ReportSubtotal, ReportTotal, ReportFooter, fmtMoney,
} from "@/components/ui/report/ReportUi";

type Tab = "pl" | "bs" | "cf";

interface PLAccountLine { account_id: string; code: string; name: string; amount: number }
interface PLSection { label: string; amount: number; accounts: PLAccountLine[] }
interface ProfitLoss {
  period: { from: string; to: string };
  currency: string;
  revenue: PLSection; cost_of_sales: PLSection;
  gross_profit: number; gross_margin_pct: number;
  operating_expenses: PLSection;
  operating_profit: number; operating_margin_pct: number;
  net_profit: number; net_margin_pct: number;
}
interface BalanceSheet {
  as_of: string;
  currency: string;
  assets: { current: PLSection; non_current: PLSection; total: number };
  liabilities: { current: PLSection; non_current: PLSection; total: number };
  equity: { sections: PLSection[]; total: number };
  reconciled: boolean;
}
interface CashFlowLine { label: string; amount: number; detail?: string }
interface CashFlowSection { label: string; amount: number; lines: CashFlowLine[] }
interface CashFlow {
  period: { from: string; to: string };
  currency: string;
  opening_cash: number;
  operating: CashFlowSection; investing: CashFlowSection; financing: CashFlowSection;
  net_change: number; closing_cash: number; reconciled: boolean;
}

export default function StatementReports() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yearStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [tab, setTab] = useState<Tab>("pl");
  const [from, setFrom] = useState(yearStart);
  const [to,   setTo]   = useState(today);
  const [pl, setPL] = useState<ProfitLoss | null>(null);
  const [bs, setBS] = useState<BalanceSheet | null>(null);
  const [cf, setCF] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (tab === "pl") {
        const r = await fetch(`/api/accounting/profit-loss?${qs.toString()}`);
        const j = await r.json(); if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
        setPL(j.pl ?? j.profit_loss ?? j);
      } else if (tab === "bs") {
        const r = await fetch(`/api/accounting/balance-sheet?as_of=${to}`);
        const j = await r.json(); if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
        setBS(j.bs ?? j.balance_sheet ?? j);
      } else {
        const r = await fetch(`/api/accounting/cash-flow?${qs.toString()}`);
        const j = await r.json(); if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
        setCF(j.cf ?? j.cash_flow ?? j);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [tab, from, to]);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  function handlePrint() { if (typeof window !== "undefined") window.print(); }

  return (
    <ReportShell
      title="Financial Statements"
      subtitle={tab === "pl" ? "Profit & Loss" : tab === "bs" ? "Balance Sheet" : "Cash Flow"}
      icon="balance-scale-left"
      backHref="/reports"
      filters={
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.012] p-1.5">
            {[
              { k: "pl" as Tab, label: "Profit & Loss" },
              { k: "bs" as Tab, label: "Balance Sheet" },
              { k: "cf" as Tab, label: "Cash Flow" },
            ].map((t) => (
              <button key={t.k} type="button" onClick={() => setTab(t.k)}
                      className={`rounded-md px-3 py-1.5 text-[12px] ${
                        t.k === tab ? "bg-white/[0.10] text-white" : "text-gray-400 hover:bg-white/[0.05]"
                      }`}>
                {t.label}
              </button>
            ))}
          </div>
          <ReportFilters
            fields={tab === "bs"
              ? [{ key: "to", label: "As of", type: "date", value: to, onChange: setTo }]
              : [
                { key: "from", label: "From", type: "date" as const, value: from, onChange: setFrom },
                { key: "to",   label: "To",   type: "date" as const, value: to,   onChange: setTo },
              ]}
            onApply={fetchActive}
            onReset={() => { setFrom(yearStart); setTo(today); }}
          />
        </div>
      }
      toolbar={<ReportToolbar onPrint={handlePrint} />}
      footer={<ReportFooter note={tab === "bs" ? `As of ${to}` : `${from} → ${to}`} />}
    >
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {!loading && tab === "pl" && pl && <ProfitLossView pl={pl} />}
      {!loading && tab === "bs" && bs && <BalanceSheetView bs={bs} />}
      {!loading && tab === "cf" && cf && <CashFlowView cf={cf} />}
    </ReportShell>
  );
}

/* ─── Views ─── */

function ProfitLossView({ pl }: { pl: ProfitLoss }) {
  return (
    <div className="space-y-2">
      <ReportSection title="Revenue" total={pl.revenue.amount}>
        {pl.revenue.accounts.map((a) => (
          <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
        ))}
      </ReportSection>
      <ReportSection title="Cost of Sales" total={pl.cost_of_sales.amount}>
        {pl.cost_of_sales.accounts.map((a) => (
          <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
        ))}
      </ReportSection>
      <ReportSubtotal label={`Gross Profit · ${pl.gross_margin_pct.toFixed(1)}%`} amount={pl.gross_profit} />
      <ReportSection title="Operating Expenses" total={pl.operating_expenses.amount}>
        {pl.operating_expenses.accounts.map((a) => (
          <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
        ))}
      </ReportSection>
      <ReportSubtotal
        label={`Operating Profit · ${pl.operating_margin_pct.toFixed(1)}%`}
        amount={pl.operating_profit}
      />
      <ReportTotal
        label={`Net Profit · ${pl.net_margin_pct.toFixed(1)}%`}
        amount={pl.net_profit}
        tone={pl.net_profit >= 0 ? "positive" : "warning"}
      />
    </div>
  );
}

function BalanceSheetView({ bs }: { bs: BalanceSheet }) {
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      <div className="space-y-2">
        <ReportSection title="Assets" subtitle="Current + non-current" total={bs.assets.total}>
          <ReportRow label="Current Assets" amount={bs.assets.current.amount} muted />
          {bs.assets.current.accounts.map((a) => (
            <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
          ))}
          <ReportRow label="Non-current Assets" amount={bs.assets.non_current.amount} muted />
          {bs.assets.non_current.accounts.map((a) => (
            <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
          ))}
        </ReportSection>
        <ReportTotal label="Total Assets" amount={bs.assets.total} />
      </div>
      <div className="space-y-2">
        <ReportSection title="Liabilities" total={bs.liabilities.total}>
          <ReportRow label="Current Liabilities" amount={bs.liabilities.current.amount} muted />
          {bs.liabilities.current.accounts.map((a) => (
            <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
          ))}
          <ReportRow label="Non-current Liabilities" amount={bs.liabilities.non_current.amount} muted />
          {bs.liabilities.non_current.accounts.map((a) => (
            <ReportRow key={a.account_id} code={a.code} label={a.name} amount={a.amount} indent={1} />
          ))}
        </ReportSection>
        <ReportSection title="Equity" total={bs.equity.total}>
          {bs.equity.sections.flatMap((s) =>
            s.accounts.map((a) => (
              <ReportRow key={`${s.label}-${a.account_id}`} code={a.code} label={a.name} amount={a.amount} indent={1} />
            ))
          )}
        </ReportSection>
        <ReportTotal
          label="Total Liabilities + Equity"
          amount={bs.liabilities.total + bs.equity.total}
          tone={bs.reconciled ? "positive" : "warning"}
        />
        {!bs.reconciled && (
          <div className="text-[11px] text-rose-300">⚠ Balance sheet does not reconcile.</div>
        )}
      </div>
    </div>
  );
}

function CashFlowView({ cf }: { cf: CashFlow }) {
  const renderSection = (s: CashFlowSection) => (
    <ReportSection key={s.label} title={s.label} total={s.amount}>
      {s.lines.map((l, i) => (
        <ReportRow key={`${s.label}-${i}`} label={l.label} amount={l.amount} indent={1}
                   muted={Math.abs(l.amount) < 0.005} />
      ))}
    </ReportSection>
  );
  return (
    <div className="space-y-2">
      <div className="mb-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px]">
        <span className="text-gray-500">Opening Cash:</span>{" "}
        <span className="font-mono tabular-nums">{fmtMoney(cf.opening_cash)}</span>
      </div>
      {renderSection(cf.operating)}
      {renderSection(cf.investing)}
      {renderSection(cf.financing)}
      <ReportSubtotal label="Net Change in Cash" amount={cf.net_change} />
      <ReportTotal
        label="Closing Cash"
        amount={cf.closing_cash}
        tone={cf.reconciled ? "positive" : "warning"}
      />
      {!cf.reconciled && (
        <div className="text-[11px] text-rose-300">⚠ Cash flow does not reconcile to opening + net.</div>
      )}
    </div>
  );
}
