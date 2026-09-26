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
import { prepareTpl, type NotifTpl } from "@/lib/notification-templates";
import { dmyDate } from "@/lib/work-reports";

export interface TodoLike {
  id: string;
  title: string | null;
  description?: string | null;
  priority?: string | null;
  due_date?: string | null;
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
  /** What was said — rendered in each reader's language (notification-templates). */
  tpl: NotifTpl;
  /** The stored body when the template has none: the task's own words. */
  body?: string;
  type: string;
  extra?: Record<string, unknown>;
  pushTitle?: string;
  tag?: string;
}): Promise<void> {
  const to = Array.from(new Set(opts.recipients.filter(Boolean))).filter((id) => id !== opts.actorId);
  if (to.length === 0) return;
  const text = prepareTpl(opts.tpl);
  const body = text.body ?? opts.body ?? "";
  try {
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient_account_id) => ({
        recipient_account_id,
        sender_account_id: opts.actorId,
        tenant_id: opts.todo.tenant_id ?? null,
        category: "task",
        subject: text.subject,
        body,
        link: link(opts.todo.id),
        metadata: { type: opts.type, todo_id: opts.todo.id, ...(opts.extra ?? {}), ...(text.tpl ? { tpl: text.tpl } : {}) },
      })),
    );
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: opts.pushTitle ?? text.subject,
        body,
        url: link(opts.todo.id),
        tag: opts.tag ?? `todo-${opts.todo.id}`,
        kind: opts.type,
        tpl: text.tpl,
      },
      { actorAccountId: opts.actorId },
    );
  } catch (e) {
    console.error(`[todo-notify] ${opts.type}:`, e instanceof Error ? e.message : e);
  }
}

/** The first line of a description, cut to ~120 characters — enough to
 *  say what the task is about in a notification without the whole text. */
function firstLine(text: string | null | undefined, max = 120): string | undefined {
  const line = (text ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

interface AssignmentContext { by?: string; dueDay?: string; desc?: string }

/** What an employee needs to act on a notification without opening it:
 *  WHO handed it over, WHEN it is due (D/M/Y) and WHAT it is about. The
 *  actor's display name and the stored due date are read here, so no
 *  caller has to pass them. Never throws — a missing piece is left out. */
async function assignmentContext(todo: TodoLike, actorId: string | null): Promise<AssignmentContext> {
  let due = todo.due_date;
  let by: string | undefined;
  try {
    const [task, acc] = await Promise.all([
      due === undefined
        ? supabaseServer.from("koleex_todos").select("due_date").eq("id", todo.id).maybeSingle()
        : Promise.resolve({ data: null }),
      actorId
        ? supabaseServer.from("accounts").select("username, person_id").eq("id", actorId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (due === undefined) due = (task.data as { due_date: string | null } | null)?.due_date ?? null;
    const a = acc.data as { username: string | null; person_id: string | null } | null;
    if (a?.person_id) {
      const { data: p } = await supabaseServer.from("people").select("full_name").eq("id", a.person_id).maybeSingle();
      by = (p as { full_name: string | null } | null)?.full_name || undefined;
    }
    by ??= a?.username || undefined;
  } catch { /* the notification still goes, with less in it */ }
  return {
    by,
    /* A date the form wrote is stored as midnight UTC: read it as that day. */
    dueDay: due ? (/T00:00(:00(\.0+)?)?(Z|[+-]00(:?00)?)$/.test(due) ? due.slice(0, 10) : due) : undefined,
    desc: firstLine(todo.description),
  };
}

/** "New task: …" to freshly assigned people (never the actor) — the body
 *  says who assigned it, when it is due and what it is about. */
export async function notifyTodoAssigned(todo: TodoLike, recipients: string[], actorId: string | null): Promise<void> {
  const to = recipients.filter((id) => id && id !== actorId);
  if (to.length === 0) return;
  const title = todo.title ?? "Task";
  const ctx = await assignmentContext(todo, actorId);
  await deliver({
    todo, recipients: to, actorId,
    tpl: ctx.by
      ? { k: "todo_assignment", p: { title, by: ctx.by, due: ctx.dueDay ? dmyDate(ctx.dueDay) : undefined, desc: ctx.desc } }
      : { k: "todo_assignment.system", p: { title, due: ctx.dueDay ? dmyDate(ctx.dueDay) : undefined, desc: ctx.desc } },
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
  const to = recipients.filter((id) => id && id !== actorId);
  if (to.length === 0) return;
  const title = todo.title ?? "Task";
  const ctx: AssignmentContext = kind === "mention" ? await assignmentContext(todo, actorId) : {};
  await deliver({
    todo, recipients: to, actorId,
    tpl: kind === "observer"
      ? { k: "todo_observer", p: { title } }
      : ctx.by
        ? { k: "todo_mention", p: { title, by: ctx.by, due: ctx.dueDay ? dmyDate(ctx.dueDay) : undefined, desc: ctx.desc } }
        : { k: "todo_mention.plain", p: { title } },
    body: todo.description || undefined,
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
    tpl: { k: "todo_approval_request", p: { title } },
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
    tpl: approved
      ? { k: "todo_approval_decision.approved", p: { title } }
      : reason
        ? { k: "todo_approval_decision.returned", p: { title, reason } }
        : { k: "todo_approval_decision.reopened", p: { title } },
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
