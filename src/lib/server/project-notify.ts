import "server-only";
import { dmyDate } from "@/lib/work-reports";

/* ---------------------------------------------------------------------------
   project-notify — inbox + web-push notifications for the Projects app.
   Every helper is fire-and-forget safe: failures are logged, never thrown,
   so a notification hiccup can NEVER fail the mutation that triggered it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";
import { prepareTpl } from "@/lib/notification-templates";

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

/** Deep link that opens the project board with the task's modal. */
function taskLink(task: { id: string; project_id: string | null }): string {
  return task.project_id ? `/projects?project=${task.project_id}&task=${task.id}` : "/projects";
}

/** Inbox + push to a freshly-assigned task assignee (skips self-assign). */
export async function notifyTaskAssigned(auth: AuthCtx, task: TaskLike): Promise<void> {
  try {
    const to = task.assignee_account_id;
    if (!to || to === auth.account_id) return;
    const text = prepareTpl({
      k: "project_task_assigned",
      p: { title: task.title, due: task.due_date ? dmyDate(task.due_date) : null },
    });
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: to,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: text.subject,
      body: text.body,
      link: taskLink(task),
      metadata: {
        source: "projects", type: "project_task_assigned", task_id: task.id, project_id: task.project_id,
        ...(text.tpl ? { tpl: text.tpl } : {}),
      },
    });
    await emitPings([{ topic: rtTopic.inbox(to) }]);
    await sendPushToAccounts(
      [to],
      {
        title: "Task assigned",
        body: task.title,
        url: taskLink(task),
        tag: `ptask:${task.id}`,
        kind: "project_task_assigned",
        tpl: text.tpl,
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
    /* The body is the comment itself — a person's words, stored as is. */
    const text = prepareTpl({ k: "project_task_comment", p: { title: task.title as string } });
    await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: auth.account_id,
        tenant_id: auth.tenant_id,
        category: "system",
        subject: text.subject,
        body: text.body ?? preview,
        link: taskLink({ id: task.id as string, project_id: task.project_id as string | null }),
        metadata: {
          source: "projects", type: "project_task_comment", task_id: task.id, project_id: task.project_id,
          ...(text.tpl ? { tpl: text.tpl } : {}),
        },
      })),
    );
    await emitPings(recipients.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      recipients,
      {
        title: `Comment on: ${task.title}`,
        body: preview,
        url: taskLink({ id: task.id as string, project_id: task.project_id as string | null }),
        tag: `ptask:${task.id}`,
        kind: "project_task_comment",
        tpl: text.tpl,
      },
      { actorAccountId: auth.account_id },
    );
  } catch (e) {
    console.error("[project-notify] comment:", e);
  }
}

/** The task reached "done": every unread row that pointed at it (assignment,
 *  comments, the cron's due reminder) is finished business for all its
 *  recipients. The to-do app has had this clearer since the 2026-08-21 audit;
 *  project tasks accumulated exactly the pile it was written to stop. */
export async function clearTaskNotifications(taskId: string): Promise<void> {
  await clearUnreadByMeta({ task_id: taskId });
}
