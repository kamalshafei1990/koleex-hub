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
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import type { DashboardKpi } from "@/lib/finance/types";

interface PathTile {
  href: string;
  icon: RrIconName;
  tone: "emerald" | "blue" | "amber" | "neutral";
  /* i18n keys + English fallbacks so the dictionary is the source of
     truth and the tile still renders if a key is ever missing. */
  kickerKey: string;     kickerFallback: string;
  titleKey:  string;     titleFallback:  string;
  bodyKey:   string;     bodyFallback:   string;
}

const PATHS: PathTile[] = [
  {
    href: "/finance/data-entry", icon: "pencil",  tone: "emerald",
    kickerKey: "home.path.enter.kicker", kickerFallback: "Add data",
    titleKey:  "home.path.enter.title",  titleFallback:  "Enter finance data",
    bodyKey:   "home.path.enter.body",
    bodyFallback: "Assets · opening balances · customers · suppliers · FX rates · expenses · invoices.",
  },
  {
    href: "/finance/visual", icon: "balance-scale-left", tone: "blue",
    kickerKey: "home.path.read.kicker", kickerFallback: "Read data",
    titleKey:  "home.path.read.title",  titleFallback:  "Read financial statements",
    bodyKey:   "home.path.read.body",
    bodyFallback: "Income · balance sheet · cash flow · AR/AP aging · inventory · gross profit.",
  },
  {
    href: "/finance/workspace", icon: "bank", tone: "amber",
    kickerKey: "home.path.daily.kicker", kickerFallback: "Day-to-day",
    titleKey:  "home.path.daily.title",  titleFallback:  "Daily operations",
    bodyKey:   "home.path.daily.body",
    bodyFallback: "Pending approvals · bank balances · recent activity · quick actions.",
  },
  {
    href: "/finance/accounting/queue", icon: "books", tone: "neutral",
    kickerKey: "home.path.accounting.kicker", kickerFallback: "Accounting",
    titleKey:  "home.path.accounting.title",  titleFallback:  "Ledger work",
    bodyKey:   "home.path.accounting.body",
    bodyFallback: "Review journal queue · post entries · trial balance · general ledger.",
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

interface SetupHealth {
  ready: boolean;
  completion: number;
  missingCount: number;
  missingTitles: string[];
}

export default function FinanceHome() {
  const { t } = useTranslation(financeT);
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  /* Tenant currency comes from the shared cached hook — see
     useBaseCurrencyOptional. Returns null until resolved; KPI labels
     below render "—" until then so a USD/EUR tenant never flashes
     "CNY" on first paint. */
  const baseCurrency = useBaseCurrencyOptional() ?? "";
  const [loading, setLoading] = useState(true);
  /* Setup-health banner — surfaces missing onboarding items so a new
     tenant isn't left staring at empty KPIs without knowing why. The
     snapshot endpoint already exists for /finance/setup; we reuse it. */
  const [setupHealth, setSetupHealth] = useState<SetupHealth | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [k, s] = await Promise.all([
          fetch("/api/finance/dashboard?period=year", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
          fetch("/api/finance/setup/status", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        ]);
        if (k?.kpi) setKpi(k.kpi as DashboardKpi);
        if (s?.snapshot) {
          const snap = s.snapshot as { ready: boolean; completion: number; cards: Array<{ status: string; title: string }> };
          const missing = snap.cards.filter((c) => c.status === "empty");
          setSetupHealth({
            ready: snap.ready,
            completion: snap.completion,
            missingCount: missing.length,
            missingTitles: missing.slice(0, 3).map((c) => c.title),
          });
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const cashPosition = (kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0);

  const grossMarginPct = (kpi?.gross_margin_pct ?? 0).toFixed(1);
  const kpis: Kpi[] = [
    {
      label: t("home.kpi.collect", "Money to Collect"),
      value: kpi?.accounts_receivable ?? 0,
      unit: baseCurrency,
      hint: t("home.kpi.collect.hint", "Outstanding AR · tap for aging"),
      href: "/reports/statements?tab=ar",
      tone: "warning",
    },
    {
      label: t("home.kpi.pay", "Money to Pay"),
      value: kpi?.accounts_payable ?? 0,
      unit: baseCurrency,
      hint: t("home.kpi.pay.hint", "Suppliers + bills · tap for aging"),
      href: "/reports/statements?tab=ap",
      tone: "warning",
    },
    {
      label: t("home.kpi.cash", "Cash Position"),
      value: cashPosition,
      unit: baseCurrency,
      hint: cashPosition >= 0
        ? t("home.kpi.cash.in",  "Inflow heavy")
        : t("home.kpi.cash.out", "Outflow heavy"),
      href: "/finance/bank-accounts",
      tone: cashPosition >= 0 ? "positive" : "warning",
    },
    {
      label: t("home.kpi.netProfit", "Net Profit"),
      value: kpi?.net_profit ?? 0,
      unit: baseCurrency,
      hint: t("home.kpi.netProfit.hint", "{pct}% gross margin · tap for P&L").replace("{pct}", grossMarginPct),
      href: "/finance/visual",
      tone: (kpi?.net_profit ?? 0) >= 0 ? "positive" : "warning",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <FinanceHeader
          title={t("app.title", "Finance")}
          subtitle={t("app.subtitle", "Add data, read data, run the books — every path one click away.")}
        />

        {/* Setup-health banner. Hidden once every card is at least
            'started'; renders amber when items remain. */}
        {setupHealth && !setupHealth.ready && setupHealth.missingCount > 0 && (
          <SetupHealthBanner health={setupHealth} />
        )}

        {/* What do you want to do? — the only thing above the fold. */}
        <section className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("home.eyebrowAction", "What do you want to do?")}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PATHS.map((p) => <PathTileCard key={p.href} tile={p} />)}
          </div>
        </section>

        {/* Four essential KPIs. */}
        <section className="mt-8">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("home.eyebrowToday", "Today at a glance")}</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => <KpiCard key={k.label} kpi={k} loading={loading} />)}
          </div>
        </section>

        {/* "Finance Map" — every Finance page visible in one calm
            five-column layout so the operator always knows where
            things live. Mirrors the FinanceTabs structure exactly. */}
        <section className="mt-10">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("home.eyebrowMap", "Finance Map · every page, at a glance")}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MapColumn
              title={t("home.map.home", "Home")}
              hint={t("home.map.home.hint", "Start here")}
              links={[
                { href: "/finance",              label: t("subtab.home",         "Home") },
                { href: "/finance/intelligence", label: t("home.map.intelligence","Intelligence (deep view)") },
                { href: "/finance/workspace",    label: t("subtab.workspace",    "Workspace") },
                { href: "/finance/setup",        label: t("subtab.setup",        "Setup") },
              ]}
            />
            <MapColumn
              title={t("home.map.operations", "Operations")}
              hint={t("home.map.operations.hint", "Daily transactions")}
              links={[
                { href: "/finance/orders",    label: t("home.map.orderProfit",       "Order Profitability") },
                { href: "/finance/customers", label: t("subtab.customers",           "Customers") },
                { href: "/finance/suppliers", label: t("subtab.suppliers",           "Suppliers") },
                { href: "/finance/payments",  label: t("subtab.payments",            "Payments") },
                { href: "/finance/expenses",  label: t("subtab.expenseAnalytics",    "Expense Analytics") },
              ]}
            />
            <MapColumn
              title={t("home.map.cash", "Cash & Banking")}
              hint={t("home.map.cash.hint", "Cash management")}
              links={[
                { href: "/finance/bank-accounts",     label: t("subtab.bankAccounts",   "Bank Accounts") },
                { href: "/finance/bank-imports",      label: t("subtab.bankImports",    "Bank Imports") },
                { href: "/finance/reconciliation",    label: t("subtab.reconciliation", "Reconciliation") },
                { href: "/finance/treasury-forecast", label: t("subtab.cashForecast",   "Cash Forecast") },
                { href: "/finance/treasury-plans",    label: t("subtab.treasuryPlans",  "Treasury Plans") },
                { href: "/finance/fx-rates",          label: t("home.map.exchangeRates","Exchange Rates") },
              ]}
            />
            <MapColumn
              title={t("home.map.accounting", "Accounting")}
              hint={t("home.map.accounting.hint", "Ledger work")}
              links={[
                { href: "/finance/accounting/queue",          label: t("home.map.queueApprovals", "Queue (approvals)") },
                { href: "/finance/accounting/trial-balance",  label: t("subtab.trialBalance",     "Trial Balance") },
                { href: "/finance/accounting/general-ledger", label: t("subtab.generalLedger",    "General Ledger") },
                { href: "/finance/accounting/profit-loss",    label: t("subtab.profitLoss",       "Profit & Loss") },
                { href: "/finance/accounting/cash-flow",      label: t("subtab.cashFlow",         "Cash Flow") },
                { href: "/finance/accounting/equity",         label: t("subtab.equity",           "Equity") },
              ]}
            />
            <MapColumn
              title={t("home.map.reports", "Reports")}
              hint={t("home.map.reports.hint", "Read the books")}
              links={[
                { href: "/finance/visual",        label: t("subtab.visualStatements",   "Visual Statements") },
                { href: "/finance/statements",    label: t("subtab.detailedStatements", "Detailed Statements") },
                { href: "/finance/reports",       label: t("subtab.operationalReports", "Operational Reports") },
                { href: "/finance/notifications", label: t("subtab.reminders",          "Reminders") },
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
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("home.deep.kicker", "Need the deep view?")}</div>
              <div className="mt-1 text-[13px] font-medium">{t("home.deep.title", "Open the full Financial Intelligence dashboard")}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {t("home.deep.body", "System health · liquidity · counterparty risk · period-over-period deviations · cash flow chart · profit waterfall.")}
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-gray-200">
              {t("home.deep.cta", "Open →")}
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
  const toneCls = tones[tile.tone];
  const { t } = useTranslation(financeT);
  return (
    <Link
      href={tile.href}
      className={`group flex h-full items-start gap-3 rounded-xl border ${toneCls.border} ${toneCls.bg} px-4 py-4 transition-colors`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneCls.iconBg} ${toneCls.iconText}`}>
        <RrIcon name={tile.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] uppercase tracking-[0.16em] ${toneCls.kicker}`}>{t(tile.kickerKey, tile.kickerFallback)}</div>
        <div className="mt-0.5 text-[13.5px] font-semibold text-[var(--text-primary)]">{t(tile.titleKey, tile.titleFallback)}</div>
        <div className="mt-1 text-[11px] text-gray-400">{t(tile.bodyKey, tile.bodyFallback)}</div>
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

/* ─── Setup-health banner ───
   Shows when the tenant has empty setup cards. Operator-friendly copy:
   names the top 3 missing items so the next click is obvious. */

function SetupHealthBanner({ health }: { health: SetupHealth }) {
  const { t } = useTranslation(financeT);
  const pct = Math.round(health.completion * 100);
  const items = health.missingTitles.join(" · ");
  const more = health.missingCount > health.missingTitles.length
    ? t("home.banner.more", " · +{n} more").replace("{n}", String(health.missingCount - health.missingTitles.length))
    : "";
  return (
    <section className="mt-5">
      <Link
        href="/finance/setup"
        className="group relative flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 transition-colors hover:bg-amber-300/[0.07]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
          <RrIcon name="shield-check" size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
            {t("home.banner.kicker", "Finance setup · {pct}% complete").replace("{pct}", String(pct))}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-[var(--text-primary)]">
            {health.missingCount === 1
              ? t("home.banner.oneMissing", "1 setup item is empty — your KPIs may understate cash and AR/AP until it's filled.")
              : t("home.banner.manyMissing", "{n} setup items are empty — your KPIs may understate cash and AR/AP until they're filled.").replace("{n}", String(health.missingCount))}
          </div>
          <div className="mt-1 truncate text-[11px] text-gray-400">{items}{more}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="mt-1 text-amber-300/70 transition-colors group-hover:text-amber-200" />
      </Link>
    </section>
  );
}
