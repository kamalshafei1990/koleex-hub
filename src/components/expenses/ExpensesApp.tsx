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
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import { useTranslation } from "@/lib/i18n";
import { expensesT } from "@/lib/translations/expenses";
import ExpensesHeader from "@/components/expenses/ExpensesHeader";
import AppHomeMenu, { type AppHomeNavItem } from "@/components/ui/AppHomeMenu";
import type { ExpensesTabKey } from "@/components/expenses/ExpensesTabs";
import { EmptyState, SectionCard, StatusBadge } from "@/components/finance/FinanceUi";
import {
  accentActiveClass,
  accentBgClass,
  accentSolidBg,
  styleForCategory,
} from "@/components/finance/categoryStyles";
import { fmtMoney } from "@/lib/finance/calc";
import RrIcon from "@/components/ui/RrIcon";
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
import { useExpenseFilter, type ApprovalFilterKey as HookApprovalFilterKey } from "@/lib/hooks/useExpenseFilter";
/* Micro-polish primitives. */
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import UndoToast from "@/components/ui/UndoToast";
/* Phase 2.5 — operational guidance. */
import GuidanceTip from "@/components/ui/GuidanceTip";

type TabKey = ExpensesTabKey;

/* Phase 2.2 — approval-state quick filter. Lives next to the existing
   payment-state tabs so an operator can scan "what needs my attention"
   without leaving the page. Type is re-exported from the filter hook
   so the predicate logic + filter UI agree on what each chip means. */
type ApprovalFilterKey = HookApprovalFilterKey;

/* English fallbacks live alongside the i18n keys so the strip still
   renders if the dictionary is missing a key for some reason. */
const APPROVAL_FILTER_LABELS: Record<ApprovalFilterKey, { key: string; en: string }> = {
  all:              { key: "approval.any",          en: "Any state" },
  needs_review:     { key: "approval.needsReview",  en: "Needs review" },
  draft:            { key: "approval.drafts",       en: "Drafts" },
  rejected:         { key: "approval.rejected",     en: "Rejected" },
  requires_changes: { key: "approval.changesNeeded",en: "Changes needed" },
  approved:         { key: "approval.approved",     en: "Approved" },
};

const CURRENCIES = ["USD", "EUR", "CNY", "EGP", "GBP"];

export default function ExpensesApp() {
  const { t } = useTranslation(expensesT);
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

  /* Tenant base currency comes from the shared session-cached hook so
     we don't refetch /api/create/defaults on every Finance/Expenses
     mount. The hook returns `null` until resolved — every render below
     guards against that so the UI never flashes a wrong code. */
  const baseCurrencyResolved = useBaseCurrencyOptional();
  const baseCurrency = baseCurrencyResolved ?? "";

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

  /* Filter + counts come from a single hook — keeps the predicate
     logic in one place and lets us test it in isolation. */
  const { filtered, counts, approvalCounts } = useExpenseFilter({
    expenses, tab, search, categoryFilter, approvalFilter, today, pendingDeleteId,
  });

  /* Top categories for the visual tile grid (compute, not analytic) */
  const otherLabel = t("categories.other", "Other");
  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const e of expenses) {
      const k = e.category_name || otherLabel;
      const cur = map.get(k) ?? { name: k, total: 0, count: 0 };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [expenses, otherLabel]);

  const startNew = () => setEditing({
    title: "",
    amount: 0,
    currency: baseCurrency,
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
    setPendingDeleteTitle(confirmDelete.title || t("evidence.title", "Expense"));
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
          title={t("app.title", "Expenses")}
          subtitle={t("app.subtitle", "Fast daily expense entry. Add receipts, track what's paid, what's due.")}
          tab={tab}
          onTabChange={setTab}
          counts={counts}
          showTabs={false}
          action={
            <button
              type="button"
              onClick={startNew}
              className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-medium text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95"
            >
              {t("header.addExpense", "+ Add Expense")}
            </button>
          }
        />

        {/* Single canonical menu — search + pill row with counts + active state */}
        <div className="mt-5">
          <AppHomeMenu
            navItems={[
              { key: "all",       onClick: () => setTab("all"),     icon: "document",       label: "All",         count: counts.all,     active: tab === "all"     },
              { key: "unpaid",    onClick: () => setTab("unpaid"),  icon: "clock",          label: "Unpaid",      count: counts.unpaid,  active: tab === "unpaid"  },
              { key: "paid",      onClick: () => setTab("paid"),    icon: "check",          label: "Paid",        count: counts.paid,    active: tab === "paid"    },
              { key: "overdue",   onClick: () => setTab("overdue"), icon: "info",           label: "Overdue",     count: counts.overdue, active: tab === "overdue" },
              { key: "new",       onClick: startNew,                 icon: "plus",          label: "New Expense"  },
              { key: "categories",href: "/categories",               icon: "books",         label: "Categories"   },
              { key: "approvals", onClick: () => setApprovalFilter("needs_review"), icon: "shield-check", label: "Approvals"  },
              { key: "analytics", href: "/finance/expenses",         icon: "signal-stream", label: "Analytics"    },
            ] as AppHomeNavItem[]}
            searchPlaceholder="Search expenses, categories, payments…"
            onSearchSubmit={(term) => setSearch(term)}
          />
        </div>

        {/* ── Phase 2.2 — Approval filter strip ─────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
            <span>{t("approval.label", "Approval")}</span>
            <GuidanceTip guidanceId="approval.status" />
          </span>
          {(Object.keys(APPROVAL_FILTER_LABELS) as ApprovalFilterKey[]).map((key) => {
            const active = approvalFilter === key;
            const count = approvalCounts[key];
            const lbl = APPROVAL_FILTER_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setApprovalFilter(key)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors " +
                  (active
                    ? "border-[var(--border-color)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-highlight)]")
                }
              >
                <span>{t(lbl.key, lbl.en)}</span>
                {count > 0 && key !== "all" && (
                  <span className={
                    "rounded-full px-1 text-[9px] tabular-nums " +
                    (active ? "bg-[var(--bg-surface-active)] text-[var(--text-highlight)]" : "bg-[var(--bg-surface)] text-[var(--text-dim)]")
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
            <SectionCard title={t("categories.title", "Top categories")} subtitle={t("categories.tapHint", "Tap a tile to filter the list below.")} helpId="expense.section.topCategories">
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
                      className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 text-left transition-colors duration-200 hover:border-[var(--border-color)] ${active ? "border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : accentBgClass(style.accent)}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5"><RrIcon name={style.icon} size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold uppercase tracking-wider text-[var(--text-highlight)]">{c.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">{c.count} {c.count === 1 ? t("categories.expenseOne", "expense") : t("categories.expenseMany", "expenses")}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-base font-semibold tabular-nums">{fmtMoney(c.total, baseCurrency, { compact: true })}</div>
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

        {/* ── SEARCH / FILTER BAR ───────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search.placeholder", "Search expenses…")}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm placeholder-[var(--text-ghost)] focus:border-[var(--border-strong)] focus:outline-none sm:max-w-[280px]"
          />
          {categoryFilter && (
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:border-rose-500/40"
              title={t("filter.clearTitle", "Clear category filter")}
            >
              {t("filter.clear", "Clear filter")}
              <RrIcon name="cross" size={10} />
            </button>
          )}
        </div>

        {/* ── EXPENSE LIST ───────────────────────────────────────── */}
        <div className="mt-4">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-[var(--text-dim)]">{t("list.loading", "Loading expenses…")}</div></SectionCard>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search || categoryFilter
                ? t("list.empty.filtered", "No expenses match your filter")
                : tab === "all"
                  ? t("list.empty.all", "No expenses yet")
                  : t(`list.empty.${tab}`, `No ${tab} expenses`)}
              hint={tab === "all" ? t("list.empty.hint", "Click + Add Expense to log your first one.") : undefined}
              action={tab === "all" ? (
                <button onClick={startNew} className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30">{t("header.addExpense", "+ Add Expense")}</button>
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
          baseCurrency={baseCurrency}
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
        title={evidenceExpense?.title ?? t("evidence.title", "Expense")}
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
        title={confirmDelete
          ? t("confirm.deleteTitle", 'Delete "{name}"?').replace("{name}", confirmDelete.title || t("confirm.deleteFallback", "expense"))
          : ""}
        description={t("confirm.deleteDesc", "You'll have 5 seconds to undo. Receipts and approval history will be removed once the timer expires.")}
        confirmLabel={t("confirm.delete", "Delete")}
        cancelLabel={t("confirm.keep", "Keep")}
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={startDeferredDelete}
      />
      <UndoToast
        open={!!pendingDeleteId}
        message={t("toast.deleted", 'Deleted "{name}"').replace("{name}", pendingDeleteTitle)}
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
  const { t } = useTranslation(expensesT);
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
      <div className={`flex items-center gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 transition hover:border-[var(--border-color)] ${isOverdue ? "border-rose-500/30" : "border-[var(--border-subtle)]"}`}>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentBgClass(style.accent)}`}>
          <RrIcon name={style.icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{e.title || t("list.untitled", "Untitled expense")}</span>
            <StatusBadge status={e.payment_status} />
            {isOverdue && <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-600 dark:text-rose-300">{t("badge.overdue", "Overdue")}</span>}
            <button
              type="button"
              onClick={onEvidence}
              className="cursor-pointer"
              title={t("list.openEvidence", "Open evidence drawer")}
            >
              <EvidenceBadge status={evidenceStatus} receiptCount={receiptCount} compact />
            </button>
            <button
              type="button"
              onClick={onReview}
              className="cursor-pointer"
              title={t("list.openReview", "Open approval review drawer")}
            >
              <ApprovalBadge status={approvalStatus} ageDays={ageDays} compact />
            </button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-dim)]">
            <span>{e.expense_date}</span>
            {e.category_name && (<><span>·</span><span>{e.category_name}</span></>)}
            {e.due_date && (<><span>·</span><span>{t("list.dueLabel", "Due")} {e.due_date}</span></>)}
            {e.linked_order_id && (<><span>·</span><span>{t("list.linkedOrder", "Linked to order")}</span></>)}
          </div>
          {e.notes && (
            <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">{e.notes}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-base font-semibold tabular-nums text-rose-600 dark:text-rose-300">−{fmtMoney(Number(e.amount) || 0, e.currency, { compact: true })}</div>
          </div>
          {/* UX-validation pass: hover-only actions are invisible on
              touch devices. We now keep an always-visible Edit + kebab
              cluster. Primary actions (Review / Evidence) are reachable
              by tapping the badges to the left of the title — those
              already serve as primary touch targets on mobile. */}
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-[var(--text-highlight)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface)]"
              title={t("row.editTitle", "Edit expense")}
            >
              {t("common.edit", "Edit")}
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
  const { t } = useTranslation(expensesT);
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
        aria-label={t("row.moreActions", "More actions")}
        onClick={(ev) => { ev.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
      </button>
      {open && (
        <div
          onClick={(ev) => ev.stopPropagation()}
          className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]"
        >
          <button onClick={() => { setOpen(false); onReview(); }} className="block w-full px-3 py-2 text-left text-[12px] text-[var(--text-highlight)] hover:bg-[var(--bg-surface)]">{t("row.openReview", "Open review")}</button>
          <button onClick={() => { setOpen(false); onEvidence(); }} className="block w-full px-3 py-2 text-left text-[12px] text-[var(--text-highlight)] hover:bg-[var(--bg-surface)]">{t("row.openEvidence", "Open evidence")}</button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="block w-full border-t border-[var(--border-subtle)] px-3 py-2 text-left text-[12px] text-rose-600 dark:text-rose-300 hover:bg-rose-500/[0.06]">{t("row.deleteExpense", "Delete expense")}</button>
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
  baseCurrency,
  onClose,
  onSaved,
}: {
  draft: Partial<FinanceExpense>;
  categories: ExpenseCategory[];
  /** Tenant base currency — used as the default when draft.currency is unset. */
  baseCurrency: string;
  onClose: () => void;
  /** UX-validation pass: surfaces the saved row + isNew flag so the
   *  parent can auto-open the evidence drawer for fresh expenses. */
  onSaved: (saved: FinanceExpense | null, wasNew: boolean) => void;
}) {
  const { t } = useTranslation(expensesT);
  const [local, setLocal] = useState<Partial<FinanceExpense>>(draft);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(!!draft.linked_order_id || !!draft.linked_supplier_id || !!draft.attachment_url);
  /* Inline error state — replaces native alert() so the calm enterprise
     vibe survives a validation miss. */
  const [error, setError] = useState<string | null>(null);

  const wasNew = !draft.id;

  const save = async () => {
    setError(null);
    if (!local.title?.trim()) { setError(t("editor.err.titleMissing", "Add a short title so this expense is findable later.")); return; }
    if (!Number(local.amount) || Number(local.amount) <= 0) { setError(t("editor.err.amountInvalid", "Amount must be greater than zero.")); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      if (!r.ok) {
        setError(t("editor.err.saveFailed", "Save failed — try again."));
        return;
      }
      const body = (await r.json().catch(() => ({}))) as { expense?: FinanceExpense };
      onSaved(body.expense ?? null, wasNew);
    } finally {
      setSaving(false);
    }
  };

  /* Live preview of the selected category — drives both the modal
     header accent stripe and the category section title chip. */
  const selectedCat = local.category_id
    ? categories.find((c) => c.id === local.category_id) ?? null
    : null;
  const selectedParent = selectedCat?.parent_id
    ? categories.find((c) => c.id === selectedCat.parent_id) ?? null
    : selectedCat;
  const selectedStyle = styleForCategory(selectedCat?.name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md px-0 py-0 sm:items-center sm:px-4 sm:py-10"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-[0_24px_72px_rgba(0,0,0,0.6)] sm:rounded-2xl"
        style={{ maxHeight: "min(92vh, 880px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Sticky header ─── */}
        <div
          className="relative shrink-0 border-b border-[var(--border-subtle)]"
          style={{
            background: `linear-gradient(180deg, ${selectedStyle ? "rgba(255,255,255,0.02)" : "transparent"} 0%, transparent 100%)`,
          }}
        >
          {/* Accent stripe — picks up the chosen category's accent. */}
          <div className={`absolute inset-x-0 top-0 h-[2px] ${accentSolidBg(selectedStyle.accent)} opacity-70`} />
          <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentBgClass(selectedStyle.accent)}`}>
                <RrIcon name={selectedStyle.icon} size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                  {local.id ? t("editor.titleEdit", "Edit expense") : t("editor.titleAdd", "Add expense")}
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                  {t("editor.subtitle", "Title, amount, and a category — done in 20 seconds. The rest is optional.")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t("editor.close", "Close")}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            >
              <RrIcon name="cross" size={14} />
            </button>
          </div>
        </div>

        {/* ─── Scrollable body ─── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
            {/* ── Section 1: Basics ─────────────────────────────── */}
            <Section title={t("editor.section.basics", "Basics")} hint={t("editor.section.basicsHint", "What it was and how much it cost.")}>
              <div className="space-y-3">
                <FieldLabel label={t("editor.field.what", "What was this for?")} helpId="expense.title" required>
                  <input
                    autoFocus
                    value={local.title ?? ""}
                    onChange={(e) => setLocal({ ...local, title: e.target.value })}
                    placeholder={t("editor.field.whatPlaceholder", "e.g. Sea freight to Alexandria")}
                    className={INPUT_LG}
                  />
                </FieldLabel>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FieldLabel label={t("editor.field.amount", "Amount")} helpId="expense.amount" required>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={local.amount ?? 0}
                        onChange={(e) => setLocal({ ...local, amount: Number(e.target.value) || 0 })}
                        className={`${INPUT_LG} tabular-nums`}
                      />
                    </FieldLabel>
                  </div>
                  <FieldLabel label={t("editor.field.currency", "Currency")}>
                    <select
                      value={local.currency ?? baseCurrency}
                      onChange={(e) => setLocal({ ...local, currency: e.target.value })}
                      className={INPUT_LG}
                    >
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </FieldLabel>
                </div>
              </div>
            </Section>

            {/* ── Section 2: Category (the star of the show) ────── */}
            <Section
              title={t("editor.section.category", "Category")}
              hint={t("editor.section.categoryHint", "Pick a group on the left, then a specific sub-category.")}
              right={
                selectedCat ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${accentBgClass(selectedStyle.accent)}`}
                  >
                    <RrIcon name={selectedStyle.icon} size={11} />
                    {selectedParent && selectedParent.id !== selectedCat.id ? (
                      <>
                        <span className="opacity-60">{selectedParent.name}</span>
                        <span className="opacity-40">·</span>
                        <span>{selectedCat.name}</span>
                      </>
                    ) : (
                      <span>{selectedCat.name}</span>
                    )}
                  </span>
                ) : (
                  <span className="rounded-full border border-dashed border-[var(--border-color)] px-2 py-0.5 text-[11px] text-[var(--text-dim)]">
                    {t("editor.noCategory", "No category selected")}
                  </span>
                )
              }
            >
              <CategoryPicker
                categories={categories}
                value={local.category_id ?? null}
                onChange={(id) => setLocal({ ...local, category_id: id })}
              />
            </Section>

            {/* ── Section 3: Schedule ───────────────────────────── */}
            <Section title={t("editor.section.schedule", "Schedule")} hint={t("editor.section.scheduleHint", "When the cost was incurred and when it's due.")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldLabel label={t("editor.field.expDate", "Date")}>
                  <input
                    type="date"
                    value={local.expense_date ?? ""}
                    onChange={(e) => setLocal({ ...local, expense_date: e.target.value })}
                    className={INPUT}
                  />
                </FieldLabel>
                <FieldLabel label={t("editor.field.payStatus", "Status")} helpId="expense.paymentStatus">
                  <select
                    value={local.payment_status ?? "unpaid"}
                    onChange={(e) => setLocal({ ...local, payment_status: e.target.value as FinanceExpense["payment_status"] })}
                    className={INPUT}
                  >
                    <option value="unpaid">{t("status.unpaid", "Unpaid")}</option>
                    <option value="partial">{t("status.partial", "Partially approved")}</option>
                    <option value="paid">{t("status.paid", "Paid")}</option>
                  </select>
                </FieldLabel>
                <FieldLabel label={t("editor.field.dueDate", "Due date")} helpId="expense.dueDate">
                  <input
                    type="date"
                    value={local.due_date ?? ""}
                    onChange={(e) => setLocal({ ...local, due_date: e.target.value || null })}
                    className={INPUT}
                  />
                </FieldLabel>
              </div>
            </Section>

            {/* ── Section 4: Notes ──────────────────────────────── */}
            <Section title={t("editor.field.notes", "Notes")} hint={t("editor.section.notesHint", "Optional — one line of context if it'll help your future self.")}>
              <FieldLabel label={t("editor.field.notes", "Notes")} helpId="expense.notes">
                <input
                  value={local.notes ?? ""}
                  onChange={(e) => setLocal({ ...local, notes: e.target.value })}
                  placeholder={t("editor.field.notesPlaceholder", "One-line context")}
                  className={INPUT}
                />
              </FieldLabel>
            </Section>

            {/* ── Section 5: Advanced (collapsed by default) ────── */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-medium text-[var(--text-highlight)] transition hover:text-[var(--text-primary)]"
              >
                <span className="inline-flex items-center gap-2">
                  <RrIcon name={advancedOpen ? "cross" : "plus"} size={11} className="opacity-70" />
                  {t("editor.advanced.title", "Advanced options")}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                  {t("editor.advanced.hint", "link to order / supplier / receipt URL")}
                </span>
              </button>
              {advancedOpen && (
                <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-subtle)] px-4 py-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldLabel label={t("editor.advanced.receiptUrl", "Legacy receipt URL")}>
                      <input
                        value={local.attachment_url ?? ""}
                        onChange={(e) => setLocal({ ...local, attachment_url: e.target.value || null })}
                        placeholder={t("editor.advanced.receiptUrlHint", "https://… (most teams now use the Evidence drawer instead)")}
                        className={INPUT}
                      />
                    </FieldLabel>
                  </div>
                  <FieldLabel label={t("editor.advanced.linkedSupplier", "Linked supplier")}>
                    <input
                      value={local.linked_supplier_id ?? ""}
                      onChange={(e) => setLocal({ ...local, linked_supplier_id: e.target.value || null })}
                      placeholder={t("editor.advanced.supplierIdHint", "Supplier id (optional)")}
                      className={INPUT}
                    />
                  </FieldLabel>
                  <FieldLabel label={t("editor.advanced.linkedCustomer", "Linked customer")}>
                    <input
                      value={local.linked_customer_id ?? ""}
                      onChange={(e) => setLocal({ ...local, linked_customer_id: e.target.value || null })}
                      placeholder={t("editor.advanced.customerIdHint", "Customer id (optional)")}
                      className={INPUT}
                    />
                  </FieldLabel>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Sticky footer ─── */}
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {error ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-600 dark:text-rose-300">
                  <RrIcon name="info" size={10} />
                  {error}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--text-dim)]">
                  {selectedCat ? `${t("editor.footer.category", "Category")} · ${selectedCat.name}` : t("editor.footer.pickPrompt", "Pick a category to make reporting cleaner.")}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] transition hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {saving ? (
                  <>
                    <RrIcon name="loading" size={11} className="animate-spin" />
                    {t("editor.saving", "Saving…")}
                  </>
                ) : (
                  <>
                    <RrIcon name="check" size={11} />
                    {wasNew ? t("editor.saveAndAttach", "Save & attach receipt") : t("editor.saveExpense", "Save expense")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tiny presentational helpers for the editor ─────────────────── */

const INPUT =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-[var(--text-ghost)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

const INPUT_LG =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-base placeholder-[var(--text-ghost)] transition focus:border-[var(--border-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({
  label,
  helpId,
  required,
  children,
}: {
  label: string;
  helpId?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        <span>{label}</span>
        {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
        {helpId && <GuidanceTip guidanceId={helpId} />}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────────
   CategoryPicker — grouped two-step category selector.

   UX:
     · Top row: the 9 parent categories rendered as colour-coded tiles
       (icon + name). One stays selected at a time.
     · Below: searchable sub-category grid for the active parent.
       Selecting a sub-tile commits the leaf category id.
     · Selecting a parent without a sub-pick falls back to the parent
       row itself (matching the legacy behaviour for backward compat).
   ────────────────────────────────────────────────────────────────── */

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategory[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation(expensesT);
  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ExpenseCategory[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      const arr = map.get(c.parent_id) ?? [];
      arr.push(c);
      map.set(c.parent_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [categories]);

  /* Resolve which parent the current value belongs to so the grid
     opens to the right group on edit. */
  const initialParent = useMemo(() => {
    if (!value) return parents[0]?.id ?? null;
    const hit = categories.find((c) => c.id === value);
    if (!hit) return parents[0]?.id ?? null;
    return hit.parent_id ?? hit.id;
  }, [value, categories, parents]);

  const [activeParent, setActiveParent] = useState<string | null>(initialParent);
  const [query, setQuery] = useState("");

  /* Keep the active parent in sync if the picker is reused for a
     different expense draft. */
  useEffect(() => {
    setActiveParent(initialParent);
  }, [initialParent]);

  const activeChildren = activeParent ? (childrenByParent.get(activeParent) ?? []) : [];
  const filteredChildren = query.trim()
    ? activeChildren.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : activeChildren;

  const activeParentObj = activeParent ? parents.find((p) => p.id === activeParent) ?? null : null;
  const activeParentStyle = styleForCategory(activeParentObj?.name);
  const childCount = (id: string) => (childrenByParent.get(id) ?? []).length;

  return (
    <div className="space-y-3">
      {/* ── Parent group cards (the grid the user liked) ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {parents.map((p) => {
          const style = styleForCategory(p.name);
          const isActive = activeParent === p.id;
          const isSelected = value === p.id || categories.find((c) => c.id === value)?.parent_id === p.id;
          const subCount = childCount(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveParent(p.id);
                setQuery("");
              }}
              className={`group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 ${
                isActive
                  ? `${accentActiveClass(style.accent)} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]`
                  : `${accentBgClass(style.accent)} hover:border-[var(--border-strong)] hover:brightness-110`
              }`}
              title={p.name}
              aria-pressed={isActive}
            >
              {/* Decorative glow keyed to the accent — picks up brand colour. */}
              <div
                aria-hidden
                className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-20 blur-2xl ${accentSolidBg(style.accent)}`}
              />
              <div className="flex w-full items-start justify-between gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentSolidBg(style.accent)}/30`}>
                  <RrIcon name={style.icon} size={16} />
                </span>
                {isSelected && (
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${accentSolidBg(style.accent)}/50 ring-1 ring-white/20`}>
                    <RrIcon name="check" size={9} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold leading-tight">{p.name}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                  {subCount} {subCount === 1 ? t("picker.optionOne", "option") : t("picker.optionMany", "options")}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Expanded sub-category panel for the active parent ── */}
      {activeParentObj && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
          {/* Panel header — shows which group is open + a tiny search */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5">
            <div className="inline-flex min-w-0 items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accentBgClass(activeParentStyle.accent)}`}>
                <RrIcon name={activeParentStyle.icon} size={11} />
              </span>
              <span className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{activeParentObj.name}</span>
              <span className="hidden text-[10px] text-[var(--text-dim)] sm:inline">{t("picker.chooseSub", "· choose a sub-category")}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeChildren.length > 5 && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1">
                  <RrIcon name="search" size={10} className="text-[var(--text-dim)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("picker.filterPlaceholder", "Filter…")}
                    className="w-24 bg-transparent text-[11px] placeholder-[var(--text-ghost)] focus:outline-none sm:w-32"
                  />
                </div>
              )}
              {value && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] transition hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-300"
                >
                  <RrIcon name="cross" size={9} />
                  {t("picker.clear", "Clear")}
                </button>
              )}
            </div>
          </div>

          {/* Sub-category tile grid — no internal scroll, expands to fit. */}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* General · Parent fallback tile */}
            <button
              type="button"
              onClick={() => onChange(activeParent!)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-all duration-200 ${
                value === activeParent
                  ? accentActiveClass(activeParentStyle.accent)
                  : "border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-highlight)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
              }`}
              title={`${t("picker.general", "General")} · ${activeParentObj.name}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface-hover)]">
                <RrIcon name="info" size={11} className="opacity-70" />
              </span>
              <span className="min-w-0 flex-1 truncate">{t("picker.general", "General")} · {activeParentObj.name}</span>
              {value === activeParent && <RrIcon name="check" size={11} className="shrink-0 opacity-80" />}
            </button>

            {filteredChildren.map((c) => {
              const style = styleForCategory(c.name);
              const active = value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange(c.id)}
                  className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-all duration-200 ${
                    active
                      ? `${accentActiveClass(style.accent)} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]`
                      : `${accentBgClass(style.accent)} hover:border-[var(--border-strong)] hover:brightness-110`
                  }`}
                  title={c.name}
                  aria-pressed={active}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accentSolidBg(style.accent)}/25`}>
                    <RrIcon name={style.icon} size={11} />
                  </span>
                  <span className="block min-w-0 flex-1 truncate">{c.name}</span>
                  {active && <RrIcon name="check" size={11} className="shrink-0 opacity-80" />}
                </button>
              );
            })}

            {filteredChildren.length === 0 && query && (
              <div className="col-span-full rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--text-dim)]">
                {t("picker.noMatch", "No sub-categories match “{q}”.").replace("{q}", query)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
