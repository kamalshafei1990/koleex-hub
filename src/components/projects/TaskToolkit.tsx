"use client";

/* ---------------------------------------------------------------------------
   TaskToolkit — the pieces the board, the project list view and the flat
   My/All Tasks lists share:

     · TaskFilterState + applyTaskFilter + <TaskFilterBar>   (with saved
       filters stored per user in accounts.preferences)
     · useTaskSelection + <SelectBox> + <BulkBar>              (multi-select,
       shift-click ranges, one POST /api/projects/tasks/bulk per action)
     · <QuickAddTask>                                          (title + Enter
       at the bottom of a board column)
     · <DueTodayStrip>                                         (My Tasks)

   Everything here is logical-property / RTL safe and uses theme tokens.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/kds/useConfirm";
import PopoverPanel from "@/components/kds/PopoverPanel";
import { MenuBody, MenuItem } from "@/components/kds/MenuList";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import { DEFAULT_MAX_AGE_MS, useWarmData } from "@/lib/warm-cache";
import { BookmarkIcon, CheckIcon, CrossIcon, FilterIcon, FlagIcon, PlusIcon, SearchIcon, SpinnerIcon, TrashIcon } from "@/components/icons/ui";
import {
  accountLabel,
  bulkTasks,
  createTask,
  fetchAccounts,
  fetchSavedFilters,
  fetchTasks,
  formatDueDate,
  isOverdue,
  PRIORITY_COLOR,
  saveSavedFilters,
  todayLocalISO,
  type AccountLite,
  type BulkTaskAction,
  type ProjectStage,
  type ProjectTag,
  type SavedTaskFilter,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "@/lib/projects";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const chipOn = "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent";
const chipOff = "kx-seg-off bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";
const selectCls =
  "h-7 ps-2.5 pe-7 rounded-full text-[11px] font-semibold border outline-none cursor-pointer bg-transparent border-[var(--border-subtle)] text-[var(--text-muted)] focus-visible:border-[var(--border-focus)] max-w-[160px]";

/* ── Accounts (shared cache in lib/projects) ─────────────────────── */

export function useAccounts(): AccountLite[] {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAccounts().then((a) => { if (alive) setAccounts(a); });
    return () => { alive = false; };
  }, []);
  return accounts;
}

/* ══════════════════════════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════════════════════════ */

export interface TaskFilterState {
  assignee: string | null;
  tag: string | null;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  search: string;
  overdue: boolean;
}

export const filterDefaults = (status: TaskStatus | "all"): TaskFilterState => ({
  assignee: null, tag: null, status, priority: "all", search: "", overdue: false,
});

export function isDefaultFilter(f: TaskFilterState, d: TaskFilterState): boolean {
  return f.assignee === d.assignee && f.tag === d.tag && f.status === d.status &&
    f.priority === d.priority && !f.search.trim() && f.overdue === d.overdue;
}

/** Client-side filter (board / list / timeline hold every task already). */
export function applyTaskFilter(tasks: TaskRow[], f: TaskFilterState): TaskRow[] {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((tk) =>
    (!f.assignee || tk.assignee_account_id === f.assignee) &&
    (!f.tag || tk.tag_ids.includes(f.tag)) &&
    (f.status === "all" || tk.status === f.status) &&
    (f.priority === "all" || tk.priority === f.priority) &&
    (!q || tk.title.toLowerCase().includes(q)) &&
    (!f.overdue || (tk.status === "open" && isOverdue(tk.due_date))),
  );
}

export function TaskFilterBar({
  value,
  onChange,
  defaults,
  scope,
  tags,
  accounts,
  hideAssignee = false,
  trailing,
}: {
  value: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  defaults: TaskFilterState;
  scope: SavedTaskFilter["scope"];
  tags: ProjectTag[];
  accounts: AccountLite[];
  /** My Tasks — the assignee is always "me". */
  hideAssignee?: boolean;
  trailing?: React.ReactNode;
}) {
  const { t } = useTranslation(projectsT);
  const set = <K extends keyof TaskFilterState>(k: K, v: TaskFilterState[K]) => onChange({ ...value, [k]: v });
  const dirty = !isDefaultFilter(value, defaults);
  const priorities: (TaskPriority | "all")[] = ["all", "urgent", "high", "normal", "low"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <SearchIcon size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
        <input
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder={t("task.searchPh", "Search tasks…")}
          aria-label={t("task.searchPh", "Search tasks…")}
          className="h-7 w-full ps-8 pe-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
      </div>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="group" aria-label={t("task.status")}>
        {(["open", "done", "cancelled", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set("status", s)}
            aria-pressed={value.status === s}
            className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${value.status === s ? chipOn : chipOff}`}
          >
            {s === "all" ? t("filter.all") : t(`status.${s}`)}
          </button>
        ))}
      </div>
      <div className="relative">
        <FlagIcon size={10} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
        <select
          value={value.priority}
          onChange={(e) => set("priority", e.target.value as TaskPriority | "all")}
          aria-label={t("task.priority")}
          className={`${selectCls} ps-6 ${value.priority !== "all" ? "kx-seg-on rounded-full text-[var(--text-primary)] border-[var(--border-focus)]" : ""}`}
        >
          {priorities.map((p) => (
            <option key={p} value={p}>{p === "all" ? `${t("task.priority")}: ${t("filter.all")}` : t(`priority.${p}`)}</option>
          ))}
        </select>
      </div>
      {!hideAssignee && (
        <select
          value={value.assignee ?? ""}
          onChange={(e) => set("assignee", e.target.value || null)}
          aria-label={t("filter.assignee")}
          className={`${selectCls} ${value.assignee ? "kx-seg-on rounded-full text-[var(--text-primary)] border-[var(--border-focus)]" : ""}`}
        >
          <option value="">{t("filter.anyAssignee")}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </select>
      )}
      {tags.length > 0 && (
        <select
          value={value.tag ?? ""}
          onChange={(e) => set("tag", e.target.value || null)}
          aria-label={t("filter.tag")}
          className={`${selectCls} ${value.tag ? "kx-seg-on rounded-full text-[var(--text-primary)] border-[var(--border-focus)]" : ""}`}
        >
          <option value="">{t("filter.anyTag")}</option>
          {tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={() => set("overdue", !value.overdue)}
        aria-pressed={value.overdue}
        className={`h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
          value.overdue ? "bg-rose-500/15 text-rose-400 border-rose-500/30" : chipOff
        }`}
      >
        {t("filter.overdue", "Overdue")}
      </button>
      {dirty && (
        <button
          type="button"
          onClick={() => onChange(defaults)}
          className="h-7 px-2.5 rounded-full text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          <CrossIcon size={10} /> {t("filter.reset")}
        </button>
      )}
      <div className="flex-1" />
      <SavedFiltersMenu value={value} scope={scope} onApply={onChange} />
      {trailing}
    </div>
  );
}

function newFilterId(): string {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function SavedFiltersMenu({
  value,
  scope,
  onApply,
}: {
  value: TaskFilterState;
  scope: SavedTaskFilter["scope"];
  onApply: (f: TaskFilterState) => void;
}) {
  const { t } = useTranslation(projectsT);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Warm-started (per user in localStorage via warm-cache) so the menu opens
     filled; revalidated when first opened. */
  const load = useCallback(() => fetchSavedFilters(), []);
  const { data, reload } = useWarmData<SavedTaskFilter[]>("projects:savedFilters", load, DEFAULT_MAX_AGE_MS, 5 * 60_000);
  const list = data ?? [];

  const persist = async (next: SavedTaskFilter[]) => {
    setBusy(true);
    setErr(null);
    try {
      await saveSavedFilters(next);
      await reload();
    } catch (e) {
      setErr(t("toast.saveFailed").replace("{err}", errText(e)));
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    const n = name.trim();
    if (!n || busy) return;
    await persist([
      ...list,
      { id: newFilterId(), name: n, scope, assignee: value.assignee, tag: value.tag, status: value.status, priority: value.priority, search: value.search.trim(), overdue: value.overdue },
    ]);
    setName("");
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-7 px-2.5 rounded-full text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1.5"
      >
        <BookmarkIcon size={11} /> <span className="hidden sm:inline">{t("sf.saved")}</span>
        {list.length > 0 && <span className="text-[10px] text-[var(--text-ghost)] tabular-nums">{list.length}</span>}
      </button>
      <PopoverPanel anchorRef={anchor} open={open} onClose={() => setOpen(false)} matchAnchorWidth={false} align="end" className="w-72">
        <MenuBody>
          {list.length === 0 && <div className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("sf.none")}</div>}
          {list.map((f) => (
            <div key={f.id} className="flex items-center">
              <MenuItem
                role="menuitem"
                onClick={() => {
                  onApply({ assignee: f.assignee, tag: f.tag, status: f.status, priority: f.priority, search: f.search, overdue: f.overdue });
                  setOpen(false);
                }}
                className="flex-1 min-w-0"
              >
                <FilterIcon size={12} className="shrink-0 text-[var(--text-dim)]" />
                <span className="truncate">{f.name}</span>
              </MenuItem>
              <button
                type="button"
                onClick={() => { void persist(list.filter((x) => x.id !== f.id)); }}
                aria-label={`${t("sf.delete")}: ${f.name}`}
                title={t("sf.delete")}
                disabled={busy}
                className="h-8 w-8 shrink-0 flex items-center justify-center text-[var(--text-dim)] hover:text-rose-400 disabled:opacity-50"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </MenuBody>
        <div className="p-2 border-t border-[var(--border-subtle)] space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void saveCurrent(); }}
              placeholder={t("sf.namePh")}
              aria-label={t("sf.namePh")}
              maxLength={60}
              className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] outline-none focus:border-[var(--border-focus)]"
            />
            <button
              type="button"
              onClick={() => { void saveCurrent(); }}
              disabled={busy || !name.trim()}
              aria-label={t("sf.save")}
              title={t("sf.save")}
              className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center disabled:opacity-50"
            >
              {busy ? <SpinnerIcon className="h-3 w-3" /> : <CheckIcon size={11} />}
            </button>
          </div>
          {err && <div role="alert" className="text-[11px] text-rose-400">{err}</div>}
        </div>
      </PopoverPanel>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SELECTION + BULK
   ══════════════════════════════════════════════════════════════════ */

/** Multi-select over an ordered id list. Shift-click selects the range from
 *  the last clicked id. Ids that leave the list drop out of the selection. */
export function useTaskSelection(orderedIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const anchor = useRef<string | null>(null);
  const present = useMemo(() => new Set(orderedIds), [orderedIds]);
  const selected = useMemo(() => new Set([...picked].filter((id) => present.has(id))), [picked, present]);

  const toggle = useCallback((id: string, shift: boolean) => {
    setPicked((prev) => {
      const next = new Set([...prev].filter((x) => present.has(x)));
      const from = anchor.current ? orderedIds.indexOf(anchor.current) : -1;
      const to = orderedIds.indexOf(id);
      if (shift && from >= 0 && to >= 0) {
        const [a, b] = from < to ? [from, to] : [to, from];
        for (let i = a; i <= b; i++) next.add(orderedIds[i]);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }, [orderedIds, present]);

  const clear = useCallback(() => { setPicked(new Set()); anchor.current = null; }, []);
  const selectAll = useCallback(() => setPicked(new Set(orderedIds)), [orderedIds]);
  return { selected, count: selected.size, toggle, clear, selectAll };
}

/** The per-row checkbox (KDS CB-3 look). Stops the click reaching the row. */
export function SelectBox({
  checked,
  onToggle,
  label,
  className = "",
}: {
  checked: boolean;
  onToggle: (shift: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(e.shiftKey); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.stopPropagation(); }}
      onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); /* no text selection on range clicks */ }}
      className={`h-4 w-4 shrink-0 rounded-[5px] border flex items-center justify-center transition-colors ${
        checked
          ? "bg-[var(--bg-inverted)] border-[var(--bg-inverted)] text-[var(--text-inverted)]"
          : "border-[var(--border-strong)] text-transparent hover:border-[var(--border-focus)]"
      } ${className}`}
    >
      <CheckIcon className="h-2.5 w-2.5" />
    </button>
  );
}

export function BulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  stages,
  accounts,
  onRun,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** Present on a project board/list → "Move to stage". Flat lists get
   *  "Set status" instead (their tasks may span projects). */
  stages?: ProjectStage[];
  accounts: AccountLite[];
  onRun: (op: BulkTaskAction) => Promise<void>;
}) {
  const { t } = useTranslation(projectsT);
  const { askConfirm, confirmDialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [due, setDue] = useState("");
  const dueId = useId();

  if (count === 0) return confirmDialog;

  const run = async (op: BulkTaskAction) => {
    if (busy) return;
    setBusy(true);
    try { await onRun(op); } finally { setBusy(false); }
  };
  const sel = "h-8 ps-2.5 pe-7 rounded-lg text-[12px] font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus-visible:border-[var(--border-focus)] disabled:opacity-50 max-w-[170px]";

  return (
    <div
      role="toolbar"
      aria-label={t("bulk.toolbar")}
      className="kx-glass-pop sticky bottom-3 z-20 mx-auto w-fit max-w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl px-3 py-2 flex flex-wrap items-center gap-2"
    >
      {confirmDialog}
      <span className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums" aria-live="polite">
        {t("bulk.selected").replace("{n}", String(count))}
      </span>
      {count < total && (
        <button type="button" onClick={onSelectAll} className="text-[11px] font-semibold text-[#567FB2] dark:text-[#7FA9D6] hover:underline">
          {t("bulk.selectAll")} ({total})
        </button>
      )}
      <span className="w-px h-5 bg-[var(--border-subtle)]" aria-hidden />
      {stages ? (
        <select
          value=""
          disabled={busy}
          onChange={(e) => { if (e.target.value) void run({ action: "stage", value: e.target.value }); }}
          aria-label={t("bulk.moveStage")}
          className={sel}
        >
          <option value="">{t("bulk.moveStage")}</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      ) : (
        <select
          value=""
          disabled={busy}
          onChange={(e) => { if (e.target.value) void run({ action: "status", value: e.target.value as TaskStatus }); }}
          aria-label={t("bulk.status")}
          className={sel}
        >
          <option value="">{t("bulk.status")}</option>
          {(["open", "done", "cancelled"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      )}
      <select
        value=""
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          void run({ action: "assign", value: v === "__none__" ? null : v });
        }}
        aria-label={t("bulk.assign")}
        className={sel}
      >
        <option value="">{t("bulk.assign")}</option>
        <option value="__none__">{t("task.unassigned")}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
      </select>
      <select
        value=""
        disabled={busy}
        onChange={(e) => { if (e.target.value) void run({ action: "priority", value: e.target.value as TaskPriority }); }}
        aria-label={t("bulk.priority")}
        className={sel}
      >
        <option value="">{t("bulk.priority")}</option>
        {(["urgent", "high", "normal", "low"] as const).map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <label htmlFor={dueId} className="sr-only">{t("bulk.due")}</label>
        <input
          id={dueId}
          type="date"
          value={due}
          disabled={busy}
          onChange={(e) => setDue(e.target.value)}
          className="h-8 px-2 rounded-lg text-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus-visible:border-[var(--border-focus)]"
        />
        <button
          type="button"
          disabled={busy || !due}
          onClick={() => { void run({ action: "due", value: due }).then(() => setDue("")); }}
          aria-label={t("bulk.due")}
          title={t("bulk.due")}
          className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center disabled:opacity-40"
        >
          <CheckIcon size={11} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void run({ action: "due", value: null }); }}
          aria-label={t("bulk.clearDue")}
          title={t("bulk.clearDue")}
          className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center disabled:opacity-40"
        >
          <CrossIcon size={11} />
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => askConfirm(t("bulk.deleteConfirm").replace("{n}", String(count)), () => run({ action: "delete" }), { confirmLabel: t("btn.delete") })}
        className="h-8 px-3 rounded-lg text-[12px] font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 disabled:opacity-50"
      >
        <TrashIcon className="h-3 w-3" /> {t("bulk.delete")}
      </button>
      <span className="w-px h-5 bg-[var(--border-subtle)]" aria-hidden />
      {busy && <SpinnerIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" />}
      <button
        type="button"
        onClick={onClear}
        aria-label={t("bulk.clear")}
        title={t("bulk.clear")}
        className="h-8 w-8 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
      >
        <CrossIcon size={12} />
      </button>
    </div>
  );
}

/** Runs a bulk op, toasts the outcome, clears the selection on success. */
export function useBulkRunner(opts: {
  ids: string[];
  onDone: () => Promise<void> | void;
  clear: () => void;
  toast: (msg: string, kind: "success" | "error") => void;
}) {
  const { t } = useTranslation(projectsT);
  const { ids, onDone, clear, toast } = opts;
  return useCallback(async (op: BulkTaskAction) => {
    try {
      await bulkTasks(ids, op);
      clear();
      toast((op.action === "delete" ? t("bulk.deleted") : t("bulk.done")).replace("{n}", String(ids.length)), "success");
      await onDone();
    } catch (e) {
      toast(t(op.action === "delete" ? "toast.deleteFailed" : "toast.saveFailed").replace("{err}", errText(e)), "error");
    }
  }, [ids, onDone, clear, toast, t]);
}

/* ══════════════════════════════════════════════════════════════════
   QUICK ADD (board column footer)
   ══════════════════════════════════════════════════════════════════ */

export function QuickAddTask({
  projectId,
  stageId,
  onCreated,
  onError,
}: {
  projectId: string;
  stageId: string;
  onCreated: (task: TaskRow) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation(projectsT);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = title.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const task = await createTask({ project_id: projectId, title: v, stage_id: stageId });
      setTitle("");
      onCreated(task);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <PlusIcon size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
          if (e.key === "Escape") setTitle("");
        }}
        disabled={busy}
        placeholder={t("qa.placeholder")}
        aria-label={t("qa.placeholder")}
        maxLength={500}
        className="w-full h-8 ps-7 pe-7 rounded-lg bg-transparent border border-dashed border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] focus:border-solid focus:bg-[var(--bg-surface)] disabled:opacity-60"
      />
      {busy && <SpinnerIcon className="absolute end-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)]" />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DUE TODAY STRIP (My Tasks)
   ══════════════════════════════════════════════════════════════════ */

export function DueTodayStrip({ version, onOpen }: { version: number; onOpen: (task: TaskRow) => void }) {
  const { t, lang } = useTranslation(projectsT);
  const today = todayLocalISO();
  /* One narrow server query: my open tasks due on/before today. */
  const load = useCallback(() => fetchTasks({ mine: true, status: "open", due_lte: today, limit: 200 }), [today]);
  const { data, reload } = useWarmData<TaskRow[]>(`projects:duetoday:${today}`, load, DEFAULT_MAX_AGE_MS, 0);

  /* The list above it changed (status toggle, bulk action) — refresh too. */
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    void reload();
  }, [version, reload]);

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.title.localeCompare(b.title)),
    [data],
  );
  if (rows.length === 0) return null;
  const overdueN = rows.filter((r) => r.due_date && r.due_date < today).length;
  const todayN = rows.length - overdueN;

  return (
    <section aria-label={t("due.title")} className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("due.title")}</h3>
        <span className="text-[11px] text-[var(--text-ghost)] tabular-nums">
          {t("due.count").replace("{today}", String(todayN)).replace("{overdue}", String(overdueN))}
        </span>
      </div>
      <ul className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {rows.map((tk) => {
          const late = !!tk.due_date && tk.due_date < today;
          return (
            <li key={tk.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onOpen(tk)}
                className={`max-w-[260px] h-9 ps-2 pe-3 rounded-xl border flex items-center gap-2 text-start transition-colors ${
                  late
                    ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-400"
                    : "bg-[#567FB2]/10 border-[#567FB2]/30 hover:border-[#567FB2]"
                }`}
              >
                <span className="w-1 h-5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[tk.priority] }} />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{tk.title}</span>
                  <span className={`block truncate text-[10px] font-semibold ${late ? "text-rose-400" : "text-[#567FB2] dark:text-[#7FA9D6]"}`}>
                    {formatDueDate(tk.due_date, lang, { today: t("date.today"), tomorrow: t("date.tomorrow"), yesterday: t("date.yesterday") })}
                    {tk.project?.name ? ` · ${tk.project.name}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
