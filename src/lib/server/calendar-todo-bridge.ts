import "server-only";

/* ---------------------------------------------------------------------------
   calendar-todo-bridge — the To-do a "task" event made (source = "calendar",
   source_id = the event) follows the event: an edit to its title,
   description or date updates it, a delete removes it. The route and the AI
   tools both call these. Best-effort: the event write has already
   succeeded, so a failure here is logged, never thrown.

   The To-do itself is still CREATED by the Calendar's client through
   POST /api/todos (EventModal), so the To-do app's own assignment and
   notification fan-out stays the one code path that creates tasks.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { accountTimezone } from "@/lib/server/calendar-notify";
import { pingTodosChanged } from "@/lib/server/todo-notify";
import { clearUnreadByMetaIn } from "@/lib/server/inbox-lifecycle";
import { zonedDateKey } from "@/lib/calendar-tz";
import type { CalendarEventCore } from "@/lib/server/calendar-access";

/** The To-do rows the Calendar→To-do bridge made from this event. */
async function linkedTodoIds(eventId: string, tenantId: string | null): Promise<string[]> {
  let q = supabaseServer.from("koleex_todos").select("id").eq("source", "calendar").eq("source_id", eventId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

/** Keep the bridged To-do in step with the event. Best-effort: the event is
 *  saved either way. */
export async function syncLinkedTodo(ev: CalendarEventCore): Promise<void> {
  try {
    const ids = await linkedTodoIds(ev.id, ev.tenant_id);
    if (ids.length === 0) return;
    const due = zonedDateKey(ev.start_at, await accountTimezone(ev.account_id));
    const { error } = await supabaseServer
      .from("koleex_todos")
      .update({ title: ev.title, description: ev.description ?? null, due_date: due, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new Error(error.message);
    await pingTodosChanged(ev.tenant_id);
  } catch (e) {
    console.error("[calendar-todo-bridge] sync:", e instanceof Error ? e.message : e);
  }
}

export async function deleteLinkedTodos(eventId: string, tenantId: string | null): Promise<void> {
  try {
    const ids = await linkedTodoIds(eventId, tenantId);
    if (ids.length === 0) return;
    const { error } = await supabaseServer.from("koleex_todos").delete().in("id", ids);
    if (error) throw new Error(error.message);
    // Their notifications go with them — one chunked update, not one per task.
    await clearUnreadByMetaIn({}, "todo_id", ids);
    await pingTodosChanged(tenantId);
  } catch (e) {
    console.error("[calendar-todo-bridge] cleanup:", e instanceof Error ? e.message : e);
  }
}
