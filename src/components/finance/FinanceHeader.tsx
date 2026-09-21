"use client";

/* ---------------------------------------------------------------------------
   FinanceHeader — thin wrapper around the shared PageHeader.

   Same chrome as every other Hub app:
     · 6 primary tabs: Home · Orders · Customers · Suppliers · Expenses ·
       Accounting (the queue)
     · the ··· popup lists every other finance route, grouped by what the
       operator is doing — Books · Statements · Bank · Treasury · Reports ·
       Setup — with a one-line blurb each, translated like the labels.

   TWO HALVES, ONE HEADER. `FinanceHeader` (what every page renders) draws
   nothing: it publishes the page's title, subtitle and actions to
   finance-header-slot. `FinanceHeaderFrame` (rendered once by the /finance
   layout) draws the header from that slot. The strip therefore survives
   every tab switch — it is the same DOM, only its words change — which is
   the difference between "switching a tab" and "opening a new page". See
   the slot module for the full reasoning.
   --------------------------------------------------------------------------- */

import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import PageHeader, { type PageTab } from "@/components/ui/PageHeader";
import {
  publishFinanceHeader,
  useFinanceHeaderSlot,
  type FinanceHealthStatus,
  type FinanceHeaderSlot,
} from "@/components/finance/finance-header-slot";
import type { NavGroup } from "@/components/ui/PageNavPopup";
import Button from "@/components/ui/Button";
import { openSmartCreate } from "@/components/ui/create/SmartCreateDrawer";
import { useTranslation } from "@/lib/i18n";
import { FIN_APP } from "@/lib/translations/finance/app";
import { FIN_HEADER } from "@/lib/translations/finance/header";
import { ACCENT } from "@/lib/accentColors";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import AppIcon from "@/components/common/AppIcon";
import { warmFinanceRoute } from "@/lib/finance/prefetch";

/* Only the namespaces this screen actually reads — see finance.ts. */
const DICT = { ...FIN_APP, ...FIN_HEADER } as const;

export type HealthStatus = FinanceHealthStatus;

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

type RawTab = { key: string; labelKey: string; fallback: string; icon: PageTab["icon"] };
type RawItem = { key: string; labelKey: string; fallback: string; icon: NavGroup["items"][number]["icon"]; blurbKey: string; blurb: string };
type RawGroup = { id: string; labelKey: string; fallback: string; accent: NavGroup["accent"]; items: RawItem[] };

/* The 5 operator tabs + Accounting entry. */
const PRIMARY_TABS_RAW: RawTab[] = [
  { key: "/finance",                    labelKey: "tabs.overview",    fallback: "Overview",   icon: "balance-scale-left" },
  { key: "/finance/orders",             labelKey: "subtab.orders",    fallback: "Orders",     icon: "file-invoice" },
  { key: "/finance/customers",          labelKey: "subtab.customers", fallback: "Customers",  icon: "arrow-down-left" },
  { key: "/finance/suppliers",          labelKey: "subtab.suppliers", fallback: "Suppliers",  icon: "arrow-up-right" },
  { key: "/finance/expenses",           labelKey: "subtab.expenses",  fallback: "Expenses",   icon: "receipt" },
  { key: "/finance/accounting/queue",   labelKey: "tabs.accounting",  fallback: "Accounting", icon: "contract" },
];

/* Every other route, grouped by the job the operator is doing. */
const OVERFLOW_GROUPS_RAW: RawGroup[] = [
  {
    id: "books", labelKey: "header.group.books", fallback: "Books", accent: ACCENT.blue,
    items: [
      { key: "/finance/accounting/queue",          labelKey: "subtab.queue",         fallback: "Accounting queue", icon: "clock",       blurbKey: "header.blurb.queue",        blurb: "Draft, review and post journal entries" },
      { key: "/finance/accounting/general-ledger", labelKey: "subtab.generalLedger", fallback: "General Ledger",   icon: "contract",    blurbKey: "header.blurb.gl",           blurb: "Every posted line, per account" },
      { key: "/finance/accounting/trial-balance",  labelKey: "subtab.trialBalance",  fallback: "Trial Balance",    icon: "badge-check", blurbKey: "header.blurb.tb",           blurb: "All account balances at a glance" },
      { key: "/finance/approvals",                 labelKey: "subtab.approvals",     fallback: "Approvals",        icon: "shield-check", blurbKey: "header.blurb.approvals",   blurb: "Expenses and payments awaiting sign-off" },
    ],
  },
  {
    id: "statements", labelKey: "header.group.statements", fallback: "Statements", accent: ACCENT.violet,
    items: [
      { key: "/finance/statements",             labelKey: "subtab.detailedStatements", fallback: "Statements",    icon: "balance-scale-left",  blurbKey: "header.blurb.statements", blurb: "P&L, balance sheet and cash flow together" },
      { key: "/finance/accounting/profit-loss", labelKey: "subtab.profitLoss",         fallback: "Profit & Loss", icon: "file-invoice-dollar", blurbKey: "header.blurb.pl",         blurb: "Income statement for a period" },
      { key: "/finance/accounting/cash-flow",   labelKey: "subtab.cashFlow",           fallback: "Cash Flow",     icon: "wallet",              blurbKey: "header.blurb.cf",         blurb: "Operating, investing, financing" },
      { key: "/finance/accounting/equity",      labelKey: "subtab.equity",             fallback: "Equity",        icon: "coins",               blurbKey: "header.blurb.equity",     blurb: "Owner capital and retained earnings" },
    ],
  },
  {
    id: "bank", labelKey: "tabs.banking", fallback: "Bank", accent: ACCENT.teal,
    items: [
      { key: "/finance/bank-accounts",  labelKey: "subtab.bankAccounts",   fallback: "Bank Accounts",  icon: "bank",        blurbKey: "header.blurb.banks",     blurb: "Accounts and balances" },
      { key: "/finance/payments",       labelKey: "subtab.payments",       fallback: "Payments",       icon: "wallet",      blurbKey: "header.blurb.payments",  blurb: "Money in and money out" },
      { key: "/finance/bank-imports",   labelKey: "subtab.bankImports",    fallback: "Bank Imports",   icon: "upload",      blurbKey: "header.blurb.imports",   blurb: "Load CSV / OFX statements" },
      { key: "/finance/reconciliation", labelKey: "subtab.reconciliation", fallback: "Reconciliation", icon: "badge-check", blurbKey: "header.blurb.recon",     blurb: "Match the bank to the books" },
    ],
  },
  {
    id: "treasury", labelKey: "subtab.treasuryPlans", fallback: "Treasury", accent: ACCENT.amber,
    items: [
      { key: "/finance/treasury-forecast", labelKey: "subtab.cashForecast",    fallback: "Cash Forecast",  icon: "arrow-up-right", blurbKey: "header.blurb.forecast", blurb: "13-week cash projection" },
      { key: "/finance/treasury-plans",    labelKey: "subtab.treasuryPlans",   fallback: "Treasury Plans", icon: "file-invoice",   blurbKey: "header.blurb.plans",    blurb: "Long-range cash plans" },
      { key: "/finance/fx-rates",          labelKey: "home.map.exchangeRates", fallback: "FX Rates",       icon: "coins",          blurbKey: "header.blurb.fx",       blurb: "Rates the ledger converts with" },
    ],
  },
  {
    id: "reports", labelKey: "subtab.reports", fallback: "Reports", accent: ACCENT.rose,
    items: [
      { key: "/finance/reports",       labelKey: "subtab.operationalReports", fallback: "Reports",      icon: "file-invoice",  blurbKey: "header.blurb.reports",       blurb: "Aging, expenses, order profitability" },
      { key: "/finance/intelligence",  labelKey: "subtab.intelligence",       fallback: "Intelligence", icon: "signal-stream", blurbKey: "header.blurb.intelligence",  blurb: "Insights and alerts" },
      { key: "/finance/notifications", labelKey: "subtab.reminders",          fallback: "Reminders",    icon: "clock",         blurbKey: "header.blurb.reminders",     blurb: "Due dates and follow-ups" },
    ],
  },
  {
    id: "setup", labelKey: "subtab.setup", fallback: "Setup", accent: ACCENT.blue,
    items: [
      { key: "/finance/setup",      labelKey: "subtab.setup",     fallback: "Setup",      icon: "shield-check", blurbKey: "header.blurb.setup",     blurb: "Base currency, opening balances, period close" },
      { key: "/finance/data-entry", labelKey: "header.dataEntry", fallback: "Data Entry", icon: "contract",     blurbKey: "header.blurb.dataEntry", blurb: "Where each kind of entry is made" },
      { key: "/finance/workspace",  labelKey: "subtab.workspace", fallback: "Workspace",  icon: "bank",         blurbKey: "header.blurb.workspace", blurb: "Accountant's overview and shortcuts" },
    ],
  },
];

/* Routes whose page renders <FinanceHeader/>, i.e. whose header the layout
   draws. The four screens built on ErpPage (approvals, data entry, FX rates,
   workspace) carry their own chrome and are left alone; so are the redirects
   and the print route. Kept as an explicit list rather than derived from the
   tab tables so a route cannot gain a second header by being added to the
   popup before its page is converted. */
const HOISTED_ROUTES = new Set<string>([
  "/finance",
  "/finance/orders",
  "/finance/customers",
  "/finance/suppliers",
  "/finance/expenses",
  "/finance/accounting/queue",
  "/finance/accounting/general-ledger",
  "/finance/accounting/trial-balance",
  "/finance/accounting/profit-loss",
  "/finance/accounting/cash-flow",
  "/finance/accounting/equity",
  "/finance/statements",
  "/finance/bank-accounts",
  "/finance/payments",
  "/finance/bank-imports",
  "/finance/reconciliation",
  "/finance/treasury-forecast",
  "/finance/treasury-plans",
  "/finance/reports",
  "/finance/intelligence",
  "/finance/notifications",
  "/finance/setup",
]);

/** Does the /finance layout draw the header for this route? */
export function hasHoistedHeader(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return HOISTED_ROUTES.has(p);
}

/* The tab or popup label for a route — what the frame shows as the title
   while the page for that route is still on its way (the route loader), and
   what the prerendered HTML carries before hydration. */
function routeLabel(pathname: string): RawTab | RawItem | null {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  for (const tab of PRIMARY_TABS_RAW) if (tab.key === p) return tab;
  for (const g of OVERFLOW_GROUPS_RAW) for (const it of g.items) if (it.key === p) return it;
  return null;
}

/** What a page renders. Draws nothing — it hands its words to the frame. */
export default function FinanceHeader(props: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  health?: HealthStatus;
  showTabs?: boolean;
}) {
  /* Every render, so a title that changes with state (the order editor's
     "Edit Order 1042") reaches the frame the moment it changes. A layout
     effect, so the frame repaints in the same frame as the page. */
  useLayoutEffect(() => { publishFinanceHeader(props); });
  useLayoutEffect(() => () => publishFinanceHeader(null), []);
  return null;
}

/** What the /finance layout renders, once. */
export function FinanceHeaderFrame() {
  const { t } = useTranslation(DICT);
  const pathname = usePathname() ?? "";
  const slot = useFinanceHeaderSlot();
  const searchPlaceholder = useSearchPlaceholder("finance");

  const tabs: PageTab[] = useMemo(() => PRIMARY_TABS_RAW.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: t(tab.labelKey, tab.fallback),
  })), [t]);

  const overflowTabs: NavGroup[] = useMemo(() => OVERFLOW_GROUPS_RAW.map((g) => ({
    id: g.id,
    label: t(g.labelKey, g.fallback),
    accent: g.accent,
    items: g.items.map((it) => ({
      key: it.key,
      icon: it.icon,
      label: t(it.labelKey, it.fallback),
      blurb: t(it.blurbKey, it.blurb),
    })),
  })), [t]);

  /* Between pages (the route loader is up, or the HTML has not hydrated yet)
     the frame wears the destination's tab label. The subtitle is a blank
     line on purpose: it keeps the hero the height the real subtitle will
     take, so the tab strip does not hop when the page arrives. */
  const shown: FinanceHeaderSlot | null = slot ?? (() => {
    const label = routeLabel(pathname);
    return label ? { title: t(label.labelKey, label.fallback), subtitle: "\u00A0" } : null;
  })();
  if (!shown) return null;
  const { title, subtitle, action, controls, health, showTabs = true } = shown;

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
      icon={<AppIcon appId="finance" className="h-4 w-4" size={16} />}
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
      onWarmTab={warmFinanceRoute}
      searchPlaceholder={searchPlaceholder}
      searchHref="/finance/orders"
    />
  );
}

/* Compact health pill — re-exported for callers that render it inline. */
export function HealthPill({ status }: { status: HealthStatus }) {
  const s = HEALTH_STYLE[status];
  const { t } = useTranslation(DICT);
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
