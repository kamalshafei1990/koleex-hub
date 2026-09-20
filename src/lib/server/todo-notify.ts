import "server-only";

/* ---------------------------------------------------------------------------
   todo-notify — every notification the To-do app sends, in one place.

   Assignment ("New task"), mention, observer, "submitted for approval",
   the approval decision, and "this task is finished, close its rows" were
   each written by hand in the create route, the PATCH route, the toggle
   route, the HR lifecycle and the AI agent's tools — five copies of the
   assignment fan-out alone, and each copy forgot something different: no
   push `kind` (so the Settings switch could not mute it), no realtime ping
   (so the bell waited for the poll), no tenant on the row, or no clearing
   when the task closed. One helper per event; every caller.

   Realtime: every task write also pings the tenant's `todos` topic so open
   /todo screens refetch. The page used to hold an anon postgres_changes
   subscription on koleex_todos — a table locked to the service role, so it
   never received a row.

   Fire-and-forget safe: a notification hiccup never fails the mutation.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";

export interface TodoLike {
  id: string;
  title: string | null;
  description?: string | null;
  priority?: string | null;
  tenant_id?: string | null;
}

const link = (id: string) => `/todo?task=${id}`;

/** Tell the tenant's open To-do screens that something changed. */
export async function pingTodosChanged(tenantId: string | null | undefined): Promise<void> {
  if (!tenantId) return;
  await emitPings([{ topic: rtTopic.todos(tenantId) }]);
}

async function deliver(opts: {
  todo: TodoLike;
  recipients: string[];
  actorId: string | null;
  subject: string;
  body: string;
  type: string;
  extra?: Record<string, unknown>;
  pushTitle?: string;
  tag?: string;
}): Promise<void> {
  const to = Array.from(new Set(opts.recipients.filter(Boolean))).filter((id) => id !== opts.actorId);
  if (to.length === 0) return;
  try {
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient_account_id) => ({
        recipient_account_id,
        sender_account_id: opts.actorId,
        tenant_id: opts.todo.tenant_id ?? null,
        category: "task",
        subject: opts.subject,
        body: opts.body,
        link: link(opts.todo.id),
        metadata: { type: opts.type, todo_id: opts.todo.id, ...(opts.extra ?? {}) },
      })),
    );
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: opts.pushTitle ?? opts.subject,
        body: opts.body,
        url: link(opts.todo.id),
        tag: opts.tag ?? `todo-${opts.todo.id}`,
        kind: opts.type,
      },
      { actorAccountId: opts.actorId },
    );
  } catch (e) {
    console.error(`[todo-notify] ${opts.type}:`, e instanceof Error ? e.message : e);
  }
}

/** "New task: …" to freshly assigned people (never the actor). */
export async function notifyTodoAssigned(todo: TodoLike, recipients: string[], actorId: string | null): Promise<void> {
  const title = todo.title ?? "Task";
  await deliver({
    todo, recipients, actorId,
    subject: `New task: ${title}`,
    body: todo.description || title,
    type: "todo_assignment",
    extra: { priority: todo.priority ?? "medium" },
  });
}

/** "You were mentioned" / "You are now an observer" to people newly named
 *  in metadata.mentions / metadata.observers. */
export async function notifyTodoPeopleAdded(
  todo: TodoLike,
  kind: "mention" | "observer",
  recipients: string[],
  actorId: string | null,
): Promise<void> {
  const title = todo.title ?? "Task";
  await deliver({
    todo, recipients, actorId,
    subject: kind === "mention" ? `You were mentioned: ${title}` : `You are now an observer: ${title}`,
    body: kind === "mention"
      ? (todo.description || "You were mentioned on a task.")
      : "You were added as an observer — you can follow this task and update its situation.",
    type: `todo_${kind}`,
  });
}

/** A participant submitted the task as done → the assigner confirms. No-op
 *  when the task has no assigner or the actor IS the assigner. */
export async function notifySubmittedForApproval(
  t: TodoLike & { assigned_by_account_id: string | null },
  actorId: string,
): Promise<void> {
  const assigner = t.assigned_by_account_id;
  if (!assigner || assigner === actorId) return;
  const title = t.title ?? "Task";
  await deliver({
    todo: t, recipients: [assigner], actorId,
    subject: `Awaiting your approval: ${title}`,
    body: `The task "${title}" was submitted as done and needs your confirmation.`,
    type: "todo_approval_request",
    pushTitle: "Task awaiting your approval",
    tag: `todo-approval-${t.id}`,
  });
}

/** The assigner confirmed (done) or sent the task back → the assignees hear. */
export async function notifyApprovalDecision(
  t: TodoLike,
  actorId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<void> {
  const { data: rows } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("account_id")
    .eq("todo_id", t.id);
  const recipients = ((rows ?? []) as Array<{ account_id: string }>).map((r) => r.account_id);
  const title = t.title ?? "Task";
  const approved = decision === "approved";
  await deliver({
    todo: t, recipients, actorId,
    subject: approved ? `Task confirmed done: ${title}` : `Task reopened: ${title}`,
    body: approved
      ? `Your submission for "${title}" was confirmed. The task is done.`
      : reason
        ? `"${title}" was sent back: ${reason}`
        : `"${title}" was reopened — it is not fully done yet.`,
    type: "todo_approval_decision",
    extra: { decision, reason: reason || undefined },
    pushTitle: approved ? "Task confirmed done" : "Task sent back for rework",
    tag: `todo-approval-${t.id}`,
  });
}

/** The task is finished or gone: every unread row that points at it —
 *  assignment, mention, reminder, recurring spawn, approval — is finished
 *  business for every recipient. Read + archived, through the one lifecycle
 *  helper; this used to be four hand-rolled updates that each cleared a
 *  different subset. */
export async function clearTodoNotifications(todoId: string): Promise<void> {
  await clearUnreadByMeta({ todo_id: todoId });
}
