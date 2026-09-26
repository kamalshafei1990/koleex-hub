/* ---------------------------------------------------------------------------
   To-do filters — the state, the predicate, and the chip list, in one place
   so the sheet, the chips row and the list can never disagree about what a
   filter means.
   --------------------------------------------------------------------------- */

import type { TodoAssigneeInfo, TodoPriority, TodoStatus, TodoWithRelations } from "@/types/supabase";
import { dayKey, fmtDay, horizonRange, isOverdueDate } from "./todo-dates";
import type { TFn } from "./todo-ui";

export type DueFilter = "" | "overdue" | "today" | "week" | "month" | "none";
export type SourceFilter = "all" | "mine" | "assigned";

export interface TodoFilters {
  due: DueFilter;
  source: SourceFilter;
  priority: "" | TodoPriority;
  status: "" | TodoStatus;
  dept: string;
  assignee: string;
  label: string;
  /** Inclusive day range, against the due day OR the created day. */
  from: string;
  to: string;
  /** Super admin only: "own" | "all" | an account id. */
  saView: string;
}

export const NO_FILTERS: TodoFilters = {
  due: "", source: "all", priority: "", status: "", dept: "", assignee: "", label: "", from: "", to: "", saView: "own",
};

/** Filters other than the super-admin lens that narrow the list. */
export function activeFilterCount(f: TodoFilters): number {
  return (["due", "priority", "status", "dept", "assignee", "label", "from", "to"] as const)
    .filter((k) => f[k] !== "").length + (f.source !== "all" ? 1 : 0) + (f.saView !== "own" ? 1 : 0);
}

export function matchesFilters(task: TodoWithRelations, f: TodoFilters, meId: string | null): boolean {
  if (f.source !== "all") {
    /* "Assigned to me" = someone ELSE gave it to me; everything else is mine. */
    const delegated = !!task.assigned_by_account_id && task.assigned_by_account_id !== meId;
    if ((f.source === "assigned") !== delegated) return false;
  }
  if (f.priority && task.priority !== f.priority) return false;
  if (f.status && (task.status ?? "todo") !== f.status) return false;
  if (f.label && task.label !== f.label) return false;
  if (f.dept && task.assigned_department !== f.dept && !task.assignees.some((a) => a.department === f.dept)) return false;
  if (f.assignee && !task.assignees.some((a) => a.account_id === f.assignee)) return false;

  const due = dayKey(task.due_date);
  if (f.due) {
    if (f.due === "none") { if (due) return false; }
    else if (f.due === "overdue") { if (task.completed || !isOverdueDate(task.due_date)) return false; }
    else {
      if (!due) return false;
      const [a, b] = horizonRange(f.due);
      if (due < a || due > b) return false;
    }
  }
  if (f.from || f.to) {
    /* In range when EITHER its due day or its created day falls inside the
       range — the old check tested each bound against a different date and
       let a task created before the range and due after it through. */
    const inRange = (k: string | null) => !!k && (!f.from || k >= f.from) && (!f.to || k <= f.to);
    if (!inRange(due) && !inRange(dayKey(task.created_at))) return false;
  }
  return true;
}

export interface FilterChip { key: keyof TodoFilters | "range"; label: string }

export function filterChips(f: TodoFilters, t: TFn, lang: string, people: TodoAssigneeInfo[]): FilterChip[] {
  const out: FilterChip[] = [];
  const name = (id: string) => {
    const p = people.find((e) => e.account_id === id);
    return p ? p.full_name || p.username : id.slice(0, 8);
  };
  if (f.saView !== "own") out.push({ key: "saView", label: f.saView === "all" ? t("sa.viewAll") : `${t("sa.viewing")} ${name(f.saView)}` });
  if (f.due) out.push({ key: "due", label: t("due." + f.due) });
  if (f.source !== "all") out.push({ key: "source", label: f.source === "mine" ? t("src.mine") : t("pill.assignedToMe") });
  if (f.priority) out.push({ key: "priority", label: t("p." + f.priority) });
  if (f.status) out.push({ key: "status", label: t("st." + f.status) });
  if (f.dept) out.push({ key: "dept", label: f.dept });
  if (f.assignee) out.push({ key: "assignee", label: name(f.assignee) });
  if (f.label) out.push({ key: "label", label: f.label });
  if (f.from || f.to) {
    out.push({ key: "range", label: `${f.from ? fmtDay(f.from, lang) : "…"} – ${f.to ? fmtDay(f.to, lang) : "…"}` });
  }
  return out;
}
