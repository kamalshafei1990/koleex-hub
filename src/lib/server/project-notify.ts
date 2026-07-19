import "server-only";

/* ---------------------------------------------------------------------------
   project-notify — inbox + web-push notifications for the Projects app.
   Every helper is fire-and-forget safe: failures are logged, never thrown,
   so a notification hiccup can NEVER fail the mutation that triggered it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

interface AuthCtx {
  account_id: string;
  tenant_id: string;
}

interface TaskLike {
  id: string;
  title: string;
  project_id: string | null;
  due_date?: string | null;
  assignee_account_id?: string | null;
}

/** Inbox + push to a freshly-assigned task assignee (skips self-assign). */
export async function notifyTaskAssigned(auth: AuthCtx, task: TaskLike): Promise<void> {
  try {
    const to = task.assignee_account_id;
    if (!to || to === auth.account_id) return;
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: `Task assigned: ${task.title}`,
      body: `You've been assigned a task${task.due_date ? ` due ${task.due_date}` : ""}.`,
      link: "/projects",
      metadata: { source: "projects", type: "project_task_assigned", task_id: task.id, project_id: task.project_id },
    });
    await sendPushToAccounts(
      [to],
      {
        title: "Task assigned",
        body: task.title,
        url: "/projects",
        tag: `ptask:${task.id}`,
        kind: "project_task_assigned",
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[project-notify] assigned:", e);
  }
}

/** Inbox + push to the task's assignee + followers when someone comments. */
export async function notifyTaskComment(
  auth: AuthCtx,
  taskId: string,
  commentBody: string,
): Promise<void> {
  try {
    const { data: task } = await supabaseServer
      .from("project_tasks")
      .select("id, title, project_id, assignee_account_id, followers_account_ids")
      .eq("id", taskId)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (!task) return;
    const recipients = Array.from(
      new Set(
        [task.assignee_account_id, ...((task.followers_account_ids as string[] | null) ?? [])].filter(
          Boolean,
        ) as string[],
      ),
    ).filter((id) => id !== auth.account_id);
    if (recipients.length === 0) return;

    const preview = commentBody.trim().replace(/\s+/g, " ").slice(0, 140);
    await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: auth.account_id,
        tenant_id: auth.tenant_id,
        category: "system",
        subject: `New comment on: ${task.title}`,
        body: preview,
        link: "/projects",
        metadata: { source: "projects", type: "project_task_comment", task_id: task.id, project_id: task.project_id },
      })),
    );
    await sendPushToAccounts(
      recipients,
      {
        title: `Comment on: ${task.title}`,
        body: preview,
        url: "/projects",
        tag: `ptask:${task.id}`,
        kind: "project_task_comment",
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[project-notify] comment:", e);
  }
}
