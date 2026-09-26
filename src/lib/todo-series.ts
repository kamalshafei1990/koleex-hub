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

/* The business day rolls over at midnight CHINA time, not UTC. Koleex
   operates on Asia/Shanghai (UTC+8, no DST — a fixed offset is exact), and
   every period rule reads the clock shifted by it: the recurrence spawner,
   the list's series_period, the open-count badge and the overdue escalation.
   Written once here so the four cannot disagree about which day a task is. */
export const TENANT_UTC_OFFSET_HOURS = 8;

/** The tenant-local calendar day (YYYY-MM-DD) an instant falls on. */
export function tenantDateKey(instant: Date | string): string {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + TENANT_UTC_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
}

/** Which period of its series a row IS: a spawned instance names it
 *  outright; the template is its own first period — its start date, else
 *  the tenant-local day it was created on (the spawner anchors it the same
 *  way, so the two never disagree about "newest"). */
export function seriesPeriodOf(r: {
  recurrence_spawned_for: string | null;
  start_date: string | null;
  created_at: string | null;
}): string {
  return r.recurrence_spawned_for ?? r.start_date ?? (r.created_at ? tenantDateKey(r.created_at) : "");
}

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
