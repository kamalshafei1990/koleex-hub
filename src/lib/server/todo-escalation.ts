import "server-only";

/* Overdue escalation — when a DELEGATED task passes its due date and is still
   open, notify the manager who assigned it (not just the assignee), so nothing
   silently rots past deadline. Fires once per due date: a private
   metadata stamp (ESCALATION_MARK) guards against re-nagging every tick, and
   moving the due date drops it (PATCH /api/todos/[id], the AI's updateTodo),
   so a task that slips AGAIN is escalated again. No schema change — the
   marker lives in the existing jsonb metadata. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { prepareTpl } from "@/lib/notification-templates";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { TENANT_UTC_OFFSET_HOURS, tenantDateKey } from "@/lib/todo-series";

/** The metadata key that says "the assigner was already told this is late". */
export const ESCALATION_MARK = "__overdue_escalated_on";

interface Candidate {
  id: string;
  title: string;
  due_date: string | null;
  assigned_by_account_id: string | null;
  tenant_id: string | null;
  metadata: Record<string, unknown> | null;
}

export async function escalateOverdueTodos(now: Date = new Date()): Promise<number> {
  /* Overdue = due strictly before TODAY on the business clock
     (lib/todo-series.ts) — the same day the recurrence engine keys on. */
  const todayKey = tenantDateKey(now);
  const startOfToday = new Date(Date.parse(`${todayKey}T00:00:00.000Z`) - TENANT_UTC_OFFSET_HOURS * 3600_000).toISOString();

  /* The not-yet-escalated filter runs IN THE QUERY. It used to run in JS
     after a `.limit(200)`, so once 200 already-escalated tasks sat overdue
     (they never leave: nobody completes a forgotten task), every new
     overdue task fell outside the window and was never escalated. */
  const { data: rows, error } = await supabaseServer
    .from("koleex_todos")
    .select("id, title, due_date, assigned_by_account_id, tenant_id, metadata")
    .eq("completed", false)
    .not("due_date", "is", null)
    .not("assigned_by_account_id", "is", null)
    .lt("due_date", startOfToday)
    .is(`metadata->>${ESCALATION_MARK}`, null)
    .order("due_date", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[todo-escalation] fetch:", error.message);
    return 0;
  }
  const candidates = (rows ?? []) as Candidate[];
  if (candidates.length === 0) return 0;

  // Batch-load assignees so we can (a) confirm the task is really delegated
  // (an assignee other than the assigner) and (b) name the responsible person.
  const { data: assigneeRows } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id, account_id")
    .in("todo_id", candidates.map((t) => t.id));
  const byTodo = new Map<string, string[]>();
  ((assigneeRows ?? []) as Array<{ todo_id: string; account_id: string }>).forEach((row) => {
    const arr = byTodo.get(row.todo_id) ?? [];
    arr.push(row.account_id);
    byTodo.set(row.todo_id, arr);
  });

  let escalated = 0;
  for (const t of candidates) {
    const assigner = t.assigned_by_account_id!;
    /* Stamp FIRST, conditionally on the stamp still being absent: of two
       overlapping cron runs exactly one wins the row and notifies. A
       personal task (nobody but the manager on it) is stamped too, so it
       stops being re-read every five minutes. */
    const meta = t.metadata && typeof t.metadata === "object" ? t.metadata : {};
    const { data: claimed, error: claimErr } = await supabaseServer
      .from("koleex_todos")
      .update({ metadata: { ...meta, [ESCALATION_MARK]: todayKey } })
      .eq("id", t.id)
      .is(`metadata->>${ESCALATION_MARK}`, null)
      .select("id");
    if (claimErr) {
      console.error("[todo-escalation] claim:", claimErr.message);
      continue;
    }
    if (!claimed || claimed.length === 0) continue;

    // Only escalate genuinely delegated work — at least one assignee who isn't
    // the manager themselves. (A personal to-do has no one to escalate to.)
    const assignees = byTodo.get(t.id) ?? [];
    if (!assignees.some((a) => a !== assigner)) continue;

    const text = prepareTpl({ k: "todo_overdue", p: { title: t.title } });
    const { error: insErr } = await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: assigner,
      sender_account_id: null,
      tenant_id: t.tenant_id,
      category: "task",
      subject: text.subject,
      body: text.body,
      link: `/todo?task=${t.id}`,
      metadata: { type: "todo_overdue", todo_id: t.id, ...(text.tpl ? { tpl: text.tpl } : {}) },
    });
    if (insErr) console.error("[todo-escalation] inbox:", insErr.message);
    await emitPings([{ topic: rtTopic.inbox(assigner) }]);
    await sendPushToAccounts([assigner], {
      title: text.subject,
      body: text.body ?? t.title,
      url: `/todo?task=${t.id}`,
      tag: `todo-overdue-${t.id}`,
      kind: "todo_overdue",
      tpl: text.tpl,
    }).catch((e) => console.error("[todo-escalation] push:", e));
    escalated += 1;
  }

  return escalated;
}
