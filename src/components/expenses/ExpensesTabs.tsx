"use client";

import { SegmentedNav } from "@/components/finance/FinanceUiX";

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

const TABS: { key: ExpensesTabKey; label: string; icon: string }[] = [
  { key: "all",     label: "All",     icon: "≡" },
  { key: "unpaid",  label: "Unpaid",  icon: "○" },
  { key: "paid",    label: "Paid",    icon: "✓" },
  { key: "overdue", label: "Overdue", icon: "!" },
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
  return (
    <SegmentedNav
      activeKey={value}
      onChange={(k) => onChange(k as ExpensesTabKey)}
      items={TABS.map((t) => ({
        key: t.key,
        label: t.label,
        count: counts[t.key],
        icon: <span className="text-gray-500" aria-hidden>{t.icon}</span>,
      }))}
    />
  );
}
