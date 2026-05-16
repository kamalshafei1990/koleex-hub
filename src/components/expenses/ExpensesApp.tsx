"use client";

/* ---------------------------------------------------------------------------
   Expenses App  —  /expenses

   Operational expense entry tool for junior finance / admin staff. The
   sister app is the Finance dashboard at /finance, which is where
   executive numbers (net profit, margins, cash flow) live. Both apps
   read/write the SAME `finance_expenses` table — no second store, no
   duplication.

   Design priorities (in order):
     1. Add an expense in under 20 seconds.
     2. Show a clean, visual recent-expenses list.
     3. Tab between All / Unpaid / Paid / Overdue.
     4. Filter by category + month.
     5. Don't expose executive numbers (revenue, profit, margin).

   The API surface used here is /api/expenses (NOT /api/finance/expenses)
   so a tenant can grant "Expenses" module access without exposing
   "Finance" — that's how junior finance gets a useful tool without
   seeing the company's P&L. The two endpoints write the same row.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import ExpensesHeader from "@/components/expenses/ExpensesHeader";
import type { ExpensesTabKey } from "@/components/expenses/ExpensesTabs";
import { EmptyState, SectionCard, StatusBadge } from "@/components/finance/FinanceUi";
import {
  accentBgClass,
  accentSolidBg,
  styleForCategory,
} from "@/components/finance/categoryStyles";
import { fmtMoney } from "@/lib/finance/calc";
import type { ExpenseCategory, FinanceExpense } from "@/lib/finance/types";
/* Phase 2.1 — financial evidence infrastructure. The dropzone is
   imported from AttachmentPreviewDrawer; we only consume the badge
   and the drawer at the top level here. */
import { EvidenceBadge } from "@/components/attachments/EvidenceBadge";
import AttachmentPreviewDrawer from "@/components/attachments/AttachmentPreviewDrawer";
/* Phase 2.2 — approval workflow. */
import { ApprovalBadge } from "@/components/approval/ApprovalBadge";
import ApprovalReviewDrawer from "@/components/approval/ApprovalReviewDrawer";
import type { ApprovalStatus } from "@/lib/finance/types";
/* Micro-polish primitives. */
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import UndoToast from "@/components/ui/UndoToast";
/* Phase 2.5 — operational guidance. */
import GuidanceTip from "@/components/ui/GuidanceTip";

type TabKey = ExpensesTabKey;

/* Phase 2.2 — approval-state quick filter. Lives next to the existing
   payment-state tabs so an operator can scan "what needs my attention"
   without leaving the page. */
type ApprovalFilterKey =
  | "all"
  | "needs_review"     // submitted + under_review (approver view)
  | "draft"            // operator's drafts not yet submitted
  | "rejected"
  | "requires_changes"
  | "approved";

const APPROVAL_FILTER_LABELS: Record<ApprovalFilterKey, string> = {
  all:              "Any state",
  needs_review:     "Needs review",
  draft:            "Drafts",
  rejected:         "Rejected",
  requires_changes: "Changes needed",
  approved:         "Approved",
};

const CURRENCIES = ["USD", "EUR", "CNY", "EGP", "GBP"];

export default function ExpensesApp() {
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<Partial<FinanceExpense> | null>(null);
  /* Phase 2.1 — evidence drawer state. Lives at the parent so it can
     anchor to any expense row and survive list re-fetches. */
  const [evidenceExpense, setEvidenceExpense] = useState<FinanceExpense | null>(null);
  /* Phase 2.2 — approval workflow state. */
  const [reviewExpense, setReviewExpense] = useState<FinanceExpense | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilterKey>("all");
  const [canApprove, setCanApprove] = useState(false);
  /* Micro-polish — confirm + deferred-delete (undo) state. */
  const [confirmDelete, setConfirmDelete] = useState<FinanceExpense | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState<string>("");

  /* Resolve approve permission once on mount — Finance module presence
     is the gate. We optimistically hide approver actions while the
     check is in flight; server still re-validates. */
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/permitted-modules", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const modules = (j.modules ?? []) as string[];
        setCanApprove(!!j.is_super_admin || modules.includes("Finance"));
      })
      .catch(() => { /* leave false */ });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes] = await Promise.all([
        fetch("/api/expenses", { cache: "no-store" }).then((r) => r.json() as Promise<{ expenses?: FinanceExpense[] }>),
        fetch("/api/expenses/categories", { cache: "no-store" }).then((r) => r.json() as Promise<{ categories?: ExpenseCategory[] }>),
      ]);
      setExpenses(eRes.expenses ?? []);
      setCategories(cRes.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /* Stable per-mount timestamps. Captured via lazy useState so render
     stays pure under React-19's react-hooks/purity rule. */
  const [nowMs] = useState<number>(() => Date.now());
  const today = useMemo(() => new Date(nowMs).toISOString().slice(0, 10), [nowMs]);

  /* Filters: tab + search + category */
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (tab === "paid"   && e.payment_status !== "paid") return false;
      if (tab === "unpaid" && e.payment_status === "paid") return false;
      if (tab === "overdue") {
        const isOverdue = e.payment_status !== "paid" && e.due_date && e.due_date < today;
        if (!isOverdue) return false;
      }
      /* Hide rows currently in the undo-grace window so the operator
         experiences an instant delete; the real API call fires when
         the toast expires. */
      if (pendingDeleteId === e.id) return false;
      if (categoryFilter && e.category_id !== categoryFilter) return false;
      /* Phase 2.2 — approval filter. */
      if (approvalFilter !== "all") {
        const a = (e.approval_status ?? "draft") as ApprovalStatus;
        if (approvalFilter === "needs_review" && a !== "submitted" && a !== "under_review") return false;
        if (approvalFilter === "draft"            && a !== "draft")            return false;
        if (approvalFilter === "rejected"         && a !== "rejected")         return false;
        if (approvalFilter === "requires_changes" && a !== "requires_changes") return false;
        if (approvalFilter === "approved"         && a !== "approved" && a !== "partially_approved") return false;
      }
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const hay = `${e.title} ${e.notes ?? ""} ${e.category_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [expenses, tab, categoryFilter, search, today, approvalFilter, pendingDeleteId]);

  /* Counts for the approval filter strip. */
  const approvalCounts = useMemo(() => {
    const c: Record<ApprovalFilterKey, number> = {
      all: expenses.length, needs_review: 0, draft: 0, rejected: 0, requires_changes: 0, approved: 0,
    };
    for (const e of expenses) {
      const a = (e.approval_status ?? "draft") as ApprovalStatus;
      if (a === "submitted" || a === "under_review") c.needs_review += 1;
      if (a === "draft")                              c.draft += 1;
      if (a === "rejected")                           c.rejected += 1;
      if (a === "requires_changes")                   c.requires_changes += 1;
      if (a === "approved" || a === "partially_approved") c.approved += 1;
    }
    return c;
  }, [expenses]);

  /* Top-line counts shown above the tab strip */
  const counts = useMemo(() => {
    const all = expenses.length;
    const unpaid = expenses.filter((e) => e.payment_status !== "paid").length;
    const paid   = expenses.filter((e) => e.payment_status === "paid").length;
    const overdue = expenses.filter((e) => e.payment_status !== "paid" && e.due_date && e.due_date < today).length;
    return { all, unpaid, paid, overdue };
  }, [expenses, today]);

  /* Top categories for the visual tile grid (compute, not analytic) */
  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of expenses) {
      const k = e.category_name || "Other";
      const cur = map.get(k) ?? { name: k, total: 0, count: 0 };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [expenses]);

  const startNew = () => setEditing({
    title: "",
    amount: 0,
    currency: "USD",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_status: "unpaid",
    category_id: null,
  });

  /* Micro-polish — Hub-native delete flow.
     1. Operator clicks Delete on a row → opens ConfirmDialog.
     2. Operator confirms → row vanishes optimistically, Undo toast
        appears. The actual DELETE is deferred ~5 s by UndoToast's
        timer; Undo cancels it; expire fires the real API call.
     This pattern replaces the native confirm() interrupt without
     adding a recycle bin — the data dies once the toast expires. */
  const askDelete = (e: FinanceExpense) => setConfirmDelete(e);
  const startDeferredDelete = () => {
    if (!confirmDelete) return;
    setPendingDeleteId(confirmDelete.id);
    setPendingDeleteTitle(confirmDelete.title || "Expense");
    setConfirmDelete(null);
  };
  const undoDeferredDelete = () => {
    setPendingDeleteId(null);
    setPendingDeleteTitle("");
  };
  const commitDeferredDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setPendingDeleteTitle("");
    try {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    } finally {
      void load();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <ExpensesHeader
          title="Expenses"
          subtitle="Fast daily expense entry. Add receipts, track what&apos;s paid, what&apos;s due."
          tab={tab}
          onTabChange={setTab}
          counts={counts}
          action={
            <button
              type="button"
              onClick={startNew}
              className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95"
            >
              + Add Expense
            </button>
          }
        />

        {/* ── Phase 2.2 — Approval filter strip ─────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">
            <span>Approval</span>
            <GuidanceTip guidanceId="approval.status" />
          </span>
          {(Object.keys(APPROVAL_FILTER_LABELS) as ApprovalFilterKey[]).map((key) => {
            const active = approvalFilter === key;
            const count = approvalCounts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setApprovalFilter(key)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors " +
                  (active
                    ? "border-white/[0.14] bg-white/[0.08] text-[var(--text-primary)]"
                    : "border-white/[0.05] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:text-gray-200")
                }
              >
                <span>{APPROVAL_FILTER_LABELS[key]}</span>
                {count > 0 && key !== "all" && (
                  <span className={
                    "rounded-full px-1 text-[9px] tabular-nums " +
                    (active ? "bg-white/[0.12] text-gray-200" : "bg-white/[0.04] text-gray-500")
                  }>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── VISUAL CATEGORY TILES ──────────────────────────────── */}
        {topCategories.length > 0 && (
          <div className="mt-6">
            <SectionCard title="Top categories" subtitle="Tap a tile to filter the list below.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {topCategories.map((c) => {
                  const style = styleForCategory(c.name);
                  const cat = categories.find((x) => x.name === c.name);
                  const active = categoryFilter === cat?.id;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCategoryFilter(active ? "" : (cat?.id ?? ""))}
                      className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 text-left transition-colors duration-200 hover:border-white/[0.15] ${active ? "border-white/[0.18] bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : accentBgClass(style.accent)}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-xl">{style.glyph}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold uppercase tracking-wider text-gray-300">{c.name}</div>
                          <div className="text-[10px] text-gray-500">{c.count} {c.count === 1 ? "expense" : "expenses"}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-base font-semibold tabular-nums">{fmtMoney(c.total, "USD", { compact: true })}</div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full ${accentSolidBg(style.accent)}`} style={{ width: "100%" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── SEARCH / FILTER BAR ─────────────────────────────────
            (The All/Unpaid/Paid/Overdue tabs now live in the header
            so this row only carries free-text search + the active
            category-filter chip.) */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="w-full rounded-lg border border-white/[0.06] bg-[var(--bg-secondary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none sm:max-w-[280px]"
          />
          {categoryFilter && (
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className="rounded-lg border border-white/[0.06] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-rose-400 hover:border-rose-500/40"
              title="Clear category filter"
            >
              Clear filter ×
            </button>
          )}
        </div>

        {/* ── EXPENSE LIST ───────────────────────────────────────── */}
        <div className="mt-4">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">Loading expenses…</div></SectionCard>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search || categoryFilter ? "No expenses match your filter" : tab === "all" ? "No expenses yet" : `No ${tab} expenses`}
              hint={tab === "all" ? "Click + Add Expense to log your first one." : undefined}
              action={tab === "all" ? (
                <button onClick={startNew} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30">+ Add Expense</button>
              ) : undefined}
            />
          ) : (
            <ul className="grid gap-2">
              {filtered.map((e) => (
                <ExpenseRow
                  key={e.id}
                  e={e}
                  nowMs={nowMs}
                  todayIso={today}
                  onEdit={() => setEditing(e)}
                  onDelete={() => askDelete(e)}
                  onEvidence={() => setEvidenceExpense(e)}
                  onReview={() => setReviewExpense(e)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── QUICK-ADD / EDIT MODAL ──────────────────────────────── */}
      {editing && (
        <ExpenseEditor
          draft={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved, wasNew) => {
            setEditing(null);
            void load();
            /* UX-validation pass: a junior finance employee who just
               created an expense almost always wants to attach the
               receipt next. Auto-opening the evidence drawer removes
               the "find the row → hover → click Evidence" friction
               and saves 2 interactions (typically 5–8 seconds). */
            if (wasNew && saved) setEvidenceExpense(saved);
          }}
        />
      )}

      {/* ── Phase 2.1 — EVIDENCE DRAWER ───────────────────────── */}
      <AttachmentPreviewDrawer
        open={!!evidenceExpense}
        onClose={() => setEvidenceExpense(null)}
        entityType="expense"
        entityId={evidenceExpense?.id ?? null}
        title={evidenceExpense?.title ?? "Expense"}
        evidenceStatus={evidenceExpense?.evidence_status}
        receiptCount={evidenceExpense?.receipt_count}
        approvalStatus={evidenceExpense?.approval_status}
        onChange={() => { void load(); }}
        onSubmitForReview={async () => {
          if (!evidenceExpense?.id) return;
          /* Fire-and-forget submit. Server enforces the state machine,
             so we trust it; on success we close the evidence drawer
             and refresh the list. The operator's flow stops here —
             everything else is the manager's job. */
          const res = await fetch(`/api/finance/expenses/${evidenceExpense.id}/approval`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "submit" }),
          });
          if (res.ok) {
            setEvidenceExpense(null);
            void load();
          }
        }}
      />

      {/* ── Phase 2.2 — APPROVAL REVIEW DRAWER ────────────────── */}
      <ApprovalReviewDrawer
        open={!!reviewExpense}
        onClose={() => setReviewExpense(null)}
        expense={reviewExpense}
        canApprove={canApprove}
        onChange={(next) => {
          setReviewExpense(next);
          void load();
        }}
      />

      {/* ── Micro-polish — Hub-native delete confirmation + Undo. ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? `Delete "${confirmDelete.title || "expense"}"?` : ""}
        description="You'll have 5 seconds to undo. Receipts and approval history will be removed once the timer expires."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={startDeferredDelete}
      />
      <UndoToast
        open={!!pendingDeleteId}
        message={`Deleted "${pendingDeleteTitle}"`}
        onUndo={undoDeferredDelete}
        onExpire={() => { void commitDeferredDelete(); }}
      />
    </div>
  );
}

/* ── ExpenseRow — visual list card with icon, category, status. ── */
function ExpenseRow({
  e, onEdit, onDelete, onEvidence, onReview, nowMs, todayIso,
}: {
  e: FinanceExpense;
  onEdit: () => void;
  onDelete: () => void;
  onEvidence: () => void;
  onReview: () => void;
  /** Once-per-mount timestamps from the parent — keeps render pure
   *  under React-19 react-hooks/purity rules. */
  nowMs: number;
  todayIso: string;
}) {
  const style = styleForCategory(e.category_name);
  const isOverdue = e.payment_status !== "paid" && !!e.due_date && e.due_date < todayIso;
  /* Phase 2.1: evidence status is now the canonical signal. Legacy
     attachment_url falls into "pending" via the migration backfill. */
  const evidenceStatus = e.evidence_status ?? (e.has_attachments || e.attachment_url ? "pending" : "missing");
  const receiptCount = e.receipt_count ?? (e.attachment_url ? 1 : 0);
  /* Phase 2.2: approval status + waiting age for the review badge. */
  const approvalStatus = (e.approval_status ?? "draft") as ApprovalStatus;
  const ageDays = (() => {
    const ts = e.submitted_at ?? e.reviewed_at;
    if (!ts) return undefined;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return undefined;
    return Math.max(0, Math.floor((nowMs - d.getTime()) / 86_400_000));
  })();
  return (
    <li className="group">
      <div className={`flex items-center gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 transition hover:border-white/[0.12] ${isOverdue ? "border-rose-500/30" : "border-white/[0.06]"}`}>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${accentBgClass(style.accent)}`}>
          {style.glyph}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{e.title || "Untitled expense"}</span>
            <StatusBadge status={e.payment_status} />
            {isOverdue && <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-300">Overdue</span>}
            <button
              type="button"
              onClick={onEvidence}
              className="cursor-pointer"
              title="Open evidence drawer"
            >
              <EvidenceBadge status={evidenceStatus} receiptCount={receiptCount} compact />
            </button>
            <button
              type="button"
              onClick={onReview}
              className="cursor-pointer"
              title="Open approval review drawer"
            >
              <ApprovalBadge status={approvalStatus} ageDays={ageDays} compact />
            </button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            <span>{e.expense_date}</span>
            {e.category_name && (<><span>·</span><span>{e.category_name}</span></>)}
            {e.due_date && (<><span>·</span><span>Due {e.due_date}</span></>)}
            {e.linked_order_id && (<><span>·</span><span>Linked to order</span></>)}
          </div>
          {e.notes && (
            <div className="mt-1 truncate text-[11px] text-gray-400">{e.notes}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-base font-semibold tabular-nums text-rose-300">−{fmtMoney(Number(e.amount) || 0, e.currency, { compact: true })}</div>
          </div>
          {/* UX-validation pass: hover-only actions are invisible on
              touch devices. We now keep an always-visible Edit + kebab
              cluster. Primary actions (Review / Evidence) are reachable
              by tapping the badges to the left of the title — those
              already serve as primary touch targets on mobile. */}
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-300 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]"
              title="Edit expense"
            >
              Edit
            </button>
            <RowKebab onEvidence={onEvidence} onReview={onReview} onDelete={onDelete} />
          </div>
        </div>
      </div>
    </li>
  );
}

/* ── RowKebab — overflow menu for less-frequent actions.
   Touch-friendly (44px tap target via padding) and dismisses on
   outside click. Replaces the hover-only action cluster which was
   invisible on phones and tablets. */
function RowKebab({
  onEvidence, onReview, onDelete,
}: {
  onEvidence: () => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        onClick={(ev) => { ev.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.02] text-gray-400 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-gray-100"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
      </button>
      {open && (
        <div
          onClick={(ev) => ev.stopPropagation()}
          className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]"
        >
          <button onClick={() => { setOpen(false); onReview(); }} className="block w-full px-3 py-2 text-left text-[12px] text-gray-200 hover:bg-white/[0.04]">Open review</button>
          <button onClick={() => { setOpen(false); onEvidence(); }} className="block w-full px-3 py-2 text-left text-[12px] text-gray-200 hover:bg-white/[0.04]">Open evidence</button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="block w-full border-t border-white/[0.05] px-3 py-2 text-left text-[12px] text-rose-300 hover:bg-rose-500/[0.06]">Delete expense</button>
        </div>
      )}
    </div>
  );
}

/* ── ExpenseEditor — fast modal with minimal required fields. ──
   Goal: log a typical expense in <20s. Required fields auto-focus:
   title → amount → category → save. Everything else is optional. */
function ExpenseEditor({
  draft,
  categories,
  onClose,
  onSaved,
}: {
  draft: Partial<FinanceExpense>;
  categories: ExpenseCategory[];
  onClose: () => void;
  /** UX-validation pass: surfaces the saved row + isNew flag so the
   *  parent can auto-open the evidence drawer for fresh expenses. */
  onSaved: (saved: FinanceExpense | null, wasNew: boolean) => void;
}) {
  const [local, setLocal] = useState<Partial<FinanceExpense>>(draft);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(!!draft.linked_order_id || !!draft.linked_supplier_id || !!draft.attachment_url);
  /* Inline error state — replaces native alert() so the calm enterprise
     vibe survives a validation miss. */
  const [error, setError] = useState<string | null>(null);

  const wasNew = !draft.id;

  const save = async () => {
    setError(null);
    if (!local.title?.trim()) { setError("Add a short title so this expense is findable later."); return; }
    if (!Number(local.amount) || Number(local.amount) <= 0) { setError("Amount must be greater than zero."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      if (!r.ok) {
        setError("Save failed — try again.");
        return;
      }
      const body = (await r.json().catch(() => ({}))) as { expense?: FinanceExpense };
      onSaved(body.expense ?? null, wasNew);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 py-12" onClick={onClose}>
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{local.id ? "Edit expense" : "Add expense"}</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Title + amount + category is enough. Add the rest only if you have it.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-gray-200">✕</button>
        </div>
        <div className="space-y-4 px-5 py-5">
          {/* Title — single biggest input, autofocus */}
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">What was this for?</span>
            <input
              autoFocus
              value={local.title ?? ""}
              onChange={(e) => setLocal({ ...local, title: e.target.value })}
              placeholder="e.g. Sea freight to Alexandria"
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-base placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
            />
          </label>

          {/* Amount + currency on one row */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Amount</span>
              <input
                type="number"
                inputMode="decimal"
                value={local.amount ?? 0}
                onChange={(e) => setLocal({ ...local, amount: Number(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-base tabular-nums placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Currency</span>
              <select
                value={local.currency ?? "USD"}
                onChange={(e) => setLocal({ ...local, currency: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-sm focus:border-white/[0.22] focus:outline-none"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* Category — visual tile picker */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Category</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.filter((c) => !c.parent_id).map((c) => {
                const style = styleForCategory(c.name);
                const active = local.category_id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setLocal({ ...local, category_id: c.id })}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 " +
                      (active
                        ? "border-white/[0.18] bg-white/[0.08] text-[var(--text-primary)]"
                        : `${accentBgClass(style.accent)} text-gray-300 hover:border-white/[0.15]`)
                    }
                  >
                    <span>{style.glyph}</span>
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + status + due date */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Date</span>
              <input
                type="date"
                value={local.expense_date ?? ""}
                onChange={(e) => setLocal({ ...local, expense_date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-white/[0.22] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Status</span>
              <select
                value={local.payment_status ?? "unpaid"}
                onChange={(e) => setLocal({ ...local, payment_status: e.target.value as FinanceExpense["payment_status"] })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-white/[0.22] focus:outline-none"
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Due date</span>
              <input
                type="date"
                value={local.due_date ?? ""}
                onChange={(e) => setLocal({ ...local, due_date: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-white/[0.22] focus:outline-none"
              />
            </label>
          </div>

          {/* Notes */}
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Notes (optional)</span>
            <input
              value={local.notes ?? ""}
              onChange={(e) => setLocal({ ...local, notes: e.target.value })}
              placeholder="One-line context"
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
            />
          </label>

          {/* Advanced (collapsed by default) */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-[11px] text-gray-400 hover:text-gray-200"
          >
            {advancedOpen ? "− Hide" : "+ Show"} more options (link to order / supplier / receipt URL)
          </button>
          {advancedOpen && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)]/40 p-3">
              <label className="col-span-2 block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Legacy receipt URL</span>
                <input
                  value={local.attachment_url ?? ""}
                  onChange={(e) => setLocal({ ...local, attachment_url: e.target.value || null })}
                  placeholder="https://… (most teams now use the Evidence drawer instead)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Linked supplier</span>
                <input
                  value={local.linked_supplier_id ?? ""}
                  onChange={(e) => setLocal({ ...local, linked_supplier_id: e.target.value || null })}
                  placeholder="Supplier id (optional)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Linked customer</span>
                <input
                  value={local.linked_customer_id ?? ""}
                  onChange={(e) => setLocal({ ...local, linked_customer_id: e.target.value || null })}
                  placeholder="Customer id (optional)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
          {/* Inline error — replaces native alert() so the calm vibe survives. */}
          <div className="min-w-0 flex-1 text-[11px] text-rose-300/90">{error ?? ""}</div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/[0.12]">Cancel</button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[var(--bg-inverted)] px-4 py-1.5 text-xs font-medium text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {saving ? "Saving…" : wasNew ? "Save & attach receipt" : "Save expense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
