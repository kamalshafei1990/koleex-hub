"use client";

/* Sub-navigation pill row for the Finance app. Lives at the top of
   every Finance page so the operator can jump between Dashboard,
   Orders, Expenses, Customers, Suppliers, Payments, Notifications. */

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Finance sub-nav.
   Note: "Expense Analytics" links to /finance/expenses (the executive
   insights view). Daily expense ENTRY happens in the separate Expenses
   app at /expenses — accessed from the main sidebar — so junior finance
   can be granted entry without seeing the Finance module. */
const TABS = [
  { href: "/finance",                label: "Dashboard" },
  { href: "/finance/orders",         label: "Orders" },
  { href: "/finance/expenses",       label: "Expense Analytics" },
  { href: "/finance/customers",      label: "Customers" },
  { href: "/finance/suppliers",      label: "Suppliers" },
  { href: "/finance/payments",       label: "Payments" },
  { href: "/finance/notifications",  label: "Reminders" },
];

export default function FinanceTabs() {
  const pathname = usePathname();
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex rounded-xl border border-white/[0.06] bg-[var(--bg-secondary)] p-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition " +
                (active
                  ? "bg-white/10 text-[var(--text-primary)]"
                  : "text-gray-400 hover:text-gray-200")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
