import "server-only";

/* GET /api/cron/project-task-reminders — daily (09:00 Asia/Shanghai).
   Reminds each assignee about open project tasks due today or overdue
   (up to 3 days back) via inbox + web-push. Dedupe: at most one reminder
   per task per day, checked against today's inbox rows by metadata, so
   no schema change is needed.

   FAIL-CLOSED: without CRON_SECRET configured this route refuses every
   call (401). The other crons skip the check when the secret is unset,
   which leaves them open to anyone who finds the URL — this one sends
   inbox rows and pushes to real people, so it does not.

   Batched: one read of candidate tasks (ordered, capped), ONE query for
   today's already-sent reminders, ONE supersede update, ONE inbox insert —
   instead of 3–4 queries per task in a loop. Pushes still go per task
   (each has its own payload) but concurrently. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

export const dynamic = "force-dynamic";

interface DueTask {
  id: string;
  tenant_id: string;
  title: string;
  due_date: string;
  project_id: string | null;
  assignee_account_id: string;
}

const taskLink = (t: DueTask) =>
  t.project_id ? `/projects?project=${t.project_id}&task=${t.id}` : "/projects";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const floor = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .select("id, tenant_id, title, due_date, project_id, assignee_account_id")
    .eq("status", "open")
    .not("assignee_account_id", "is", null)
    .lte("due_date", today)
    .gte("due_date", floor)
    .order("due_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  if (error) {
    console.error("[cron/project-task-reminders] load:", error.message);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
  const tasks = (data ?? []) as DueTask[];
  if (tasks.length === 0) return NextResponse.json({ ok: true, scanned: 0, sent: 0 });

  // One reminder per task per day — one lookup for the whole batch.
  const { data: existing } = await supabaseServer
    .from("inbox_messages")
    .select("metadata")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .eq("metadata->>type", "project_task_due")
    .in("metadata->>task_id", tasks.map((t) => t.id));
  const alreadySent = new Set(
    (existing ?? []).map((r) => ((r as { metadata: { task_id?: string } | null }).metadata?.task_id ?? "")),
  );
  const toSend = tasks.filter((t) => !alreadySent.has(t.id));
  if (toSend.length === 0) return NextResponse.json({ ok: true, scanned: tasks.length, sent: 0 });

  const recipients = [...new Set(toSend.map((t) => t.assignee_account_id))];

  /* The same-day guard above stops double-writes WITHIN a day; this stops
     stacking ACROSS days — yesterday's unread "due today" is superseded by
     today's "overdue" for the same task. (Same semantics as
     inbox-lifecycle.supersedeUnread, applied to the whole batch at once.) */
  const nowIso = new Date().toISOString();
  const { error: supErr } = await supabaseServer
    .from("inbox_messages")
    .update({ read_at: nowIso, archived_at: nowIso })
    .in("recipient_account_id", recipients)
    .is("read_at", null)
    .eq("metadata->>type", "project_task_due")
    .in("metadata->>task_id", toSend.map((t) => t.id));
  if (supErr) console.error("[cron/project-task-reminders] supersede:", supErr.message);

  const rows = toSend.map((t) => {
    const overdue = t.due_date < today;
    return {
      recipient_account_id: t.assignee_account_id,
      sender_account_id: null,
      tenant_id: t.tenant_id,
      category: "system",
      subject: overdue ? `Task overdue: ${t.title}` : `Task due today: ${t.title}`,
      body: overdue ? `Due ${t.due_date} — still open.` : "Due today.",
      link: taskLink(t),
      metadata: { source: "projects", type: "project_task_due", task_id: t.id, project_id: t.project_id, due_date: t.due_date },
    };
  });
  const { error: insErr } = await supabaseServer.from("inbox_messages").insert(rows);
  if (insErr) {
    console.error("[cron/project-task-reminders] insert:", insErr.message);
    return NextResponse.json({ error: "Failed to write reminders" }, { status: 500 });
  }
  try {
    await emitPings(recipients.map((id) => ({ topic: rtTopic.inbox(id) })));
  } catch (e) {
    console.error("[cron/project-task-reminders] ping:", e);
  }

  await Promise.allSettled(
    toSend.map((t, i) =>
      sendPushToAccounts([t.assignee_account_id], {
        title: rows[i].subject,
        body: rows[i].body,
        url: taskLink(t),
        tag: `ptask-due:${t.id}`,
        kind: "project_task_due",
      }).catch((e) => console.error("[cron/project-task-reminders] push:", e)),
    ),
  );

  return NextResponse.json({ ok: true, scanned: tasks.length, sent: toSend.length });
}
