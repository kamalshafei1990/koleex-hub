"use client";

/* ExpensesTabs — state-based filter strip styled identically to the canonical
   PageHeader flat-border-b tab style used across Inventory · Finance · Sales · etc. */

import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { expensesT } from "@/lib/translations/expenses";

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

const TABS: { key: ExpensesTabKey; labelKey: string; fallback: string; icon: RrIconName }[] = [
  { key: "all",     labelKey: "tabs.all",     fallback: "All",     icon: "document" },
  { key: "unpaid",  labelKey: "tabs.unpaid",  fallback: "Unpaid",  icon: "clock" },
  { key: "paid",    labelKey: "tabs.paid",    fallback: "Paid",    icon: "check" },
  { key: "overdue", labelKey: "tabs.overdue", fallback: "Overdue", icon: "info" },
];

export default function ExpensesTabs({
  value,
  onChange,
  counts,
}: {
  value: ExpensesTabKey;
  onChange: (next: ExpensesTabKey) => void;
  counts: { all: number; unpaid: number; paid: number; overdue: number };
}) {
  const { t } = useTranslation(expensesT);
  return (
    <nav
      aria-label="Expenses filter"
      className="flex items-end gap-0.5 overflow-x-auto border-b border-[var(--border-subtle)]"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === value;
        const label = t(tab.labelKey, tab.fallback);
        const count = counts[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? "page" : undefined}
            title={label}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[12px] transition-colors duration-150 ${
              isActive
                ? "border-b-2 border-[var(--text-primary)] pb-0 text-[var(--text-primary)]"
                : "border-b-2 border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span aria-hidden>
              <RrIcon name={tab.icon} size={12} />
            </span>
            {label}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
              isActive
                ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                : "bg-[var(--bg-surface)] text-[var(--text-dim)]"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
