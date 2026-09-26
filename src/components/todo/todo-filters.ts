/* ---------------------------------------------------------------------------
   To-do filters — the state and the predicate in one place, so the pills,
   the filter panel and the list can never disagree about what a filter
   means.
   --------------------------------------------------------------------------- */

import type { TodoPriority, TodoStatus, TodoWithRelations } from "@/types/supabase";
import { dayKey, horizonRange, isOverdueDate } from "./todo-dates";

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
