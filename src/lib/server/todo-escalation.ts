import "server-only";

/* Overdue escalation — when a DELEGATED task passes its due date and is still
   open, notify the manager who assigned it (not just the assignee), so nothing
   silently rots past deadline. Fires once per task (a private
   metadata.__overdue_escalated_on stamp guards against re-nagging every tick).
   No schema change — the marker lives in the existing jsonb metadata. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

interface Candidate {
  id: string;
  title: string;
  due_date: string | null;
  assigned_by_account_id: string | null;
  metadata: Record<string, unknown> | null;
}

export async function escalateOverdueTodos(now: Date = new Date()): Promise<number> {
  // Start of today (UTC) — a task is overdue once its due date is strictly
  // before today.
  const todayKey = now.toISOString().slice(0, 10);
  const startOfTodayIso = new Date(`${todayKey}T00:00:00.000Z`).toISOString();

  const { data: rows, error } = await supabaseServer
    .from("koleex_todos")
    .select("id, title, due_date, assigned_by_account_id, metadata")
    .eq("completed", false)
    .not("due_date", "is", null)
    .not("assigned_by_account_id", "is", null)
    .lt("due_date", startOfTodayIso)
    .limit(200);

  if (error) {
    console.error("[todo-escalation] fetch:", error.message);
    return 0;
  }

  // Skip tasks we've already escalated (marker present).
  const candidates = ((rows ?? []) as Candidate[]).filter((t) => {
    const m = t.metadata && typeof t.metadata === "object" ? t.metadata : {};
    return !m["__overdue_escalated_on"];
  });
  if (candidates.length === 0) return 0;

  // Batch-load assignees so we can (a) confirm the task is really delegated
  // (an assignee other than the assigner) and (b) name the responsible person.
  const ids = candidates.map((t) => t.id);
  const { data: assigneeRows } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id, account_id")
    .in("todo_id", ids);
  const byTodo = new Map<string, string[]>();
  (assigneeRows ?? []).forEach((r) => {
    const row = r as { todo_id: string; account_id: string };
    const arr = byTodo.get(row.todo_id) ?? [];
    arr.push(row.account_id);
    byTodo.set(row.todo_id, arr);
  });

  let escalated = 0;
  for (const t of candidates) {
    const assigner = t.assigned_by_account_id!;
    const assignees = byTodo.get(t.id) ?? [];
    // Only escalate genuinely delegated work — at least one assignee who isn't
    // the manager themselves. (A personal to-do has no one to escalate to.)
    const delegated = assignees.some((a) => a !== assigner);
    if (!delegated) continue;

    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: assigner,
      sender_account_id: null,
      category: "task",
      subject: `⚠️ Overdue: ${t.title}`,
      body: "A task you assigned is past its due date and still open.",
      link: `/todo?task=${t.id}`,
      metadata: { type: "todo_overdue", todo_id: t.id },
    });
    await sendPushToAccounts([assigner], {
      title: `⚠️ Overdue: ${t.title}`,
      body: "A task you assigned is past its due date.",
      url: `/todo?task=${t.id}`,
      tag: `todo-overdue-${t.id}`,
    }).catch((e) => console.error("[todo-escalation] push:", e));

    // Stamp so we don't re-nag on every cron tick.
    const nextMeta = { ...(t.metadata && typeof t.metadata === "object" ? t.metadata : {}), __overdue_escalated_on: todayKey };
    await supabaseServer.from("koleex_todos").update({ metadata: nextMeta }).eq("id", t.id);
    escalated += 1;
  }

  return escalated;
}
