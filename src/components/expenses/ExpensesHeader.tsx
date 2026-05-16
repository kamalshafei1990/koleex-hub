"use client";

/* ---------------------------------------------------------------------------
   ExpensesHeader — premium hero strip for the Expenses app.

   Mirrors FinanceHeader's structure (title + subtitle + action + sub-nav)
   so both apps feel like siblings, not strangers. Differences:

     · Accent gradient leans fuchsia/amber (vs blue/violet on Finance)
       so the user feels they're in a different app.
     · The sub-nav has fewer entries because Expenses is purpose-built
       for one workflow: All · Unpaid · Paid · Overdue.
     · A discreet "Finance Analytics ↗" context link sits in the header
       for users who have permission to both apps — pivot from
       operational entry into the executive view in one click.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
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
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(232,121,249,0.10) 0%, rgba(0,0,0,0) 55%), radial-gradient(80% 60% at 100% 0%, rgba(251,191,36,0.07) 0%, rgba(0,0,0,0) 60%)",
        }}
      />
      <div className="rounded-3xl border border-white/[0.06] bg-[var(--bg-secondary)]/60 px-5 py-5 backdrop-blur-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-gray-500">
              <span>Operations</span>
              <span className="text-gray-700">/</span>
              <span className="text-fuchsia-300">Expenses</span>
            </div>
            <h1 className="mt-1 truncate text-[22px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/finance/expenses"
              className="hidden items-center gap-1 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-white/[0.12] sm:inline-flex"
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
    </div>
  );
}
