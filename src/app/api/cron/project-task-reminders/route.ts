import "server-only";

/* GET /api/cron/project-task-reminders — daily (09:00 Asia/Shanghai).
   Reminds each assignee about open project tasks due today or overdue
   (up to 3 days back) via inbox + web-push. Dedupe: at most one reminder
   per task per day, checked against today's inbox rows by metadata, so
   no schema change is needed. Protected by the CRON_SECRET bearer. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

interface DueTask {
  id: string;
  tenant_id: string;
  title: string;
  due_date: string;
  project_id: string | null;
  assignee_account_id: string;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
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
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const t of (data ?? []) as DueTask[]) {
    // One reminder per task per day.
    const { data: existing } = await supabaseServer
      .from("inbox_messages")
      .select("id")
      .eq("recipient_account_id", t.assignee_account_id)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .contains("metadata", { type: "project_task_due", task_id: t.id })
      .limit(1);
    if (existing && existing.length > 0) continue;

    const overdue = t.due_date < today;
    const subject = overdue ? `Task overdue: ${t.title}` : `Task due today: ${t.title}`;
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: t.assignee_account_id,
      sender_account_id: null,
      tenant_id: t.tenant_id,
      category: "system",
      subject,
      body: overdue ? `Due ${t.due_date} — still open.` : "Due today.",
      link: "/projects",
      metadata: { source: "projects", type: "project_task_due", task_id: t.id, project_id: t.project_id, due_date: t.due_date },
    });
    try {
      await sendPushToAccounts([t.assignee_account_id], {
        title: subject,
        body: overdue ? `Due ${t.due_date} — still open.` : "Due today.",
        url: "/projects",
        tag: `ptask-due:${t.id}`,
        kind: "project_task_due",
      });
    } catch (e) {
      console.error("[cron/project-task-reminders] push:", e);
    }
    sent += 1;
  }

  return NextResponse.json({ ok: true, scanned: data?.length ?? 0, sent });
}
