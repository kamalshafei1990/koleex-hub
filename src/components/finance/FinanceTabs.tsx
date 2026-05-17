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

interface TabEntry {
  key: string;          // route
  label: string;
  icon: RrIconName;
}

interface TabGroup {
  id: string;
  label: string;
  /* Default destination when the user clicks the group label.
     Usually the first sub-item. */
  defaultHref: string;
  items: TabEntry[];
}

const GROUPS: TabGroup[] = [
  {
    id: "overview",
    label: "Overview",
    defaultHref: "/finance",
    items: [
      { key: "/finance", label: "Dashboard", icon: "coins" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    defaultHref: "/finance/orders",
    items: [
      { key: "/finance/orders",    label: "Orders",            icon: "file-invoice" },
      { key: "/finance/customers", label: "Customers",         icon: "arrow-down-left" },
      { key: "/finance/suppliers", label: "Suppliers",         icon: "arrow-up-right" },
      { key: "/finance/payments",  label: "Payments",          icon: "wallet" },
      { key: "/finance/expenses",  label: "Expense Analytics", icon: "receipt" },
    ],
  },
  {
    id: "banking",
    label: "Banking",
    defaultHref: "/finance/bank-accounts",
    items: [
      { key: "/finance/bank-accounts",  label: "Bank Accounts",  icon: "bank" },
      { key: "/finance/bank-imports",   label: "Bank Imports",   icon: "upload" },
      { key: "/finance/reconciliation", label: "Reconciliation", icon: "badge-check" },
    ],
  },
  {
    id: "treasury",
    label: "Treasury",
    defaultHref: "/finance/treasury-forecast",
    items: [
      { key: "/finance/treasury-forecast", label: "Forecast", icon: "arrow-up-right" },
      { key: "/finance/treasury-plans",    label: "Plans",    icon: "file-invoice" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    defaultHref: "/finance/accounting/queue",
    items: [
      { key: "/finance/accounting/queue",          label: "Queue",           icon: "clock" },
      { key: "/finance/accounting/trial-balance",  label: "Trial Balance",   icon: "badge-check" },
      { key: "/finance/accounting/general-ledger", label: "General Ledger",  icon: "contract" },
      { key: "/finance/accounting/profit-loss",    label: "Profit & Loss",   icon: "file-invoice-dollar" },
      { key: "/finance/accounting/cash-flow",      label: "Cash Flow",       icon: "wallet" },
      { key: "/finance/accounting/equity",         label: "Equity",          icon: "coins" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    defaultHref: "/finance/reports",
    items: [
      { key: "/finance/reports",       label: "Reports",   icon: "file-invoice" },
      { key: "/finance/notifications", label: "Reminders", icon: "clock" },
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

  return (
    <nav aria-label="Finance navigation" className="space-y-2">
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
              {g.label}
            </Link>
          );
        })}
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
                {it.label}
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
