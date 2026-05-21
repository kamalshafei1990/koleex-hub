"use client";

/* ===========================================================================
   FinanceTabs — Operator-first rebuild.

   Replaces the previous 5-group/25-link nav with a flat 7-tab structure
   the founder can scan in one glance:

     Row 1 (always visible):
       Home · Overview · Orders · Customers · Suppliers · Expenses · Accounting ▾

   Row 2 (only when on Accounting):
       Queue · Trial Balance · General Ledger · Profit & Loss · Cash Flow ·
       Equity · Bank Accounts · Bank Imports · Reconciliation ·
       Treasury Forecast · Treasury Plans · FX Rates · Statements ·
       Reports · Approvals · Notifications · Intelligence

   Why this shape: the operator wanted Coffee-Inc-2 simplicity — the 6
   things they actually use day-to-day are top-level. Every professional
   accounting feature is preserved, just collected under a single
   "Accounting" tab so it's no longer in the operator's face every visit.
   ========================================================================== */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

interface TabEntry {
  key: string;          // route
  labelKey: string;
  fallback: string;
  icon: RrIconName;
}

/* The 5 operator tabs that always sit on row 1.
   /finance IS the Overview dashboard now — no separate Home tab. */
const PRIMARY: TabEntry[] = [
  { key: "/finance",           labelKey: "tabs.overview",    fallback: "Overview",  icon: "balance-scale-left" },
  { key: "/finance/orders",    labelKey: "subtab.orders",    fallback: "Orders",    icon: "file-invoice" },
  { key: "/finance/customers", labelKey: "subtab.customers", fallback: "Customers", icon: "arrow-down-left" },
  { key: "/finance/suppliers", labelKey: "subtab.suppliers", fallback: "Suppliers", icon: "arrow-up-right" },
  { key: "/finance/expenses",  labelKey: "subtab.expenses",  fallback: "Expenses",  icon: "receipt" },
];

/* Everything else — the full professional accounting depth — sits under
   one "Accounting" tab. Nothing is removed; it's just collected. */
const ACCOUNTING: TabEntry[] = [
  { key: "/finance/accounting/queue",          labelKey: "subtab.queue",              fallback: "Queue",            icon: "clock" },
  { key: "/finance/accounting/trial-balance",  labelKey: "subtab.trialBalance",       fallback: "Trial Balance",    icon: "badge-check" },
  { key: "/finance/accounting/general-ledger", labelKey: "subtab.generalLedger",      fallback: "General Ledger",   icon: "contract" },
  { key: "/finance/accounting/profit-loss",    labelKey: "subtab.profitLoss",         fallback: "Profit & Loss",    icon: "file-invoice-dollar" },
  { key: "/finance/accounting/cash-flow",      labelKey: "subtab.cashFlow",           fallback: "Cash Flow",        icon: "wallet" },
  { key: "/finance/accounting/equity",         labelKey: "subtab.equity",             fallback: "Equity",           icon: "coins" },
  { key: "/finance/bank-accounts",             labelKey: "subtab.bankAccounts",       fallback: "Bank Accounts",    icon: "bank" },
  { key: "/finance/bank-imports",              labelKey: "subtab.bankImports",        fallback: "Bank Imports",     icon: "upload" },
  { key: "/finance/reconciliation",            labelKey: "subtab.reconciliation",     fallback: "Reconciliation",   icon: "badge-check" },
  { key: "/finance/payments",                  labelKey: "subtab.payments",           fallback: "Payments",         icon: "wallet" },
  { key: "/finance/treasury-forecast",         labelKey: "subtab.cashForecast",       fallback: "Cash Forecast",    icon: "arrow-up-right" },
  { key: "/finance/treasury-plans",            labelKey: "subtab.treasuryPlans",      fallback: "Treasury Plans",   icon: "file-invoice" },
  { key: "/finance/fx-rates",                  labelKey: "home.map.exchangeRates",    fallback: "FX Rates",         icon: "coins" },
  { key: "/finance/statements",                labelKey: "subtab.detailedStatements", fallback: "Statements",       icon: "balance-scale-left" },
  { key: "/finance/reports",                   labelKey: "subtab.operationalReports", fallback: "Reports",          icon: "file-invoice" },
  { key: "/finance/approvals",                 labelKey: "subtab.approvals",          fallback: "Approvals",        icon: "shield-check" },
  { key: "/finance/notifications",             labelKey: "subtab.reminders",          fallback: "Notifications",    icon: "clock" },
  { key: "/finance/intelligence",              labelKey: "subtab.intelligence",       fallback: "Intelligence",     icon: "signal-stream" },
  { key: "/finance/setup",                     labelKey: "subtab.setup",              fallback: "Setup",            icon: "shield-check" },
  { key: "/finance/workspace",                 labelKey: "subtab.workspace",          fallback: "Workspace",        icon: "bank" },
  { key: "/finance/visual",                    labelKey: "subtab.visualStatements",   fallback: "Visual Statements (legacy)", icon: "balance-scale-left" },
];

/* Active resolution — longest-prefix match. /finance is special-cased so
   it doesn't claim every /finance/* route. */
function resolvePrimary(pathname: string): { primaryKey: string; isAccounting: boolean; accountingItemKey: string | null } {
  /* Accounting wins first because all its routes are under /finance/* too. */
  const a = ACCOUNTING.find((t) => pathname === t.key || pathname.startsWith(t.key + "/"));
  if (a) {
    return { primaryKey: "accounting", isAccounting: true, accountingItemKey: a.key };
  }
  /* Primary tab match (longest prefix wins, with /finance only matching exactly). */
  const p = PRIMARY
    .filter((t) => pathname === t.key || (t.key !== "/finance" && pathname.startsWith(t.key + "/")))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (p) return { primaryKey: p.key, isAccounting: false, accountingItemKey: null };
  return { primaryKey: "/finance", isAccounting: false, accountingItemKey: null };
}

export default function FinanceTabs() {
  const pathname = usePathname() ?? "/finance";
  const { primaryKey, isAccounting, accountingItemKey } = resolvePrimary(pathname);
  const { t } = useTranslation(financeT);

  return (
    <nav aria-label={t("app.title", "Finance")} className="space-y-2">
      {/* Row 1: the 6 operator tabs + Accounting */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {PRIMARY.map((tab) => {
          const isActive = tab.key === primaryKey;
          return (
            <Link
              key={tab.key}
              href={tab.key}
              className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors duration-150 ${
                isActive ? "font-medium text-[var(--text-primary)]" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {isActive && (
                <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-white/40" />
              )}
              {t(tab.labelKey, tab.fallback)}
            </Link>
          );
        })}
        <Link
          href="/finance/accounting/queue"
          className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors duration-150 ${
            isAccounting ? "font-medium text-[var(--text-primary)]" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {isAccounting && (
            <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-white/40" />
          )}
          {t("tabs.accounting", "Accounting")}
          <span aria-hidden className="text-[10px] opacity-60">▾</span>
        </Link>
      </div>

      {/* Row 2: only when the user is inside Accounting */}
      {isAccounting && (
        <div className="flex flex-wrap items-center gap-1">
          {ACCOUNTING.map((it) => {
            const isActive = it.key === accountingItemKey;
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
