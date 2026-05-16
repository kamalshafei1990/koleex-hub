"use client";

/* ---------------------------------------------------------------------------
   ExpensesHeader  —  Phase 1.5 alignment with the Koleex Hub native
   page bar (back arrow + app icon + h1 + action button + sub-nav).
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ExpensesIcon from "@/components/icons/ExpensesIcon";
import ExpensesTabs, { type ExpensesTabKey } from "@/components/expenses/ExpensesTabs";

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
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Hub"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <ExpensesIcon size={16} />
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
            title="Switch to the executive Expense Analytics view"
          >
            Finance Analytics ↗
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
