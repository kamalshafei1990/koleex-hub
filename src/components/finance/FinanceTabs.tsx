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
    <nav aria-label="Finance sections" className="overflow-x-auto">
      <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] p-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/finance" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "rounded-lg px-3.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition " +
                (active
                  ? "bg-white/[0.10] text-[var(--text-primary)] shadow-sm"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
