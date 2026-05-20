"use client";

import type { ReactNode } from "react";
import { SegmentedNav } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { expensesT } from "@/lib/translations/expenses";

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

const TABS: { key: ExpensesTabKey; labelKey: string; fallback: string; icon: ReactNode }[] = [
  { key: "all",     labelKey: "tabs.all",     fallback: "All",     icon: <RrIcon name="document" size={12} /> },
  { key: "unpaid",  labelKey: "tabs.unpaid",  fallback: "Unpaid",  icon: <RrIcon name="clock" size={12} /> },
  { key: "paid",    labelKey: "tabs.paid",    fallback: "Paid",    icon: <RrIcon name="check" size={12} /> },
  { key: "overdue", labelKey: "tabs.overdue", fallback: "Overdue", icon: <RrIcon name="info" size={12} /> },
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
    <SegmentedNav
      activeKey={value}
      onChange={(k) => onChange(k as ExpensesTabKey)}
      items={TABS.map((tab) => ({
        key: tab.key,
        label: t(tab.labelKey, tab.fallback),
        count: counts[tab.key],
        icon: <span className="text-gray-500" aria-hidden>{tab.icon}</span>,
      }))}
    />
  );
}
