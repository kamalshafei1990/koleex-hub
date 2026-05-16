"use client";

/* Sub-navigation pill row for the Finance app.

   Wraps SegmentedNav with the route-based tab list. Active matching
   walks the path so /finance/orders/123 keeps "Orders" lit, not just
   /finance/orders. */

import { usePathname, useRouter } from "next/navigation";
import { SegmentedNav } from "@/components/finance/FinanceUiX";

const TABS: { key: string; label: string; icon: string }[] = [
  { key: "/finance",                label: "Dashboard",         icon: "◇" },
  { key: "/finance/orders",         label: "Orders",            icon: "▣" },
  { key: "/finance/expenses",       label: "Expense Analytics", icon: "△" },
  { key: "/finance/customers",      label: "Customers",         icon: "◐" },
  { key: "/finance/suppliers",      label: "Suppliers",         icon: "◑" },
  { key: "/finance/payments",       label: "Payments",          icon: "≡" },
  { key: "/finance/notifications",  label: "Reminders",         icon: "○" },
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
