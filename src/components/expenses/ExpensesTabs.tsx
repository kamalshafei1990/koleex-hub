"use client";

import type { ReactNode } from "react";
import { SegmentedNav } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

const TABS: { key: ExpensesTabKey; label: string; icon: ReactNode }[] = [
  { key: "all",     label: "All",     icon: <RrIcon name="document" size={12} /> },
  { key: "unpaid",  label: "Unpaid",  icon: <RrIcon name="clock" size={12} /> },
  { key: "paid",    label: "Paid",    icon: <RrIcon name="check" size={12} /> },
  { key: "overdue", label: "Overdue", icon: <RrIcon name="info" size={12} /> },
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
