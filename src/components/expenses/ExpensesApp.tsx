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
  }, [expenses, tab, categoryFilter, search, today, approvalFilter]);

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

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    void load();
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
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mr-1">Approval</span>
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
                      className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 text-left transition hover:border-white/[0.15] ${active ? "ring-2 ring-emerald-500/40 border-emerald-500/30" : accentBgClass(style.accent)}`}
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
            className="w-full rounded-lg border border-white/[0.06] bg-[var(--bg-secondary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none sm:max-w-[280px]"
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
                  onDelete={() => remove(e.id)}
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
          onSaved={() => { setEditing(null); void load(); }}
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
        onChange={() => { void load(); }}
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
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onReview}   className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-300 hover:border-white/[0.12]">Review</button>
            <button onClick={onEvidence} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-300 hover:border-white/[0.12]">Evidence</button>
            <button onClick={onEdit}     className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-300 hover:border-white/[0.12]">Edit</button>
            <button onClick={onDelete}   className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-rose-400 hover:border-rose-500/40">Delete</button>
          </div>
        </div>
      </div>
    </li>
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
  onSaved: () => void;
}) {
  const [local, setLocal] = useState<Partial<FinanceExpense>>(draft);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(!!draft.linked_order_id || !!draft.linked_supplier_id || !!draft.attachment_url);

  const save = async () => {
    if (!local.title?.trim()) { alert("Please add a title."); return; }
    if (!Number(local.amount) || Number(local.amount) <= 0) { alert("Amount must be greater than zero."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      if (!r.ok) { alert("Save failed"); return; }
      onSaved();
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
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-base placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-base tabular-nums placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Currency</span>
              <select
                value={local.currency ?? "USD"}
                onChange={(e) => setLocal({ ...local, currency: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2.5 text-sm focus:border-emerald-500/50 focus:outline-none"
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
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
                      (active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        : `${accentBgClass(style.accent)} hover:border-white/[0.15]`)
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
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Status</span>
              <select
                value={local.payment_status ?? "unpaid"}
                onChange={(e) => setLocal({ ...local, payment_status: e.target.value as FinanceExpense["payment_status"] })}
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
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
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
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
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Receipt URL</span>
                <input
                  value={local.attachment_url ?? ""}
                  onChange={(e) => setLocal({ ...local, attachment_url: e.target.value || null })}
                  placeholder="https://… (Phase 2 will allow direct upload)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Linked supplier</span>
                <input
                  value={local.linked_supplier_id ?? ""}
                  onChange={(e) => setLocal({ ...local, linked_supplier_id: e.target.value || null })}
                  placeholder="Supplier id (optional)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Linked customer</span>
                <input
                  value={local.linked_customer_id ?? ""}
                  onChange={(e) => setLocal({ ...local, linked_customer_id: e.target.value || null })}
                  placeholder="Customer id (optional)"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/[0.12]">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
