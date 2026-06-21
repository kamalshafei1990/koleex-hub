"use client";

/* ExpensesTabs — state-based filter strip styled identically to the canonical
   PageHeader flat-border-b tab style used across Inventory · Finance · Sales · etc. */

import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import TabStrip from "@/components/ui/TabStrip";
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
    <TabStrip
      ariaLabel="Expenses filter"
      items={TABS.map((tab) => ({
        key: tab.key,
        label: t(tab.labelKey, tab.fallback),
        icon: <RrIcon name={tab.icon} size={12} />,
        active: tab.key === value,
        onClick: () => onChange(tab.key),
        badge: counts[tab.key],
      }))}
    />
  );
}
