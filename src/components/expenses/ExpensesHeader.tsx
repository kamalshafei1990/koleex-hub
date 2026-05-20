"use client";

/* ---------------------------------------------------------------------------
   ExpensesHeader  —  Phase 1.5 alignment with the Koleex Hub native
   page bar (back arrow + app icon + h1 + action button + sub-nav).
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
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
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label={t("header.backHub", "Back to Hub")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <RrIcon name="receipt" size={16} />
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
            {subtitle && <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/finance/expenses"
            className="hidden items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-dim)] transition hover:text-[var(--text-primary)] sm:inline-flex"
            title={t("header.analyticsTitle", "Switch to the executive Expense Analytics view")}
          >
            {t("header.financeAnalytics", "Finance Analytics")}
            <RrIcon name="arrow-up-right-from-square" size={11} />
          </Link>
          {action}
        </div>
      </div>

      <div className="mt-5">
        <ExpensesTabs value={tab} onChange={onTabChange} counts={counts} />
      </div>
    </div>
  );
}
