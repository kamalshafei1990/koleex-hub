"use client";

/* ---------------------------------------------------------------------------
   /finance — clean operator landing.

   Operator feedback was "the Finance app is too messy — too many
   shortcuts and hyperlinks". The previous default landing was the
   dense Financial Intelligence dashboard, which has 8+ panels and
   30+ links above the fold.

   This new Home replaces it. The dense dashboard is preserved at
   /finance/intelligence; every other route is untouched.

   Layout (top to bottom):
     1. Hero greeting + one-sentence subtitle
     2. Four "What do you want to do?" tiles
     3. Four essential KPIs (Money to Collect · Money to Pay · Cash · Net Profit)
        — each one a clickable drill-down
     4. A single, calm bottom link to the full Intelligence dashboard
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { formatCompact } from "@/components/finance/FinanceUiX";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import type { DashboardKpi } from "@/lib/finance/types";

interface PathTile {
  href: string;
  icon: RrIconName;
  tone: "emerald" | "blue" | "amber" | "neutral";
  kicker: string;
  title: string;
  body: string;
}

const PATHS: PathTile[] = [
  {
    href: "/finance/data-entry",
    icon: "pencil",
    tone: "emerald",
    kicker: "Add data",
    title: "Enter finance data",
    body: "Assets · opening balances · customers · suppliers · FX rates · expenses · invoices.",
  },
  {
    href: "/finance/visual",
    icon: "balance-scale-left",
    tone: "blue",
    kicker: "Read data",
    title: "Read financial statements",
    body: "Income · balance sheet · cash flow · AR/AP aging · inventory · gross profit.",
  },
  {
    href: "/finance/workspace",
    icon: "bank",
    tone: "amber",
    kicker: "Day-to-day",
    title: "Daily operations",
    body: "Pending approvals · bank balances · recent activity · quick actions.",
  },
  {
    href: "/finance/accounting/queue",
    icon: "books",
    tone: "neutral",
    kicker: "Accounting",
    title: "Ledger work",
    body: "Review journal queue · post entries · trial balance · general ledger.",
  },
];

interface Kpi {
  label: string;
  value: number;
  unit: string;
  hint: string;
  href: string;
  tone: "positive" | "warning" | "info" | "neutral";
}

export default function FinanceHome() {
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("CNY");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [k, d] = await Promise.all([
          fetch("/api/finance/dashboard?period=year", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
          fetch("/api/create/defaults", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        ]);
        if (k?.kpi) setKpi(k.kpi as DashboardKpi);
        if (d?.defaults?.base_currency) setBaseCurrency(d.defaults.base_currency);
      } finally { setLoading(false); }
    })();
  }, []);

  const cashPosition = (kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0);

  const kpis: Kpi[] = [
    {
      label: "Money to Collect",
      value: kpi?.accounts_receivable ?? 0,
      unit: baseCurrency,
      hint: "Outstanding AR · tap for aging",
      href: "/reports/statements?tab=ar",
      tone: "warning",
    },
    {
      label: "Money to Pay",
      value: kpi?.accounts_payable ?? 0,
      unit: baseCurrency,
      hint: "Suppliers + bills · tap for aging",
      href: "/reports/statements?tab=ap",
      tone: "warning",
    },
    {
      label: "Cash Position",
      value: cashPosition,
      unit: baseCurrency,
      hint: cashPosition >= 0 ? "Inflow heavy" : "Outflow heavy",
      href: "/finance/bank-accounts",
      tone: cashPosition >= 0 ? "positive" : "warning",
    },
    {
      label: "Net Profit",
      value: kpi?.net_profit ?? 0,
      unit: baseCurrency,
      hint: `${(kpi?.gross_margin_pct ?? 0).toFixed(1)}% gross margin · tap for P&L`,
      href: "/finance/visual",
      tone: (kpi?.net_profit ?? 0) >= 0 ? "positive" : "warning",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <FinanceHeader
          title="Finance"
          subtitle="Add data, read data, run the books — every path one click away."
        />

        {/* What do you want to do? — the only thing above the fold. */}
        <section className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">What do you want to do?</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PATHS.map((p) => <PathTileCard key={p.href} tile={p} />)}
          </div>
        </section>

        {/* Four essential KPIs. */}
        <section className="mt-8">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">Today at a glance</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => <KpiCard key={k.label} kpi={k} loading={loading} />)}
          </div>
        </section>

        {/* "Finance Map" — every Finance page visible in one calm
            five-column layout so the operator always knows where
            things live. Mirrors the FinanceTabs structure exactly. */}
        <section className="mt-10">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">Finance Map · every page, at a glance</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MapColumn
              title="Home"
              hint="Start here"
              links={[
                { href: "/finance",              label: "Home" },
                { href: "/finance/intelligence", label: "Intelligence (deep view)" },
                { href: "/finance/workspace",    label: "Workspace" },
                { href: "/finance/setup",        label: "Setup" },
              ]}
            />
            <MapColumn
              title="Operations"
              hint="Daily transactions"
              links={[
                { href: "/finance/orders",    label: "Order Profitability" },
                { href: "/finance/customers", label: "Customers" },
                { href: "/finance/suppliers", label: "Suppliers" },
                { href: "/finance/payments",  label: "Payments" },
                { href: "/finance/expenses",  label: "Expense Analytics" },
              ]}
            />
            <MapColumn
              title="Cash & Banking"
              hint="Cash management"
              links={[
                { href: "/finance/bank-accounts",     label: "Bank Accounts" },
                { href: "/finance/bank-imports",      label: "Bank Imports" },
                { href: "/finance/reconciliation",    label: "Reconciliation" },
                { href: "/finance/treasury-forecast", label: "Cash Forecast" },
                { href: "/finance/treasury-plans",    label: "Treasury Plans" },
                { href: "/finance/fx-rates",          label: "Exchange Rates" },
              ]}
            />
            <MapColumn
              title="Accounting"
              hint="Ledger work"
              links={[
                { href: "/finance/accounting/queue",          label: "Queue (approvals)" },
                { href: "/finance/accounting/trial-balance",  label: "Trial Balance" },
                { href: "/finance/accounting/general-ledger", label: "General Ledger" },
                { href: "/finance/accounting/profit-loss",    label: "Profit & Loss" },
                { href: "/finance/accounting/cash-flow",      label: "Cash Flow" },
                { href: "/finance/accounting/equity",         label: "Equity" },
              ]}
            />
            <MapColumn
              title="Reports"
              hint="Read the books"
              links={[
                { href: "/finance/visual",        label: "Visual Statements" },
                { href: "/finance/statements",    label: "Detailed Statements" },
                { href: "/finance/reports",       label: "Operational Reports" },
                { href: "/finance/notifications", label: "Reminders" },
              ]}
            />
          </div>
        </section>

        {/* Single, calm link to the dense intelligence dashboard. */}
        <section className="mt-8">
          <Link
            href="/finance/intelligence"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.012] px-4 py-3.5 transition-colors hover:bg-white/[0.025]"
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Need the deep view?</div>
              <div className="mt-1 text-[13px] font-medium">Open the full Financial Intelligence dashboard</div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                System health · liquidity · counterparty risk · period-over-period deviations · cash flow chart · profit waterfall.
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-gray-200">
              Open →
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

/* ─── Finance map column ─── */

function MapColumn({ title, hint, links }: { title: string; hint: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="text-[10px] text-gray-500">{hint}</div>
      <ul className="mt-2 space-y-0.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-md px-1.5 py-1 text-[11.5px] text-gray-300 hover:bg-white/[0.03] hover:text-gray-100"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Path tile ─── */

function PathTileCard({ tile }: { tile: PathTile }) {
  const tones: Record<PathTile["tone"], { border: string; bg: string; iconBg: string; iconText: string; kicker: string }> = {
    emerald: {
      border: "border-emerald-300/30",
      bg: "bg-emerald-300/[0.04] hover:bg-emerald-300/[0.08]",
      iconBg: "border-emerald-300/40 bg-emerald-300/[0.10]",
      iconText: "text-emerald-100",
      kicker: "text-emerald-300/80",
    },
    blue: {
      border: "border-blue-300/30",
      bg: "bg-blue-300/[0.04] hover:bg-blue-300/[0.08]",
      iconBg: "border-blue-300/40 bg-blue-300/[0.10]",
      iconText: "text-blue-100",
      kicker: "text-blue-300/80",
    },
    amber: {
      border: "border-amber-300/30",
      bg: "bg-amber-300/[0.04] hover:bg-amber-300/[0.08]",
      iconBg: "border-amber-300/40 bg-amber-300/[0.10]",
      iconText: "text-amber-100",
      kicker: "text-amber-300/80",
    },
    neutral: {
      border: "border-white/[0.08]",
      bg: "bg-white/[0.012] hover:bg-white/[0.04]",
      iconBg: "border-white/[0.10] bg-white/[0.04]",
      iconText: "text-gray-200",
      kicker: "text-gray-500",
    },
  };
  const t = tones[tile.tone];
  return (
    <Link
      href={tile.href}
      className={`group flex h-full items-start gap-3 rounded-xl border ${t.border} ${t.bg} px-4 py-4 transition-colors`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${t.iconBg} ${t.iconText}`}>
        <RrIcon name={tile.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] uppercase tracking-[0.16em] ${t.kicker}`}>{tile.kicker}</div>
        <div className="mt-0.5 text-[13.5px] font-semibold text-[var(--text-primary)]">{tile.title}</div>
        <div className="mt-1 text-[11px] text-gray-400">{tile.body}</div>
      </div>
      <RrIcon name="arrow-up-right" size={11} className="text-gray-500 transition-colors group-hover:text-gray-200" />
    </Link>
  );
}

/* ─── KPI card ─── */

function KpiCard({ kpi, loading }: { kpi: Kpi; loading: boolean }) {
  const accent =
    kpi.tone === "positive" ? "bg-emerald-300/55" :
    kpi.tone === "warning"  ? "bg-amber-300/55"   :
    kpi.tone === "info"     ? "bg-blue-300/55"    :
                              "bg-white/30";
  const valueText =
    kpi.tone === "positive" ? "text-emerald-100" :
    kpi.tone === "warning"  ? "text-amber-100"   :
                              "text-[var(--text-primary)]";
  return (
    <Link
      href={kpi.href}
      className="group relative block h-full rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5 transition-colors hover:bg-white/[0.025]"
      aria-label={`Open ${kpi.label}`}
    >
      <span aria-hidden className={`absolute left-4 top-0 h-px w-8 ${accent}`} />
      <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{kpi.label}</div>
      <div className={`mt-2 font-mono text-[24px] leading-none tabular-nums tracking-[-0.01em] ${valueText}`}>
        <span className="text-[12px] text-gray-500">{kpi.unit}</span>{" "}
        {loading ? <span className="text-gray-700">—</span> : formatCompact(kpi.value)}
      </div>
      <div className="mt-1.5 text-[10.5px] text-gray-500">{kpi.hint}</div>
    </Link>
  );
}
