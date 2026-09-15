import "server-only";

/* ---------------------------------------------------------------------------
   The morning brief, assembled on the server (tasks phase 5, 2026-09-13;
   TASKS_BY_AI_PLAN §4, dependability plan F3).

   The same items the chat's brief reads — today's meetings, tasks due today
   or overdue, reminders ringing today — counted and worded here without a
   model, so a notification can carry them at the hour the user chose. The
   notification opens the chat with ?ask=brief, where the model gives the
   full brief from the same tools. Only the user's own items, through the
   same scope the To-do app uses (lib/server/todo-scope.ts).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { expandRecurrence, type CalendarRec } from "@/lib/calendar-recurrence";
import { dayRangeISO } from "@/lib/server/ai-agent/tools/task-draft";

export { briefText, hourIn, dayIn, type BriefLang, type BriefCounts } from "@/lib/server/ai/brief-text";
import { type BriefCounts } from "@/lib/server/ai/brief-text";

function clock(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Today's counts for one person, read through the app's own scope. */
export async function buildBriefCounts(viewer: TodoViewer, tz: string, now: Date = new Date()): Promise<BriefCounts> {
  const { startOfToday, endOfToday } = dayRangeISO(tz, now);
  const startMs = Date.parse(startOfToday);
  const endMs = Date.parse(endOfToday);

  /* MEETINGS: the person's own calendar, one-off events starting today and
     recurring ones with an occurrence today. */
  let evQ = supabaseServer
    .from("koleex_calendar_events")
    .select("id, title, start_at, end_at, recurrence, recurrence_until")
    .eq("account_id", viewer.accountId);
  if (viewer.tenantId) evQ = evQ.eq("tenant_id", viewer.tenantId);
  const { data: events } = await evQ.or(`recurrence.not.is.null,and(start_at.gte.${startOfToday},start_at.lte.${endOfToday})`).limit(200);
  const todays: Array<{ title: string; at: number }> = [];
  for (const e of (events ?? []) as Array<{ title: string | null; start_at: string; end_at: string | null; recurrence: CalendarRec; recurrence_until: string | null }>) {
    if (e.recurrence) {
      const occ = expandRecurrence(e.start_at, e.end_at ?? e.start_at, e.recurrence, e.recurrence_until, new Date(startMs), new Date(endMs + 1));
      for (const o of occ) todays.push({ title: e.title ?? "", at: o.start.getTime() });
    } else {
      const at = Date.parse(e.start_at);
      if (at >= startMs && at <= endMs) todays.push({ title: e.title ?? "", at });
    }
  }
  todays.sort((a, b) => a.at - b.at);

  /* TASKS: the same scope as the To-do app and the AI's listMyTodos. */
  let tq = supabaseServer.from("koleex_todos").select("id, title, due_date, remind_at").eq("completed", false);
  if (viewer.tenantId) tq = tq.eq("tenant_id", viewer.tenantId);
  tq = applyTodoScope(tq, viewer, await sharedTodoIds(viewer));
  const { data: todos } = await tq.limit(500);
  let dueToday = 0, overdue = 0, reminders = 0;
  const nowMs = now.getTime();
  for (const t of (todos ?? []) as Array<{ due_date: string | null; remind_at: string | null }>) {
    if (t.due_date) {
      const d = Date.parse(t.due_date);
      if (d >= startMs && d <= endMs) dueToday++;
      else if (d < nowMs) overdue++;
    }
    if (t.remind_at) {
      const r = Date.parse(t.remind_at);
      if (r >= startMs && r <= endMs) reminders++;
    }
  }
  const first = todays.length && todays[0].at >= nowMs - 60_000 ? `${clock(new Date(todays[0].at).toISOString(), tz)} ${todays[0].title}`.trim() : "";
  return { meetings: todays.length, dueToday, overdue, reminders, first };
}

