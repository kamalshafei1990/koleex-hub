"use client";

/* ===========================================================================
   useExpenseFilter — combined filter + counts for the Expenses app.

   Before this hook existed, ExpensesApp.tsx (1200+ lines) carried three
   intertwined useMemos: `filtered`, `approvalCounts`, and `counts`. They
   shared inputs but lived alongside the rest of the component, making
   the filter logic hard to read and hard to test. This hook owns all
   three.

   Inputs (all "current state of the page"):
     · expenses          — the full row set from /api/expenses
     · tab               — payment-state tab: all | paid | unpaid | overdue
     · search            — text query against title / notes / category name
     · categoryFilter    — selected category id, or null for "any"
     · approvalFilter    — approval-state quick filter (see ApprovalFilterKey)
     · today             — yyyy-mm-dd string (passed in to keep the hook pure
                            wrt render time — see ExpensesApp's nowMs anchor)
     · pendingDeleteId   — row in the undo-grace window; hidden from the list
                            so the operator experiences an instant delete

   Outputs:
     · filtered         — the visible row set
     · counts           — { all, unpaid, paid, overdue } for the tab strip
     · approvalCounts   — counts per approval-filter key for the chip row
   ========================================================================== */

import { useMemo } from "react";
import type { ApprovalStatus, FinanceExpense } from "@/lib/finance/types";

export type ExpensesTabKey = "all" | "unpaid" | "paid" | "overdue";

export type ApprovalFilterKey =
  | "all"
  | "needs_review"
  | "draft"
  | "rejected"
  | "requires_changes"
  | "approved";

export interface ExpenseFilterInput {
  expenses: FinanceExpense[];
  tab: ExpensesTabKey;
  search: string;
  categoryFilter: string | null;
  approvalFilter: ApprovalFilterKey;
  today: string;
  pendingDeleteId: string | null;
}

export interface ExpenseFilterOutput {
  filtered: FinanceExpense[];
  counts: { all: number; unpaid: number; paid: number; overdue: number };
  approvalCounts: Record<ApprovalFilterKey, number>;
}

/* Reusable approval-state predicate so the filter and the counts agree
   on what each chip means. */
function matchesApproval(approval: ApprovalStatus, key: ApprovalFilterKey): boolean {
  switch (key) {
    case "all":              return true;
    case "needs_review":     return approval === "submitted" || approval === "under_review";
    case "draft":            return approval === "draft";
    case "rejected":         return approval === "rejected";
    case "requires_changes": return approval === "requires_changes";
    case "approved":         return approval === "approved" || approval === "partially_approved";
  }
}

export function useExpenseFilter(input: ExpenseFilterInput): ExpenseFilterOutput {
  const { expenses, tab, search, categoryFilter, approvalFilter, today, pendingDeleteId } = input;

  return useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered: FinanceExpense[] = [];

    const approvalCounts: Record<ApprovalFilterKey, number> = {
      all: expenses.length,
      needs_review: 0,
      draft: 0,
      rejected: 0,
      requires_changes: 0,
      approved: 0,
    };
    let unpaid = 0, paid = 0, overdueAll = 0;

    for (const e of expenses) {
      /* Top-line counts run over the full row set so the chip badges
         don't move when the operator narrows the view. */
      const isOverdue = e.payment_status !== "paid" && !!e.due_date && e.due_date < today;
      if (e.payment_status === "paid") paid += 1; else unpaid += 1;
      if (isOverdue) overdueAll += 1;

      const a = (e.approval_status ?? "draft") as ApprovalStatus;
      if (matchesApproval(a, "needs_review"))     approvalCounts.needs_review += 1;
      if (matchesApproval(a, "draft"))            approvalCounts.draft += 1;
      if (matchesApproval(a, "rejected"))         approvalCounts.rejected += 1;
      if (matchesApproval(a, "requires_changes")) approvalCounts.requires_changes += 1;
      if (matchesApproval(a, "approved"))         approvalCounts.approved += 1;

      /* Now the row-visibility filter. */
      if (tab === "paid"    && e.payment_status !== "paid") continue;
      if (tab === "unpaid"  && e.payment_status === "paid") continue;
      if (tab === "overdue" && !isOverdue)                   continue;
      if (pendingDeleteId === e.id)                          continue;
      if (categoryFilter && e.category_id !== categoryFilter) continue;
      if (approvalFilter !== "all" && !matchesApproval(a, approvalFilter)) continue;
      if (needle) {
        const hay = `${e.title} ${e.notes ?? ""} ${e.category_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      filtered.push(e);
    }

    return {
      filtered,
      counts: { all: expenses.length, unpaid, paid, overdue: overdueAll },
      approvalCounts,
    };
  }, [expenses, tab, search, categoryFilter, approvalFilter, today, pendingDeleteId]);
}
