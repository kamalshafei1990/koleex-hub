/* ---------------------------------------------------------------------------
   ONE definition of "how many open to-dos do I have".

   ⚠️ THIS EXISTS BECAUSE THE SAME BUG SHIPPED TWICE. The rule below was worked
   out once, for `/api/todos?openCount`, after the owner reported a badge of 36
   over an empty list — "still 36 and the to-do app have no any tasks not
   done." It was fixed there and NOT in `/api/me/work`, which is the route that
   actually feeds the Home tile, so the badge went on counting raw rows and
   came back as 38 while the app showed 13 tasks and 2 active.

   Two routes answering the same question two different ways is the defect.
   Both now call this.

   THE RULE, and why a row count is the wrong answer:
   a recurring task is stored as ONE ROW PER PERIOD. Untouched past periods are
   dead weight — a period nobody acted on that a newer one has superseded
   carries nothing the newer one doesn't — and the list collapses them. So a
   period counts only if it is the NEWEST in its series, or somebody actually
   touched it: finished it, moved it off "todo", submitted it for approval, or
   left a note.
   --------------------------------------------------------------------------- */

import type { SupabaseClient } from "@supabase/supabase-js";

/* ⚠️ `series_cadence` AND `series_period` ARE NOT COLUMNS. They are derived by
   the list route from the real ones, and selecting them makes PostgREST fail
   with "column koleex_todos.series_cadence does not exist" — which the previous
   version swallowed into a `return 0`, so BOTH the earlier fix and my first
   version of this file reported zero open items while 38 rows sat there. The
   badge stayed wrong for a different reason than the one being fixed.

   The real columns, and how the list derives from them:
     recurrence             the cadence, set on the SERIES TEMPLATE
     recurrence_parent_id   points a spawned period at its template
     recurrence_spawned_for the period an instance represents
     start_date/created_at  the template's own first period
*/
type OpenRow = {
  id: string; status: string | null; completed: boolean | null;
  approval_state: string | null;
  recurrence: string | null; recurrence_parent_id: string | null;
  recurrence_spawned_for: string | null; start_date: string | null; created_at: string | null;
};

/**
 * How many to-dos assigned to `accountId` are genuinely open.
 *
 * Returns 0 rather than throwing: this number decorates an app icon, and a
 * badge that cannot be computed must not take a screen down with it.
 */
export async function countOpenTodos(
  db: SupabaseClient,
  accountId: string,
  tenantId: string | null | undefined,
): Promise<number> {
  const { data: mine } = await db
    .from("koleex_todo_assignees")
    .select("todo_id")
    .eq("account_id", accountId);
  const ids = (mine ?? []).map((r) => (r as { todo_id: string }).todo_id);
  if (ids.length === 0) return 0;

  let q = db
    .from("koleex_todos")
    .select("id, status, completed, approval_state, recurrence, recurrence_parent_id, recurrence_spawned_for, start_date, created_at")
    .in("id", ids)
    .neq("status", "done");
  /* ⚠️ The tenant filter was missing from the badge's own version. `ids` comes
     from this account's assignments so it is mostly implied — but "mostly" is
     not a filter, and the corrected route had it. */
  if (tenantId) q = q.eq("tenant_id", tenantId);

  const { data, error } = await q;
  if (error) {
    console.error("[countOpenTodos]", error.message);
    return 0;
  }

  const rows = (data ?? []) as OpenRow[];

  /* Cadence lives on the TEMPLATE, so a spawned period has to read its
     parent's — and a parent can sit outside this result set (created by
     someone else, broadcast only from a later period), which is why the
     missing ones are fetched rather than assumed absent. */
  const cadence = new Map<string, string>();
  rows.forEach((r) => { if (r.recurrence) cadence.set(r.id, r.recurrence); });
  const orphans = Array.from(new Set(
    rows.map((r) => r.recurrence_parent_id).filter((p): p is string => !!p && !cadence.has(p)),
  ));
  if (orphans.length > 0) {
    const { data: parents } = await db.from("koleex_todos").select("id, recurrence").in("id", orphans);
    ((parents ?? []) as Array<{ id: string; recurrence: string | null }>)
      .forEach((p) => { if (p.recurrence) cadence.set(p.id, p.recurrence); });
  }

  const cadenceOf = (r: OpenRow) =>
    r.recurrence ?? (r.recurrence_parent_id ? cadence.get(r.recurrence_parent_id) ?? null : null);
  const periodOf = (r: OpenRow) =>
    r.recurrence_spawned_for ?? r.start_date ?? (r.created_at ?? "").slice(0, 10);

  const series = rows.filter((r) => cadenceOf(r));
  if (series.length === 0) return rows.length;

  /* Only asked for when a series is involved — most callers never pay it. */
  const { data: noteRows } = await db
    .from("koleex_todo_notes")
    .select("todo_id")
    .in("todo_id", series.map((r) => r.id));
  const hasNote = new Set(((noteRows ?? []) as Array<{ todo_id: string }>).map((n) => n.todo_id));

  const newestPerSeries = new Map<string, string>();
  for (const r of rows) {
    if (!cadenceOf(r)) continue;
    const key = r.recurrence_parent_id ?? r.id;
    const period = periodOf(r);
    if (period > (newestPerSeries.get(key) ?? "")) newestPerSeries.set(key, period);
  }

  return rows.filter((r) => {
    if (!cadenceOf(r)) return true;
    const key = r.recurrence_parent_id ?? r.id;
    if (periodOf(r) === newestPerSeries.get(key)) return true;
    return (
      r.completed === true ||
      (r.status !== null && r.status !== "todo") ||
      r.approval_state !== null ||
      hasNote.has(r.id)
    );
  }).length;
}
