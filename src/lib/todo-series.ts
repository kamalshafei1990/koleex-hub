/* ---------------------------------------------------------------------------
   Recurring-series display rule — written once for every To-do screen.

   A daily/weekly/monthly task is stored as one row per period (the template
   row is its own first period; the cron spawns one row per period after).
   Read raw, that is the same title listed once per period — "why is this
   task here twice?".

   A period is worth showing if it is still LIVE (the newest in its series)
   or if someone actually touched it: finished it, moved it off "todo",
   submitted it for approval, or wrote a note. An untouched, superseded
   period is a day nobody acted on; it carries nothing the newest period
   doesn't, so it is dropped. Nothing with work on it is ever hidden, and
   nothing is deleted here — a display rule only.

   The server applies the same rule for the badge (lib/todo-open-count.ts);
   the list applied it inline and the Assignment Report did not apply it at
   all, so a manager's report counted every dead day of a daily task.
   --------------------------------------------------------------------------- */

import type { TodoWithRelations } from "@/types/supabase";

export function collapseSeries(todos: TodoWithRelations[]): TodoWithRelations[] {
  const newestPerSeries = new Map<string, string>();
  todos.forEach((t) => {
    if (!t.series_cadence) return;
    const key = t.recurrence_parent_id ?? t.id;
    const period = t.series_period ?? "";
    if (period > (newestPerSeries.get(key) ?? "")) newestPerSeries.set(key, period);
  });
  if (newestPerSeries.size === 0) return todos;

  const touched = (t: TodoWithRelations) =>
    t.completed ||
    (t.status !== null && t.status !== "todo") ||
    t.approval_state !== null ||
    t.notes.length > 0;

  return todos.filter((t) => {
    if (!t.series_cadence) return true;
    const key = t.recurrence_parent_id ?? t.id;
    const isNewest = (t.series_period ?? "") === newestPerSeries.get(key);
    return isNewest || touched(t);
  });
}
