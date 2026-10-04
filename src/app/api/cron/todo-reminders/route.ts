import "server-only";

/* GET /api/cron/todo-reminders — every 5 minutes (vercel.json).
   Three jobs, one tick:
     1. roll recurring templates into their new period (todo-recurrence.ts);
     2. escalate overdue delegated tasks to their assigner (todo-escalation.ts);
     3. fire task reminders whose remind_at has passed: each due task notifies
        its assignees + creator via the inbox AND web-push, once per remind_at.

   Guarded by CRON_SECRET, and CLOSED when it is unset (like
   calendar-reminders / project-task-reminders): this route sends
   notifications to real people and must never be callable anonymously.

   Idempotent under overlap: a reminder is CLAIMED (reminded_at stamped,
   conditionally on the value it was read with) before anything is sent, so
   two overlapping ticks cannot both notify. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { prepareTpl } from "@/lib/notification-templates";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { spawnDueRecurringTodos } from "@/lib/server/todo-recurrence";
import { escalateOverdueTodos } from "@/lib/server/todo-escalation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DueTodo {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  reminded_at: string | null;
  created_by_account_id: string | null;
  tenant_id: string | null;
}

const COLS = "id, title, description, remind_at, reminded_at, created_by_account_id, tenant_id";
/* A reminder RESCHEDULED after it fired (reminded_at set, then remind_at
   moved later) is due again once the new time passes. The cron runs every
   five minutes, so such a reminder is found within a day of its time; older
   ones are history, not something to ring now. */
const RESCHEDULED_LOOKBACK_MS = 24 * 3600_000;
const BATCH = 200;
const CONCURRENCY = 8;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  /* 1 first (the purge it runs deletes dead periods the other two would
     otherwise read), then 2 and 3 side by side — they touch different rows'
     different columns. Each is best-effort: one failing never stops the
     others. */
  let spawned = 0;
  try {
    spawned = await spawnDueRecurringTodos(now);
  } catch (e) {
    console.error("[cron/todo-reminders] recurrence:", e);
  }
  const [escalatedRes, firedRes] = await Promise.allSettled([
    escalateOverdueTodos(now),
    fireDueReminders(nowIso),
  ]);
  if (escalatedRes.status === "rejected") console.error("[cron/todo-reminders] escalation:", escalatedRes.reason);
  if (firedRes.status === "rejected") console.error("[cron/todo-reminders] reminders:", firedRes.reason);

  return NextResponse.json({
    ok: firedRes.status === "fulfilled",
    fired: firedRes.status === "fulfilled" ? firedRes.value : 0,
    spawned,
    escalated: escalatedRes.status === "fulfilled" ? escalatedRes.value : 0,
  });
}

async function fireDueReminders(nowIso: string): Promise<number> {
  /* WHAT IS DUE, asked in the query. This used to read `remind_at <= now`
     capped at 200 and filter "not yet reminded" in JS — but a reminded task
     that is never completed keeps matching forever, so once 200 of them
     existed the window was full of spent reminders and NEW ones never rang.
     PostgREST cannot compare two columns, so it is two exact questions:
       · never reminded, time reached;
       · reminded before, rescheduled, new time reached (recent only). */
  const since = new Date(Date.parse(nowIso) - RESCHEDULED_LOOKBACK_MS).toISOString();
  const [fresh, rescheduled] = await Promise.all([
    supabaseServer
      .from("koleex_todos")
      .select(COLS)
      .eq("completed", false)
      .lte("remind_at", nowIso)
      .is("reminded_at", null)
      .order("remind_at", { ascending: true })
      .limit(BATCH),
    supabaseServer
      .from("koleex_todos")
      .select(COLS)
      .eq("completed", false)
      .lte("remind_at", nowIso)
      .gte("remind_at", since)
      .not("reminded_at", "is", null)
      .order("remind_at", { ascending: true })
      .limit(BATCH),
  ]);
  if (fresh.error) throw new Error(fresh.error.message);
  if (rescheduled.error) throw new Error(rescheduled.error.message);
  const due = [
    ...((fresh.data ?? []) as DueTodo[]),
    ...((rescheduled.data ?? []) as DueTodo[]).filter((t) => t.reminded_at! < t.remind_at),
  ];
  if (due.length === 0) return 0;

  // Resolve assignees for all due tasks in one round-trip.
  const { data: assigneeRows } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id, account_id")
    .in("todo_id", due.map((t) => t.id));
  const byTodo = new Map<string, string[]>();
  ((assigneeRows ?? []) as Array<{ todo_id: string; account_id: string }>).forEach((row) => {
    const arr = byTodo.get(row.todo_id) ?? [];
    arr.push(row.account_id);
    byTodo.set(row.todo_id, arr);
  });

  let fired = 0;
  const fireOne = async (t: DueTodo) => {
    /* CLAIM: stamp reminded_at only if it still holds what we read. A
       concurrent tick — or an edit that just moved the reminder — makes
       this match nothing, and this run sends nothing for the task. Stamped
       even with no recipients, so such a task stops matching. */
    let claim = supabaseServer
      .from("koleex_todos")
      .update({ reminded_at: nowIso })
      .eq("id", t.id)
      .eq("remind_at", t.remind_at);
    claim = t.reminded_at === null ? claim.is("reminded_at", null) : claim.eq("reminded_at", t.reminded_at);
    const { data: claimed, error } = await claim.select("id");
    if (error) {
      console.error("[cron/todo-reminders] claim:", error.message);
      return;
    }
    if (!claimed || claimed.length === 0) return;

    const recipients = Array.from(
      new Set([...(byTodo.get(t.id) ?? []), t.created_by_account_id].filter(Boolean) as string[]),
    );
    if (recipients.length > 0) {
      /* Supersede an unread copy of the SAME task's reminder before writing
         this one: reminders inform, they must not accumulate. */
      await supersedeUnread({ recipients, category: "task", meta: { todo_id: t.id, type: "todo_reminder" } });
      const text = prepareTpl({ k: "todo_reminder", p: { title: t.title } });
      const { error: insErr } = await supabaseServer.from("inbox_messages").insert(
        recipients.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: null,
          tenant_id: t.tenant_id,
          category: "task",
          subject: text.subject,
          body: t.description || t.title,
          link: `/todo?task=${t.id}`,
          metadata: { type: "todo_reminder", todo_id: t.id, ...(text.tpl ? { tpl: text.tpl } : {}) },
        })),
      );
      if (insErr) console.error("[cron/todo-reminders] inbox:", insErr.message);
      await emitPings(recipients.map((rid) => ({ topic: rtTopic.inbox(rid) })));
      await sendPushToAccounts(recipients, {
        title: text.subject,
        body: t.description || t.title,
        url: `/todo?task=${t.id}`,
        tag: `todo-reminder-${t.id}`,
        kind: "todo_reminder",
        tpl: text.tpl,
      }).catch((e) => console.error("[cron/todo-reminders] push:", e));
    }
    fired += 1;
  };

  /* A few at a time: each reminder is five small writes and a push, and a
     morning with 200 due used to run them strictly one after another. */
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(fireOne));
  }
  return fired;
}
