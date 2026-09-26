"use client";

/* ---------------------------------------------------------------------------
   To-do — capture, organise, finish, review.

   THE ORIGINAL LAYOUT on the new plumbing (owner: "return the old shape as
   UI design but with the same performance and codes as now"). The header,
   the pill groups, the inline filter panel, the KPI cards + Top Performers
   and the rich rows look as they did; underneath, rows, the form, the board,
   the filters and the data store live in components/todo, and the rare ones
   load on first use.

   Flow, top to bottom:
     · header — search, filters, reports, Add task; My Work (desktop);
       status / priority / audience / source / horizon pills; view · sort ·
       select; bulk bar; the advanced filter panel
     · quick add — one line, natural dates ("tomorrow !high"), Enter
     · KPI cards + Top Performers
     · the list — Overdue → Today → Upcoming → No date, Completed folded
   Keys: N adds, / searches, Esc leaves search or selection.
   --------------------------------------------------------------------------- */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import KdsSelect from "@/components/kds/Select";
import { useToast } from "@/components/kds/useToast";
import PageHeader from "@/components/ui/PageHeader";
import AppIcon from "@/components/common/AppIcon";
import TodoIcon from "@/components/icons/TodoIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import { useSkin } from "@/lib/appearance";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import { useOpenOnNewParam } from "@/lib/use-open-on-new-param";
import { useCurrentAccountId } from "@/lib/identity";
import { usePermissions } from "@/lib/permissions";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { useWarm } from "@/lib/warm-cache";
import { collapseSeries } from "@/lib/todo-series";
import type { TodoAssigneeInfo, TodoLabelRow, TodoStatus, TodoWithRelations } from "@/types/supabase";
import MyWorkStrip from "@/components/todo/MyWorkStrip";
import QuickAdd, { type QuickAddValue, type QuickDraft } from "@/components/todo/QuickAdd";
import TaskRow from "@/components/todo/TaskRow";
import { todoWarmKey, type TodoSnap } from "@/components/todo/todo-data";
import { dayKey, fmtDay, isDueTodayDate, isOverdueDate, todoLocale } from "@/components/todo/todo-dates";
import { NO_FILTERS, matchesFilters, type DueFilter, type SourceFilter, type TodoFilters } from "@/components/todo/todo-filters";
import KpiDashboard, { useTodoStats } from "@/components/todo/KpiDashboard";
import { PILL, PILL_OFF, PILL_ON, PRIORITIES, PRIORITY_ON, PRIORITY_RANK, STATUSES, involves } from "@/components/todo/todo-ui";
import { useTodoStore, type DoneState, type TaskFields } from "@/components/todo/use-todo-store";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Loaded on first use — none of these is needed to paint the list. */
const loadTaskModal = () => import("@/components/todo/TaskModal");
const TaskModal = dynamic(loadTaskModal, { ssr: false });
/* The form, its extras chunk and the projects list, fetched while the page is
   idle (and again on hover of "Add task"): the first open was two chunk
   round-trips plus a request behind the click — owner: "when I press new
   task take long time". Idempotent: every import() and loadProjects() is
   cached after the first call. */
const warmTaskForm = () => {
  void loadTaskModal().then((m) => m.warmTaskModal());
  void import("@/components/todo/TaskSheet");
};
/* The task in full — what a notification's link opens. */
const TaskSheet = dynamic(() => import("@/components/todo/TaskSheet"), { ssr: false });
const FiltersPanel = dynamic(() => import("@/components/todo/FiltersPanel"), { ssr: false });
const RejectDialog = dynamic(() => import("@/components/todo/RejectDialog"), { ssr: false });
const TodoBoard = dynamic(() => import("@/components/todo/TodoBoard"), { ssr: false, loading: () => <ListSkeleton /> });
/* Aurora ground — only under the skin; Core never pays for the canvas. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

type Tab = "all" | "active" | "completed" | "approvals";
type Sort = "smart" | "due" | "priority" | "created";

const NO_PEOPLE: TodoAssigneeInfo[] = [];
const NO_STRINGS: string[] = [];
const NO_LABELS: TodoLabelRow[] = [];

const byPriority = (a: TodoWithRelations, b: TodoWithRelations) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
const byDue = (a: TodoWithRelations, b: TodoWithRelations) =>
  (dayKey(a.due_date) ?? "9999").localeCompare(dayKey(b.due_date) ?? "9999");
const byNewest = (a: TodoWithRelations, b: TodoWithRelations) => b.created_at.localeCompare(a.created_at);
const byDoneRecent = (a: TodoWithRelations, b: TodoWithRelations) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
const chain = (...fns: ((a: TodoWithRelations, b: TodoWithRelations) => number)[]) =>
  (a: TodoWithRelations, b: TodoWithRelations) => { for (const f of fns) { const r = f(a, b); if (r) return r; } return 0; };

export default function TodoPage() {
  const { t, lang } = useTranslation(todoT);
  const aurora = useSkin() === "aurora";
  const accountId = useCurrentAccountId();
  /* The tenant's realtime topic comes from the bootstrap every screen already has. */
  const boot = useMeBootstrap().data;
  const tenantId = boot?.auth?.tenant_id ?? null;
  const isSA = usePermissions().isSuperAdmin === true;
  /* "Assign to everyone" is admin-only (the server enforces it; the form
     hides it) — the same rule the AI's task tool uses. */
  const canAssignAll = isSA || boot?.isSuperAdmin === true || boot?.auth?.user_type === "admin";
  const { showToast, toastElement } = useToast();

  /* Warm start: the last list this account saw paints on the first client
     frame; the network answer replaces it behind a fully drawn screen. */
  const warmKey = todoWarmKey(accountId);
  const warm = useWarm<TodoSnap>(warmKey, 6 * 60 * 60 * 1000);
  const { data, todos, done, hidden, loading, error, synced, actions } = useTodoStore({
    warm, warmKey, accountId, isSA, tenantId, t, toast: showToast,
  });
  const employees = data?.employees ?? NO_PEOPLE;
  const departments = data?.departments ?? NO_STRINGS;
  const labels = data?.labels ?? NO_LABELS;

  /* ── view state ── */
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<Tab>("all");
  const [filters, setFilters] = useState<TodoFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [sort, setSort] = useState<Sort>("smart");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ id: string | null; key: number; draft?: QuickDraft } | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  /* ?new=1 (Smart Create) opens a blank task. */
  useOpenOnNewParam(() => setModal({ id: null, key: Date.now() }));

  /* Edit / delete. A PRIVATE task stays its creator's even when it is
     assigned to someone — assignees now see it, but may only move it. */
  const canManage = (x: TodoWithRelations) =>
    isSA || (!!accountId && (x.created_by_account_id === accountId || (!x.is_private && x.assigned_by_account_id === accountId)));
  /* "Done" completes rather than submits for approval — use-todo-store's rule. */
  const isOwner = (x: TodoWithRelations) =>
    isSA || (!!accountId && (x.created_by_account_id === accountId || x.assigned_by_account_id === accountId));

  /* ── derived lists ── */
  /* Recurring series: one row per period is stored; superseded periods that
     nobody touched are dropped (lib/todo-series — display rule only). */
  const series = useMemo(
    () => collapseSeries(hidden.size ? todos.filter((x) => !hidden.has(x.id)) : todos),
    [todos, hidden],
  );

  const scoped = useMemo(() => {
    if (!isSA || filters.saView === "all") return series;
    if (filters.saView === "own") return series.filter((x) => x.assign_to_all || (accountId ? involves(x, accountId) : true));
    return series.filter((x) => involves(x, filters.saView));
  }, [series, isSA, filters.saView, accountId]);

  /* Search runs over one lowercased string per task, built once per list —
     the old filter formatted eleven dates per task on every keystroke. */
  const searchIndex = useMemo(() => {
    const loc = todoLocale(lang);
    const map = new Map<string, string>();
    for (const x of scoped) {
      const parts = [x.title, x.description, x.label, x.assigned_department, x.assigner?.full_name, x.assigner?.username];
      x.assignees.forEach((a) => parts.push(a.full_name, a.username, a.department));
      for (const iso of [x.due_date, x.created_at]) {
        const k = dayKey(iso);
        if (!k) continue;
        const [y, m, d] = k.split("-");
        parts.push(k, `${d}/${m}`, `${d}/${m}/${y}`, fmtDay(k, lang, true));
        try { parts.push(new Date(+y, +m - 1, +d).toLocaleDateString(loc, { month: "long", weekday: "long" })); } catch { /* noop */ }
      }
      map.set(x.id, parts.filter(Boolean).join(" \u0001 ").toLowerCase());
    }
    return map;
  }, [scoped, lang]);

  /* Everything but the tab — the tab counts are taken from this. */
  const base = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return scoped.filter((x) =>
      (!q || (searchIndex.get(x.id) ?? "").includes(q)) && matchesFilters(x, filters, accountId));
  }, [scoped, searchIndex, deferredSearch, filters, accountId]);

  const counts = useMemo(() => {
    let done = 0, approvals = 0, overdue = 0;
    for (const x of base) {
      if (x.completed) done++;
      else if (isOverdueDate(x.due_date)) overdue++;
      if (x.approval_state === "pending" && x.assigned_by_account_id === accountId) approvals++;
    }
    return { all: base.length, active: base.length - done, done, approvals, overdue };
  }, [base, accountId]);

  /* KPI + tab numbers: open-side counts from the scoped open set (series
     collapsed), finished-work counts from the stats endpoint — both under
     the audience lens only, as the original cards were. */
  const open = useMemo(() => {
    let active = 0, overdue = 0, high = 0;
    for (const x of scoped) {
      if (x.completed) continue;
      active++;
      if (isOverdueDate(x.due_date)) overdue++;
      if (x.priority === "high") high++;
    }
    return { active, overdue, high };
  }, [scoped]);
  const stats = useTodoStats(accountId, isSA ? filters.saView : "own", todos);

  const shown = useMemo(() => {
    if (tab === "active") return base.filter((x) => !x.completed);
    if (tab === "completed") return base.filter((x) => x.completed);
    if (tab === "approvals") return base.filter((x) => x.approval_state === "pending" && x.assigned_by_account_id === accountId);
    return base;
  }, [base, tab, accountId]);

  const groups = useMemo(() => {
    const open = shown.filter((x) => !x.completed);
    return {
      overdue: open.filter((x) => isOverdueDate(x.due_date)).sort(chain(byDue, byPriority)),
      today: open.filter((x) => isDueTodayDate(x.due_date)).sort(chain(byPriority, byNewest)),
      upcoming: open.filter((x) => { const k = dayKey(x.due_date); return !!k && !isOverdueDate(x.due_date) && !isDueTodayDate(x.due_date); })
        .sort(chain(byDue, byPriority)),
      noDate: open.filter((x) => !x.due_date).sort(chain(byPriority, byNewest)),
      completed: shown.filter((x) => x.completed).sort(byDoneRecent),
    };
  }, [shown]);

  const flat = useMemo(() => {
    const arr = [...shown];
    if (sort === "priority") arr.sort(chain(byPriority, byDue));
    else if (sort === "due") arr.sort(chain(byDue, byPriority));
    else if (sort === "created") arr.sort(byNewest);
    else if (tab === "completed") arr.sort(byDoneRecent);
    return arr;
  }, [shown, sort, tab]);

  const assigneesInUse = useMemo(() => {
    const map = new Map<string, TodoAssigneeInfo>();
    todos.forEach((x) => x.assignees.forEach((a) => map.set(a.account_id, a)));
    return [...map.values()].sort((a, b) => (a.full_name || a.username).localeCompare(b.full_name || b.username));
  }, [todos]);
  const labelsInUse = useMemo(() => {
    const names = new Set(labels.map((l) => l.name));
    todos.forEach((x) => { if (x.label) names.add(x.label); });
    return [...names].sort();
  }, [todos, labels]);

  /* The inline panel's filters (the pills carry their own state). */
  const panelActive = !!(filters.status || filters.dept || filters.assignee || filters.label || filters.from || filters.to);
  const filterCount = [filters.status, filters.dept, filters.assignee, filters.label, filters.from, filters.to, filters.due, filters.priority]
    .filter(Boolean).length + (filters.source !== "all" ? 1 : 0) + (filters.saView !== "own" ? 1 : 0);
  const setF = (patch: Partial<TodoFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const modalEntry = modal?.id ? todos.find((x) => x.id === modal.id) ?? null : null;
  const sheetTask = openId && !hidden.has(openId) ? todos.find((x) => x.id === openId) ?? null : null;

  /* Finished history is fetched the first time someone looks at it — the
     Completed group opened, or the Done tab. Its count is only a number
     once known: "12+" while older pages remain, nothing before the first. */
  /* Older finished tasks may still be on the server — unless the stats
     already say there are none, in which case there is nothing to fold. */
  const moreDone = stats?.completed === 0 ? false : !done.loaded || !!done.nextBefore;
  const wantDone = showCompleted || tab === "completed";
  useEffect(() => {
    if (wantDone && !done.loaded && !done.loading && !done.error) void actions.loadMoreDone();
  }, [wantDone, done.loaded, done.loading, done.error, actions]);
  const doneCount = (n: number) => (done.loaded ? `${n}${done.nextBefore ? "+" : ""}` : "");

  useEffect(() => {
    const idle = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(warmTaskForm, { timeout: 2500 })
      : window.setTimeout(warmTaskForm, 800);
    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  /* ── row callbacks (stable — rows are memoised) ── */
  const openTask = (id: string) => setOpenId(id);
  const closeSheet = () => setOpenId(null);
  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openEdit = (id: string) => setModal({ id, key: Date.now() });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  /* Deep link → the task's sheet, with its row highlighted and in view
     behind it (the list is where the reader returns to). */
  const focusTask = (id: string) => {
    setView("list");
    setOpenId(id);
    setHighlightId(id);
    setTimeout(() => {
      document.querySelector(`[data-task-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 2600);
  };

  /* ── deep link: /todo?task=<id> (inbox, notifications, AI) ──
     Opens the task's detail sheet over the list — highlighted and scrolled
     to behind it — rather than the edit form, which an assignee is not
     allowed to use.
     Filters that would hide it are cleared first. A task that no longer
     exists (or is not yours) says so instead of waiting forever. */
  const deepLink = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (deepLink.current === undefined) deepLink.current = new URLSearchParams(window.location.search).get("task");
    const id = deepLink.current;
    if (!id) return;
    const found = todos.find((x) => x.id === id);
    if (!found && !synced) return;
    deepLink.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("task");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setTimeout(() => {
      if (!found) { showToast(t("toast.notFound"), "info"); return; }
      setSearch("");
      setTab("all");
      setSort("smart");
      setFilters({ ...NO_FILTERS, saView: isSA && accountId && !involves(found, accountId) && !found.assign_to_all ? "all" : "own" });
      if (found.completed) setShowCompleted(true);
      focusTask(found.id);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, synced]);

  /* ── keyboard: N = add, / = search, Esc = leave selection ── */
  const modalOpen = !!modal || !!rejectId || !!sheetTask;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "Escape" && selectMode && !typing) { setSelectMode(false); setSelected(new Set()); return; }
      if (typing) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); quickRef.current?.focus(); }
      else if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, selectMode]);

  /* ── quick add ── */
  const quickCreate = async (v: QuickAddValue) => {
    if (tab === "completed" || tab === "approvals") setTab("all");
    const problem = await actions.create({
      title: v.title, description: v.description, priority: v.priority, label: v.label,
      due_date: v.due, start_date: null, remind_at: null, status: "todo",
      recurrence: null, recurrence_until: null, assigned_department: null, assign_to_all: false, metadata: {},
    }, v.assigneeIds);
    if (problem) showToast(problem, "error");
    return !problem;
  };

  const submitModal = (fields: TaskFields, assigneeIds: string[]) =>
    modalEntry ? actions.edit(modalEntry.id, fields, assigneeIds) : actions.create(fields, assigneeIds);

  const selectedIds = [...selected];
  const renderRow = (x: TodoWithRelations) => (
    <TaskRow key={x.id} task={x} t={t} lang={lang} meId={accountId} canManage={canManage(x)}
      selectMode={selectMode} selected={selected.has(x.id)} highlight={highlightId === x.id || openId === x.id}
      actions={actions} onOpen={openTask} onSelect={toggleSelect} onEdit={openEdit} onReject={setRejectId} />
  );

  const pill = (on: boolean) => `${PILL} ${on ? PILL_ON : PILL_OFF}`;
  /* The quiet selected state the original source / horizon pills used. */
  const SOFT_ON = "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]";
  const smallSelect = "h-8 ps-2.5 pe-7 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-muted)] outline-none cursor-pointer text-start";

  return (
    /* `kx-app` is the whole Aurora conversion: globals remaps this app's own
       tokens under that scope, so every panel, row and field turns
       translucent at once and Core keeps its solid values. */
    <div className="kx-app kx-todo kx-ground-host relative bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - var(--kx-header-h, 3.5rem))" }}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <WavyBackground />
        </div>
      )}
      <div className="relative z-[1] flex flex-col min-h-0 flex-1">

        {/* ── Header (fixed) — kept short so the list starts high on a phone ── */}
        <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
            <div className="pt-5 pb-3">
              <PageHeader
                title={t("app.title")}
                subtitle={`${t("app.subtitle")} · ${stats ? open.active + stats.completed : open.active}`}
                icon={<AppIcon appId="todo" className="h-4 w-4" size={16} />}
                showTabs={false}
              />
            </div>

            {/* Search + Add. The search is a LIVE filter (PageHeader's is a
                route search), which is why it is not passed to PageHeader. */}
            <div className="flex items-center gap-2 pb-2 min-w-0">
              <div className="kx-glass flex-1 min-w-0 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 md:px-4 gap-2 md:gap-3 focus-within:border-[var(--border-focus)] transition-all">
                <SearchIcon size={16} className="text-[var(--text-dim)] shrink-0" />
                <input ref={searchRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); (e.target as HTMLInputElement).blur(); } }}
                  placeholder={t("search")} aria-label={t("search")}
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10 [&::-webkit-search-cancel-button]:hidden" />
                {search ? (
                  <button type="button" onClick={() => setSearch("")} aria-label={t("common.clear")} className="p-0.5">
                    <CrossIcon size={14} className="text-[var(--text-dim)]" />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-flex h-5 min-w-5 px-1.5 items-center justify-center rounded border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-ghost)]">/</kbd>
                )}
              </div>
              <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-label={t("filters")}
                className={`h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                  filtersOpen || panelActive
                    ? "bg-[#567FB2]/10 border-[#567FB2]/30 text-[#7FA9D6]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}>
                <FilterIcon size={14} />
                <span className="hidden md:inline">{t("filters")}</span>
                {panelActive && <span className="w-1.5 h-1.5 rounded-full bg-[#7FA9D6]" />}
              </button>
              <Link href="/todo/report" title={t("report.link")} aria-label={t("report.link")}
                className="kx-glass h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-all shrink-0 bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <BarChart3Icon size={14} />
                <span className="hidden md:inline">{t("report.link")}</span>
              </Link>
              <button type="button" onClick={() => setModal({ id: null, key: Date.now() })} onPointerEnter={warmTaskForm} onFocus={warmTaskForm} aria-label={t("add")}
                className="h-10 px-3 md:px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shrink-0">
                <PlusIcon size={16} />
                <span className="hidden md:inline">{t("add")}</span>
              </button>
            </div>

            {/* Cross-app: my project tasks + upcoming shifts (renders only when
                non-empty). In the header on a desktop as before; on a phone it
                moves into the scrolling list so the tasks are not pushed off. */}
            <div className="hidden md:block">
              <MyWorkStrip />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-none [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
              <div role="tablist" aria-label={t("app.title")} className="flex items-center gap-1.5 shrink-0">
                {([
                  ["all", t("pill.all"), stats ? String(open.active + stats.completed) : moreDone ? "" : String(counts.all)],
                  ["active", t("pill.active"), String(open.active)],
                  ["completed", t("pill.done"), stats ? String(stats.completed) : doneCount(counts.done)],
                ] as const).map(([k, label, n]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={pill(tab === k)}>
                    {label}{n ? ` (${n})` : ""}
                  </button>
                ))}
                {/* Waiting for MY sign-off — amber so a manager cannot miss it. */}
                {(counts.approvals > 0 || tab === "approvals") && (
                  <button type="button" role="tab" aria-selected={tab === "approvals"} onClick={() => setTab(tab === "approvals" ? "all" : "approvals")}
                    className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all border whitespace-nowrap ${tab === "approvals" ? "bg-amber-500/25 border-amber-500/50 text-amber-300" : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"}`}>
                    {t("pill.approvals")} ({counts.approvals})
                  </button>
                )}
              </div>
              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1 shrink-0" />
              {PRIORITIES.map((p) => (
                <button key={p} type="button" aria-pressed={filters.priority === p} onClick={() => setF({ priority: filters.priority === p ? "" : p })}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1 whitespace-nowrap shrink-0 ${filters.priority === p ? PRIORITY_ON[p] : PILL_OFF}`}>
                  <FlagIcon size={10} /> {t("p." + p)}
                </button>
              ))}
              {isSA && (
                <>
                  <div className="w-px h-4 bg-[var(--border-subtle)] mx-1 shrink-0" />
                  {/* Super-admin audience lens — whose tasks am I looking at? */}
                  <KdsSelect value={filters.saView} onChange={(v) => setF({ saView: v || "own" })}
                    options={[
                      { value: "own", label: t("sa.viewOwn") },
                      { value: "all", label: t("sa.viewAll") },
                      ...employees.filter((e) => e.account_id !== accountId).map((e) => ({
                        value: e.account_id,
                        label: (e.full_name || e.username) + (e.name_alt ? ` · ${e.name_alt}` : ""),
                      })),
                    ]}
                    panelWidthClassName="min-w-[12rem]" wrapperClassName="shrink-0"
                    triggerClassName={`h-7 ps-2.5 pe-7 rounded-full text-[11px] font-semibold border outline-none cursor-pointer text-start ${
                      filters.saView === "own"
                        ? "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)]"
                        : "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]"
                    }`} />
                </>
              )}
              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1 shrink-0" />
              {/* Source: my own to-dos vs. tasks someone else gave me */}
              {([
                { v: "all", key: "src.all", icon: null },
                { v: "mine", key: "src.mine", icon: <UserIcon size={11} /> },
                { v: "assigned", key: "pill.assignedToMe", icon: <UserCheckIcon size={11} /> },
              ] as const).map((o) => (
                <button key={o.v} type="button" aria-pressed={filters.source === o.v} onClick={() => setF({ source: o.v as SourceFilter })}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${filters.source === o.v ? SOFT_ON : PILL_OFF}`}>
                  {o.icon} {t(o.key)}
                </button>
              ))}
              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1 shrink-0" />
              {/* Horizon — daily / weekly / monthly to-do */}
              {([["", "cadence.all"], ["today", "cadence.day"], ["week", "cadence.week"], ["month", "cadence.month"]] as const).map(([v, key]) => (
                <button key={key} type="button" aria-pressed={filters.due === v} onClick={() => setF({ due: v as DueFilter })}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap shrink-0 ${filters.due === v ? SOFT_ON : PILL_OFF}`}>
                  {t(key)}
                </button>
              ))}
            </div>

            {/* View · Sort · Select */}
            <div className="flex items-center gap-2 pb-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-[var(--border-color)] overflow-hidden" role="group" aria-label={t("view.label")}>
                {(["list", "board"] as const).map((v) => (
                  /* rounded-md is not decoration: kx-seg-on paints an INSET
                     RING, and a ring follows the element's own radius. */
                  <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                    className={`h-8 px-3 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${view === v ? "kx-seg-on text-[var(--text-primary)]" : "bg-[var(--bg-secondary)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                    <ViewLabel view={v} label={t("view." + v)} />
                  </button>
                ))}
              </div>
              <KdsSelect value={sort} onChange={(v) => setSort(v as Sort)}
                options={[{ value: "smart", label: t("sort.smart") }, { value: "due", label: t("sort.due") },
                  { value: "priority", label: t("sort.priority") }, { value: "created", label: t("sort.created") }]}
                triggerClassName={smallSelect} />
              <button type="button" onClick={() => (selectMode ? exitSelect() : setSelectMode(true))} aria-pressed={selectMode}
                className={`h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors ${selectMode ? "bg-[#567FB2]/10 border-[#567FB2]/30 text-[#7FA9D6]" : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                {selectMode ? t("bulk.cancel") : t("bulk.select")}
              </button>
            </div>

            {selectMode && (
              <div className="flex items-center gap-2 pb-3 flex-wrap">
                <span className="text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">{selected.size} {t("bulk.selected")}</span>
                <button type="button" onClick={() => setSelected(new Set(view === "board" ? shown.map((x) => x.id) : flat.map((x) => x.id)))}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                  {t("bulk.selectAll")} ({shown.length})
                </button>
                {selected.size > 0 && (
                  <>
                    <div className="w-px h-4 bg-[var(--border-subtle)]" />
                    <button type="button" onClick={() => { void actions.bulkStatus(selectedIds, "done"); exitSelect(); }}
                      className="h-8 px-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-semibold flex items-center gap-1.5">
                      <CheckCircleIcon size={13} /> {t("bulk.markDone")}
                    </button>
                    {/* Action menus: fire on pick and snap back to their prompt. */}
                    <KdsSelect value="" onChange={(v) => { if (v) { void actions.bulkStatus(selectedIds, v as TodoStatus); exitSelect(); } }}
                      options={STATUSES.map((st) => ({ value: st, label: t("st." + st) }))}
                      placeholder={t("bulk.setStatus")} triggerClassName={smallSelect} />
                    {employees.length > 0 && (
                      <KdsSelect value="" onChange={(v) => {
                        const emp = employees.find((e) => e.account_id === v);
                        if (emp) { void actions.bulkReassign(selectedIds, emp); exitSelect(); }
                      }}
                        options={employees.map((emp) => ({ value: emp.account_id, label: emp.full_name || emp.username }))}
                        placeholder={t("bulk.reassign")} triggerClassName={`${smallSelect} max-w-[160px]`} />
                    )}
                    <button type="button" onClick={() => { actions.remove(selectedIds); exitSelect(); }}
                      className="h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-semibold flex items-center gap-1.5">
                      <TrashIcon size={13} /> {t("bulk.delete")}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Advanced filters panel */}
            {filtersOpen && (
              <FiltersPanel value={filters} onChange={setF} t={t} lang={lang}
                onClear={() => setF({ status: "", dept: "", assignee: "", label: "", from: "", to: "" })}
                departments={departments} assignees={assigneesInUse} labels={labelsInUse} />
            )}
          </div>
        </div>

        {/* ── Scrolling content ── */}
        {/* Room under the last task for the floating dock comes from the
            shell's DockClearance, as in every other app. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-5 w-full min-w-0 space-y-3">
            <QuickAdd t={t} lang={lang} labels={labelsInUse} employees={employees} inputRef={quickRef} onCreate={quickCreate}
              onOpenForm={(draft) => setModal({ id: null, key: Date.now(), draft })} />

            {error != null && data && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
                <TriangleWarningIcon size={14} className="shrink-0" />
                <span className="flex-1 min-w-0">{t("err.loadStale")}</span>
                <button type="button" onClick={actions.retry} className="font-semibold underline underline-offset-2">{t("common.retry")}</button>
              </div>
            )}

            {data?.truncated && (
              <p className="text-[11.5px] text-[var(--text-dim)] px-1">{t("err.truncated")}</p>
            )}

            <div className="md:hidden">
              <MyWorkStrip />
            </div>

            {/* The cards always show once the list has loaded — zeros included —
                so the page keeps its dashboard even before the first task. */}
            {!loading && data && (
              <KpiDashboard active={open.active} overdue={open.overdue} high={open.high} stats={stats} t={t} />
            )}

            {loading ? (
              <ListSkeleton />
            ) : error != null && !data ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <TriangleWarningIcon size={26} className="text-amber-400" />
                <p className="text-[13px] font-medium text-[var(--text-muted)]">{t("err.loadFailed")}</p>
                <button type="button" onClick={actions.retry}
                  className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold">{t("common.retry")}</button>
              </div>
            ) : tab === "completed" && !done.loaded && shown.length === 0 ? (
              done.error ? <LoadMore t={t} done={done} onMore={actions.loadMoreDone} /> : <ListSkeleton />
            ) : shown.length === 0 && !(tab === "all" && moreDone && !deferredSearch.trim() && filterCount === 0) ? (
              <EmptyList t={t} tab={tab} searching={!!deferredSearch.trim()} filtered={filterCount > 0}
                onClearSearch={() => setSearch("")} onClearFilters={() => setFilters({ ...NO_FILTERS })}
                onAdd={() => quickRef.current?.focus()} />
            ) : view === "board" ? (
              <TodoBoard tasks={flat} t={t} lang={lang} actions={actions} onOpen={openTask} />
            ) : sort !== "smart" || tab === "completed" || tab === "approvals" ? (
              <>
                <div className="kx-glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                  {flat.map(renderRow)}
                </div>
                {tab === "completed" && <LoadMore t={t} done={done} onMore={actions.loadMoreDone} />}
              </>
            ) : (
              <div className="space-y-3">
                <Section title={t("section.overdue")} count={groups.overdue.length} tone="text-red-400">{groups.overdue.map(renderRow)}</Section>
                <Section title={t("section.today")} count={groups.today.length} tone="text-green-400">{groups.today.map(renderRow)}</Section>
                <Section title={t("section.upcoming")} count={groups.upcoming.length} tone="text-[#7FA9D6]">{groups.upcoming.map(renderRow)}</Section>
                <Section title={t("section.noDate")} count={groups.noDate.length} tone="text-[var(--text-faint)]">{groups.noDate.map(renderRow)}</Section>
                {/* Folded by default: finished work is review, not today's list —
                    and it is usually the longest group by far. */}
                <Section title={t("section.completed")} count={groups.completed.length} tone="text-[var(--text-dim)]"
                  countLabel={done.loaded ? doneCount(groups.completed.length) : ""} keep={tab === "all" && moreDone}
                  open={showCompleted} onToggle={() => setShowCompleted((v) => !v)}>
                  {showCompleted && groups.completed.map(renderRow)}
                  {showCompleted && <LoadMore t={t} done={done} onMore={actions.loadMoreDone} inline />}
                </Section>
              </div>
            )}

            {deferredSearch.trim() && moreDone && (tab === "all" || tab === "completed") && (
              <p className="text-center text-[11px] text-[var(--text-dim)]">{t("done.searchHint")}</p>
            )}

            {!loading && data && (
              <p className="hidden md:block text-center text-[11px] text-[var(--text-ghost)] pt-2">{t("shortcuts.hint")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Overlays live outside the z-[1] layer so they stack above the app. */}
      {sheetTask && (
        <TaskSheet key={sheetTask.id} task={sheetTask} t={t} lang={lang} meId={accountId}
          canManage={canManage(sheetTask)} isOwner={isOwner(sheetTask)} paused={!!modal || !!rejectId}
          actions={actions} onClose={closeSheet} onEdit={openEdit} onReject={setRejectId} />
      )}
      {modal && (
        <TaskModal key={modal.key} entry={modalEntry} draft={modal.draft} employees={employees} departments={departments} labels={labels} canAssignAll={canAssignAll}
          onClose={() => setModal(null)} onSubmit={submitModal} onLabelCreated={actions.addLabel} />
      )}
      {rejectId && (
        <RejectDialog t={t} onCancel={() => setRejectId(null)}
          onSend={(reason) => { const id = rejectId; setRejectId(null); void actions.reject(id, reason); }} />
      )}
      {toastElement}
    </div>
  );
}

/* ── Section — a collapsible group of the smart list ── */
function Section({ title, count, countLabel, keep, tone, children, open: controlled, onToggle }: {
  title: string; count: number; tone: string; children: React.ReactNode; open?: boolean; onToggle?: () => void;
  /** Shown instead of the count (e.g. "50+"); "" hides the badge. */
  countLabel?: string;
  /** Render even while empty (there may be more to load). */
  keep?: boolean;
}) {
  const [own, setOwn] = useState(true);
  const open = controlled ?? own;
  if (count === 0 && !keep) return null;
  const badge = countLabel ?? String(count);
  return (
    <section className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <button type="button" onClick={() => (onToggle ? onToggle() : setOwn((v) => !v))} aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors rounded-2xl" data-kx-keep-hover>
        <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
        <h2 className={`text-[12px] font-bold uppercase tracking-wider ${tone}`}>{title}</h2>
        {badge && <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full tabular-nums">{badge}</span>}
      </button>
      {open && <div className="border-t border-[var(--border-subtle)]">{children}</div>}
    </section>
  );
}

function ViewLabel({ view, label }: { view: "list" | "board"; label: string }) {
  return (
    <>
      {view === "list" ? <LayoutListIcon size={13} /> : <LayoutGridIcon size={13} />}
      <span>{label}</span>
    </>
  );
}

/* History pager: "Load more" while older finished tasks remain. */
function LoadMore({ t, done, onMore, inline = false }: { t: (k: string) => string; done: DoneState; onMore: () => void; inline?: boolean }) {
  if (done.loaded && !done.nextBefore && !done.error) return null;
  return (
    <div className={`flex items-center justify-center gap-2 ${inline ? "py-2.5" : "pt-1"}`}>
      {done.error && <span className="text-[11.5px] text-amber-300">{t("done.loadFailed")}</span>}
      <button type="button" onClick={onMore} disabled={done.loading}
        className="h-8 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 flex items-center gap-1.5">
        {done.loading && <SpinnerIcon className="h-3.5 w-3.5" />}
        {done.error ? t("common.retry") : t("done.loadMore")}
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden divide-y divide-[var(--border-subtle)]" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5">
          <span className="h-5 w-5 rounded-full bg-[var(--bg-surface)] shrink-0" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 rounded bg-[var(--bg-surface)] animate-pulse" style={{ width: `${70 - i * 7}%` }} />
            <span className="block h-2.5 w-24 rounded bg-[var(--bg-surface)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyList({ t, tab, searching, filtered, onClearSearch, onClearFilters, onAdd }: {
  t: (k: string) => string; tab: Tab; searching: boolean; filtered: boolean;
  onClearSearch: () => void; onClearFilters: () => void; onAdd: () => void;
}) {
  const [title, action, onAction] = searching
    ? [t("empty.noSearch"), t("empty.clearSearch"), onClearSearch]
    : filtered
      ? [t("empty.noFilter"), t("filters.clearBtn"), onClearFilters]
      : tab === "completed"
        ? [t("empty.noCompleted"), null, null]
        : tab === "approvals"
          ? [t("empty.noApprovals"), null, null]
          : tab === "active"
            ? [t("empty.allDone"), t("empty.createFirst"), onAdd]
            : [t("empty.title"), t("empty.createFirst"), onAdd];
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-14 gap-2 text-center">
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--bg-surface)]">
        <TodoIcon size={22} className="text-[var(--text-ghost)]" />
      </span>
      <p className="text-[13px] font-medium text-[var(--text-muted)]">{title}</p>
      {!searching && !filtered && (tab === "all" || tab === "active") && (
        <p className="text-[12px] text-[var(--text-dim)] max-w-sm">{t("empty.hint")}</p>
      )}
      {action && onAction && (
        <button type="button" onClick={onAction} className="mt-1 text-[12px] font-semibold text-[#7FA9D6] hover:text-[#BCD8F0] transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}
