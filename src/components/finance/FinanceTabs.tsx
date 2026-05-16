"use client";

/* Sub-navigation pill row for the Finance app.

   Wraps SegmentedNav with the route-based tab list. Active matching
   walks the path so /finance/orders/123 keeps "Orders" lit, not just
   /finance/orders. */

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SegmentedNav } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";

const TABS: { key: string; label: string; icon: ReactNode }[] = [
  { key: "/finance",                label: "Dashboard",         icon: <RrIcon name="coins" size={12} /> },
  { key: "/finance/orders",         label: "Orders",            icon: <RrIcon name="file-invoice" size={12} /> },
  { key: "/finance/expenses",       label: "Expense Analytics", icon: <RrIcon name="receipt" size={12} /> },
  { key: "/finance/customers",      label: "Customers",         icon: <RrIcon name="arrow-down-left" size={12} /> },
  { key: "/finance/suppliers",      label: "Suppliers",         icon: <RrIcon name="arrow-up-right" size={12} /> },
  { key: "/finance/payments",       label: "Payments",          icon: <RrIcon name="wallet" size={12} /> },
  { key: "/finance/bank-accounts",  label: "Bank Accounts",     icon: <RrIcon name="bank" size={12} /> },
  { key: "/finance/bank-imports",   label: "Bank Imports",      icon: <RrIcon name="upload" size={12} /> },
  { key: "/finance/reconciliation", label: "Reconciliation",    icon: <RrIcon name="badge-check" size={12} /> },
  { key: "/finance/treasury-forecast", label: "Forecast",       icon: <RrIcon name="arrow-up-right" size={12} /> },
  { key: "/finance/treasury-plans",    label: "Plans",          icon: <RrIcon name="file-invoice" size={12} /> },
  { key: "/finance/reports",        label: "Reports",           icon: <RrIcon name="file-invoice" size={12} /> },
  { key: "/finance/notifications",  label: "Reminders",         icon: <RrIcon name="clock" size={12} /> },
];

export default function FinanceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  /* Pick the longest matching prefix so nested routes light up the right tab. */
  const active = TABS
    .filter((t) => pathname === t.key || (t.key !== "/finance" && pathname.startsWith(t.key)))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key ?? "/finance";

  return (
    <SegmentedNav
      activeKey={active}
      onChange={(href) => router.push(href)}
      items={TABS.map((t) => ({
        key: t.key,
        label: t.label,
        icon: <span className="text-gray-500" aria-hidden>{t.icon}</span>,
      }))}
    />
  );
}
