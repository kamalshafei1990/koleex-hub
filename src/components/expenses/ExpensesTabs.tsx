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
      className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-all duration-200 ${
              isActive
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
                : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            }`}
          >
            <RrIcon name={tab.icon} size={12} className={isActive ? "" : "text-[var(--text-dim)]"} />
            {label}
            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
              isActive
                ? "bg-[var(--text-inverted)]/15 text-[var(--text-inverted)]"
                : "bg-[var(--bg-surface-hover)] text-[var(--text-dim)]"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
