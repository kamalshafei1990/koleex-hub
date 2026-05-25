"use client";

/* ---------------------------------------------------------------------------
   ExpensesHeader — thin wrapper around the shared PageHeader.

   Expenses uses state-based filter tabs (All / Unpaid / Paid / Overdue),
   not routes — so they render via a custom <ExpensesFilterTabs/> strip
   styled identically to the canonical PageHeader tab strip.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import RrIcon from "@/components/ui/RrIcon";
import ExpensesTabs, { type ExpensesTabKey } from "@/components/expenses/ExpensesTabs";
import { useTranslation } from "@/lib/i18n";
import { expensesT } from "@/lib/translations/expenses";

export default function ExpensesHeader({
  title,
  subtitle,
  action,
  tab,
  onTabChange,
  counts,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tab: ExpensesTabKey;
  onTabChange: (next: ExpensesTabKey) => void;
  counts: { all: number; unpaid: number; paid: number; overdue: number };
}) {
  const { t } = useTranslation(expensesT);

  const analyticsLink = (
    <Link
      href="/finance/expenses"
      className="hidden items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-dim)] transition hover:text-[var(--text-primary)] sm:inline-flex"
      title={t("header.analyticsTitle", "Switch to the executive Expense Analytics view")}
    >
      {t("header.financeAnalytics", "Finance Analytics")}
      <RrIcon name="arrow-up-right-from-square" size={11} />
    </Link>
  );

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon="receipt"
        action={
          <>
            {analyticsLink}
            {action}
          </>
        }
        showTabs={false}
      />
      {/* Filter tab strip — restyled to match canonical PageHeader tabs */}
      <div className="mt-5">
        <ExpensesTabs value={tab} onChange={onTabChange} counts={counts} />
      </div>
    </div>
  );
}
