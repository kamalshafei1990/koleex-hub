"use client";

/* ---------------------------------------------------------------------------
   FinanceHeader — thin wrapper around the shared PageHeader.

   Same chrome as every other Hub app:
     · 5 primary tabs: Overview · Orders · Customers · Suppliers · Expenses
     · "Accounting" tab opens the ··· popup with 20+ accounting routes
       grouped by Accounting · Banking · Treasury · Reports · Setup
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader, { type PageTab } from "@/components/ui/PageHeader";
import type { NavGroup } from "@/components/ui/PageNavPopup";
import RrIcon from "@/components/ui/RrIcon";
import Button from "@/components/ui/Button";
import { openSmartCreate } from "@/components/ui/create/SmartCreateDrawer";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { ACCENT } from "@/lib/accentColors";
import { SEARCH_PLACEHOLDERS } from "@/lib/searchPlaceholders";

export type HealthStatus = "healthy" | "watch" | "stress" | "unknown";

interface HealthStyle { dot: string; labelKey: string; labelFallback: string; hintKey: string; hintFallback: string }

const HEALTH_STYLE: Record<HealthStatus, HealthStyle> = {
  healthy: {
    dot: "bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]",
    labelKey: "header.healthHealthy",    labelFallback: "Healthy",
    hintKey:  "header.healthHealthyHint",hintFallback:  "Profit positive, cash flowing, nothing overdue.",
  },
  watch: {
    dot: "bg-amber-600 dark:bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]",
    labelKey: "header.healthWatch",       labelFallback: "Watch",
    hintKey:  "header.healthWatchHint",   hintFallback:  "Some overdue items or tight cash position.",
  },
  stress: {
    dot: "bg-rose-600 dark:bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.65)]",
    labelKey: "header.healthStress",      labelFallback: "Stress",
    hintKey:  "header.healthStressHint",  hintFallback:  "Negative net profit or major overdue exposure.",
  },
  unknown: {
    dot: "bg-gray-500",
    labelKey: "common.untilLoaded",       labelFallback: "—",
    hintKey:  "header.healthUnknownHint", hintFallback:  "Not enough activity yet to score.",
  },
};

/* The 5 operator tabs + Accounting entry. */
const PRIMARY_TABS_RAW: Array<{ key: string; labelKey: string; fallback: string; icon: PageTab["icon"] }> = [
  { key: "/finance",                    labelKey: "tabs.overview",    fallback: "Overview",   icon: "balance-scale-left" },
  { key: "/finance/orders",             labelKey: "subtab.orders",    fallback: "Orders",     icon: "file-invoice" },
  { key: "/finance/customers",          labelKey: "subtab.customers", fallback: "Customers",  icon: "arrow-down-left" },
  { key: "/finance/suppliers",          labelKey: "subtab.suppliers", fallback: "Suppliers",  icon: "arrow-up-right" },
  { key: "/finance/expenses",           labelKey: "subtab.expenses",  fallback: "Expenses",   icon: "receipt" },
  { key: "/finance/accounting/queue",   labelKey: "tabs.accounting",  fallback: "Accounting", icon: "contract" },
];

/* All accounting routes — grouped for the ··· popup. */
const OVERFLOW_GROUPS_RAW: Array<{ id: string; labelKey: string; fallback: string; accent: NavGroup["accent"]; items: Array<{ key: string; labelKey: string; fallback: string; icon: NavGroup["items"][number]["icon"]; blurb: string }> }> = [
  {
    id: "accounting",
    labelKey: "tabs.accounting",
    fallback: "Accounting",
    accent: ACCENT.blue,
    items: [
      { key: "/finance/accounting/queue",          labelKey: "subtab.queue",         fallback: "Queue",          icon: "clock",                blurb: "Pending journal entries" },
      { key: "/finance/accounting/trial-balance",  labelKey: "subtab.trialBalance",  fallback: "Trial Balance",  icon: "badge-check",          blurb: "All accounts at a glance" },
      { key: "/finance/accounting/general-ledger", labelKey: "subtab.generalLedger", fallback: "General Ledger", icon: "contract",             blurb: "Every transaction posted" },
      { key: "/finance/accounting/profit-loss",    labelKey: "subtab.profitLoss",    fallback: "Profit & Loss",  icon: "file-invoice-dollar",  blurb: "Income statement view" },
      { key: "/finance/accounting/cash-flow",      labelKey: "subtab.cashFlow",      fallback: "Cash Flow",      icon: "wallet",               blurb: "Operating · investing · financing" },
      { key: "/finance/accounting/equity",         labelKey: "subtab.equity",        fallback: "Equity",         icon: "coins",                blurb: "Owners' equity changes" },
    ],
  },
  {
    id: "banking",
    labelKey: "tabs.banking",
    fallback: "Banking",
    accent: ACCENT.teal,
    items: [
      { key: "/finance/bank-accounts",   labelKey: "subtab.bankAccounts",   fallback: "Bank Accounts",   icon: "bank",        blurb: "Active accounts + balances" },
      { key: "/finance/bank-imports",    labelKey: "subtab.bankImports",    fallback: "Bank Imports",    icon: "upload",      blurb: "CSV / OFX statements" },
      { key: "/finance/reconciliation",  labelKey: "subtab.reconciliation", fallback: "Reconciliation",  icon: "badge-check", blurb: "Match books to bank" },
      { key: "/finance/payments",        labelKey: "subtab.payments",       fallback: "Payments",        icon: "wallet",      blurb: "Outgoing + incoming" },
    ],
  },
  {
    id: "treasury",
    labelKey: "subtab.treasuryPlans",
    fallback: "Treasury",
    accent: ACCENT.amber,
    items: [
      { key: "/finance/treasury-forecast", labelKey: "subtab.cashForecast",  fallback: "Cash Forecast",  icon: "arrow-up-right", blurb: "13-week cash projection" },
      { key: "/finance/treasury-plans",    labelKey: "subtab.treasuryPlans", fallback: "Treasury Plans", icon: "file-invoice",   blurb: "Long-range plans" },
      { key: "/finance/fx-rates",          labelKey: "home.map.exchangeRates", fallback: "FX Rates",     icon: "coins",          blurb: "Multi-currency rates" },
    ],
  },
  {
    id: "reports",
    labelKey: "subtab.reports",
    fallback: "Reports",
    accent: ACCENT.violet,
    items: [
      { key: "/finance/statements",    labelKey: "subtab.detailedStatements", fallback: "Statements",     icon: "balance-scale-left", blurb: "Detailed financial statements" },
      { key: "/finance/reports",       labelKey: "subtab.operationalReports", fallback: "Reports",        icon: "file-invoice",       blurb: "Operational reports" },
      { key: "/finance/intelligence",  labelKey: "subtab.intelligence",       fallback: "Intelligence",   icon: "signal-stream",      blurb: "Insights + alerts" },
    ],
  },
  {
    id: "setup",
    labelKey: "subtab.setup",
    fallback: "Setup",
    accent: ACCENT.rose,
    items: [
      { key: "/finance/approvals",     labelKey: "subtab.approvals",     fallback: "Approvals",     icon: "shield-check", blurb: "Approval workflows" },
      { key: "/finance/notifications", labelKey: "subtab.reminders",     fallback: "Notifications", icon: "clock",        blurb: "Reminders + alerts" },
      { key: "/finance/setup",         labelKey: "subtab.setup",         fallback: "Setup",         icon: "shield-check", blurb: "Chart of accounts + rules" },
      { key: "/finance/workspace",     labelKey: "subtab.workspace",     fallback: "Workspace",     icon: "bank",         blurb: "Pro accounting workspace" },
    ],
  },
];

export default function FinanceHeader({
  title,
  subtitle,
  action,
  controls,
  health,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  health?: HealthStatus;
  showTabs?: boolean;
}) {
  const { t } = useTranslation(financeT);

  const tabs: PageTab[] = PRIMARY_TABS_RAW.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: t(tab.labelKey, tab.fallback),
  }));

  const overflowTabs: NavGroup[] = OVERFLOW_GROUPS_RAW.map((g) => ({
    id: g.id,
    label: t(g.labelKey, g.fallback),
    accent: g.accent,
    items: g.items.map((it) => ({
      key: it.key,
      icon: it.icon,
      label: t(it.labelKey, it.fallback),
      blurb: it.blurb,
    })),
  }));

  const createBtn = (
    <Button
      onClick={() => openSmartCreate()}
      icon="plus"
      title={t("header.createTitle", "Create (c)")}
      aria-label={t("header.createAria", "Open Smart Create drawer (shortcut: c)")}
    >
      {t("header.create", "Create")}
    </Button>
  );

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon="coins"
      action={
        <>
          {createBtn}
          {action}
        </>
      }
      controls={controls}
      meta={health && health !== "unknown" ? <HealthPill status={health} /> : undefined}
      tabs={tabs}
      overflowTabs={overflowTabs}
      popupTitle={t("app.title", "Finance")}
      popupSubtitle={t("header.popupSubtitle", "Pick where to go.")}
      showTabs={showTabs}
      searchPlaceholder={SEARCH_PLACEHOLDERS.finance}
      searchHref="/inventory/search"
    />
  );
}

/* Compact health pill — re-exported for callers that render it inline. */
export function HealthPill({ status }: { status: HealthStatus }) {
  const s = HEALTH_STYLE[status];
  const { t } = useTranslation(financeT);
  return (
    <span
      title={t(s.hintKey, s.hintFallback)}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-highlight)]"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {t(s.labelKey, s.labelFallback)}
    </span>
  );
}

/* Legacy alias */
export { HealthPill as HealthBadge };
