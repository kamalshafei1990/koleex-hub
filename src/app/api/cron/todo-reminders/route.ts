import "server-only";

/* GET /api/cron/todo-reminders
   Fires task reminders whose remind_at has passed. Protected by the same
   CRON_SECRET bearer Vercel attaches to cron invocations (skipped when unset so
   it can be run by hand in dev). Each due task notifies its assignees + creator
   via the inbox AND web-push (reusing the hub's tested push pipeline), then
   stamps reminded_at so it never double-fires. Completed tasks are ignored. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

interface DueTodo {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  created_by_account_id: string | null;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const nowIso = new Date().toISOString();

  // Due = remind_at reached, task still open, and not already reminded for THIS
  // remind_at value (so rescheduling a reminder re-arms it).
  const { data: rows, error } = await supabaseServer
    .from("koleex_todos")
    .select("id, title, description, remind_at, created_by_account_id")
    .lte("remind_at", nowIso)
    .eq("completed", false)
    .or(`reminded_at.is.null,reminded_at.lt.remind_at`)
    .limit(200);

  if (error) {
    console.error("[cron/todo-reminders]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const due = (rows ?? []) as DueTodo[];
  if (due.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  const ids = due.map((t) => t.id);

  // Resolve assignees for all due tasks in one round-trip.
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

  let fired = 0;
  for (const t of due) {
    const recipients = Array.from(
      new Set([...(byTodo.get(t.id) ?? []), t.created_by_account_id].filter(Boolean) as string[]),
    );
    if (recipients.length > 0) {
      await supabaseServer.from("inbox_messages").insert(
        recipients.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: null,
          category: "task",
          subject: `⏰ Reminder: ${t.title}`,
          body: t.description || t.title,
          link: `/todo?task=${t.id}`,
          metadata: { type: "todo_reminder", todo_id: t.id },
        })),
      );
      await sendPushToAccounts(recipients, {
        title: `⏰ Reminder: ${t.title}`,
        body: t.description || "Task reminder",
        url: `/todo?task=${t.id}`,
        tag: `todo-reminder-${t.id}`,
      }).catch((e) => console.error("[cron/todo-reminders] push:", e));
    }
    // Stamp regardless so a task with no recipients doesn't loop forever.
    await supabaseServer.from("koleex_todos").update({ reminded_at: nowIso }).eq("id", t.id);
    fired += 1;
  }

  return NextResponse.json({ ok: true, fired });
}
