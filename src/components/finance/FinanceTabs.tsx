"use client";

/* ===========================================================================
   FinanceTabs — Phase UI.6 grouped two-row navigation.

   Replaces the previous 15-chip horizontal scrolling SegmentedNav with
   a calmer two-row pattern:

     Row 1: 6 primary group labels (always visible, no scroll)
       Overview · Operations · Banking · Treasury · Accounting · Reports

     Row 2: sub-items of the active group (contextual, hidden when the
            active group has only one entry — i.e. on Dashboard)

   Active state is inferred from the URL. Row 1 highlights the group
   the user is in; Row 2 highlights the specific sub-page.

   Why this shape: enterprise software (NetSuite, SAP Fiori, Bloomberg)
   uses grouped top-nav for exactly this — too many flat siblings is
   tiring to scan. Two compact rows beat one long scroll.
   ========================================================================== */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

interface TabEntry {
  key: string;          // route
  labelKey: string;     // i18n key in financeT
  fallback: string;     // English fallback if key missing
  icon: RrIconName;
}

interface TabGroup {
  id: string;
  labelKey: string;
  labelFallback: string;
  /* Default destination when the user clicks the group label.
     Usually the first sub-item. */
  defaultHref: string;
  /* One-line operator-friendly description shown under the row 2
     sub-nav when this group is active — translated, see hintKey. */
  hintKey: string;
  hintFallback: string;
  items: TabEntry[];
}

const GROUPS: TabGroup[] = [
  {
    id: "overview",
    labelKey: "tabs.overview",
    labelFallback: "Overview",
    defaultHref: "/finance",
    hintKey: "tabs.overview.hint",
    hintFallback: "Start here — four clear paths and your essential KPIs. Setup + Intelligence live here too.",
    items: [
      { key: "/finance",              labelKey: "subtab.home",          fallback: "Home",         icon: "coins" },
      { key: "/finance/intelligence", labelKey: "subtab.intelligence",  fallback: "Intelligence", icon: "signal-stream" },
      { key: "/finance/workspace",    labelKey: "subtab.workspace",     fallback: "Workspace",    icon: "bank" },
      { key: "/finance/setup",        labelKey: "subtab.setup",         fallback: "Setup",        icon: "shield-check" },
    ],
  },
  {
    id: "operations",
    labelKey: "tabs.operations",
    labelFallback: "Operations",
    defaultHref: "/finance/orders",
    hintKey: "tabs.operations.hint",
    hintFallback: "Daily transactions — orders, customers, suppliers, payments, expenses.",
    items: [
      { key: "/finance/orders",    labelKey: "subtab.orders",            fallback: "Orders",            icon: "file-invoice" },
      { key: "/finance/customers", labelKey: "subtab.customers",         fallback: "Customers",         icon: "arrow-down-left" },
      { key: "/finance/suppliers", labelKey: "subtab.suppliers",         fallback: "Suppliers",         icon: "arrow-up-right" },
      { key: "/finance/payments",  labelKey: "subtab.payments",          fallback: "Payments",          icon: "wallet" },
      { key: "/finance/expenses",  labelKey: "subtab.expenseAnalytics",  fallback: "Expense Analytics", icon: "receipt" },
    ],
  },
  {
    id: "cash",
    labelKey: "tabs.cashBanking",
    labelFallback: "Cash & Banking",
    defaultHref: "/finance/bank-accounts",
    hintKey: "tabs.cashBanking.hint",
    hintFallback: "Bank balances, statement imports, reconciliation, and forward cash forecast.",
    items: [
      { key: "/finance/bank-accounts",     labelKey: "subtab.bankAccounts",   fallback: "Bank Accounts",   icon: "bank" },
      { key: "/finance/bank-imports",      labelKey: "subtab.bankImports",    fallback: "Bank Imports",    icon: "upload" },
      { key: "/finance/reconciliation",    labelKey: "subtab.reconciliation", fallback: "Reconciliation",  icon: "badge-check" },
      { key: "/finance/treasury-forecast", labelKey: "subtab.cashForecast",   fallback: "Cash Forecast",   icon: "arrow-up-right" },
      { key: "/finance/treasury-plans",    labelKey: "subtab.treasuryPlans",  fallback: "Treasury Plans",  icon: "file-invoice" },
    ],
  },
  {
    id: "accounting",
    labelKey: "tabs.accounting",
    labelFallback: "Accounting",
    defaultHref: "/finance/accounting/queue",
    hintKey: "tabs.accounting.hint",
    hintFallback: "Ledger work — review journal drafts, post entries, inspect the ledger.",
    items: [
      { key: "/finance/accounting/queue",          labelKey: "subtab.queue",          fallback: "Queue",          icon: "clock" },
      { key: "/finance/accounting/trial-balance",  labelKey: "subtab.trialBalance",   fallback: "Trial Balance",  icon: "badge-check" },
      { key: "/finance/accounting/general-ledger", labelKey: "subtab.generalLedger",  fallback: "General Ledger", icon: "contract" },
      { key: "/finance/accounting/profit-loss",    labelKey: "subtab.profitLoss",     fallback: "Profit & Loss",  icon: "file-invoice-dollar" },
      { key: "/finance/accounting/cash-flow",      labelKey: "subtab.cashFlow",       fallback: "Cash Flow",      icon: "wallet" },
      { key: "/finance/accounting/equity",         labelKey: "subtab.equity",         fallback: "Equity",         icon: "coins" },
    ],
  },
  {
    id: "reports",
    labelKey: "tabs.reports",
    labelFallback: "Reports",
    defaultHref: "/finance/visual",
    hintKey: "tabs.reports.hint",
    hintFallback: "Read the books — income statement, balance sheet, cash flow, AR/AP aging.",
    items: [
      { key: "/finance/visual",        labelKey: "subtab.visualStatements",   fallback: "Visual Statements",   icon: "balance-scale-left" },
      { key: "/finance/statements",    labelKey: "subtab.detailedStatements", fallback: "Detailed Statements", icon: "balance-scale-left" },
      { key: "/finance/reports",       labelKey: "subtab.operationalReports", fallback: "Operational Reports", icon: "file-invoice" },
      { key: "/finance/notifications", labelKey: "subtab.reminders",          fallback: "Reminders",           icon: "clock" },
    ],
  },
];

/* Flat list of every sub-item so we can resolve the active route. */
const ALL_ITEMS: Array<TabEntry & { groupId: string }> = GROUPS.flatMap((g) =>
  g.items.map((it) => ({ ...it, groupId: g.id })),
);

function resolveActive(pathname: string): { groupId: string; itemKey: string } {
  /* Longest-prefix match — keeps nested routes (e.g. /finance/orders/123)
     lit on the right tab. The pure /finance match is special-cased so
     it doesn't claim every /finance/* path. */
  const match = ALL_ITEMS
    .filter((t) => pathname === t.key || (t.key !== "/finance" && pathname.startsWith(t.key)))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (match) return { groupId: match.groupId, itemKey: match.key };
  return { groupId: "overview", itemKey: "/finance" };
}

export default function FinanceTabs() {
  const pathname = usePathname() ?? "/finance";
  const { groupId, itemKey } = resolveActive(pathname);
  const activeGroup = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const { t } = useTranslation(financeT);

  return (
    <nav aria-label={t("app.title", "Finance")} className="space-y-2">
      {/* ── Row 1: primary groups — always visible, no scrolling. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {GROUPS.map((g) => {
          const isActive = g.id === groupId;
          return (
            <Link
              key={g.id}
              href={g.defaultHref}
              className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors duration-150 ${
                isActive
                  ? "font-medium text-[var(--text-primary)]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-white/40"
                />
              )}
              {t(g.labelKey, g.labelFallback)}
            </Link>
          );
        })}
      </div>

      {/* "What this tab is for" — single sentence so the operator
          knows whether to ADD or READ data on the pages below. */}
      <div className="text-[10.5px] text-gray-500">
        {t(activeGroup.hintKey, activeGroup.hintFallback)}
      </div>

      {/* ── Row 2: contextual sub-items — only shown when the active
            group has more than one entry. On Dashboard (Overview), the
            group has a single item so this row collapses. */}
      {activeGroup.items.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {activeGroup.items.map((it) => {
            const isActive = it.key === itemKey;
            return (
              <Link
                key={it.key}
                href={it.key}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ${
                  isActive
                    ? "border-white/[0.10] bg-white/[0.04] text-[var(--text-primary)]"
                    : "border-transparent text-gray-500 hover:border-white/[0.06] hover:text-gray-300"
                }`}
              >
                <SubIcon name={it.icon} active={isActive} />
                {t(it.labelKey, it.fallback)}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function SubIcon({ name, active }: { name: RrIconName; active: boolean }): ReactNode {
  return (
    <span aria-hidden className={active ? "text-gray-300" : "text-gray-600"}>
      <RrIcon name={name} size={11} />
    </span>
  );
}
