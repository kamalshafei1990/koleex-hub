import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { sendPushToAccounts } from "@/lib/server/web-push";

/* PATCH /api/todos/[id] — update fields + optionally re-sync assignees.
   DELETE /api/todos/[id] — remove the todo + assignees/notes (cascade).

   Auth rules (Type C / To-do):
     - Super Admin: anything in tenant
     - Creator (created_by_account_id = me): anything on own todo
     - Assigner (assigned_by_account_id = me): can edit own-assigned
     - Assignee / Observer (metadata.observers): may ONLY change the task's
       situation — status + submit/withdraw approval. Setting status "done"
       on a delegated task is converted server-side into approval_state
       "pending"; only the assigner can confirm it as truly done.
     - Everyone else: 403.
*/

interface ObserverRef {
  account_id?: string;
  username?: string;
  full_name?: string | null;
}

interface TodoOwnership {
  id: string;
  tenant_id: string | null;
  title: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  approval_state: string | null;
  metadata: { observers?: ObserverRef[]; mentions?: ObserverRef[] } | null;
}

async function loadTodo(
  id: string,
  tenantId: string | null,
): Promise<TodoOwnership | null> {
  let query = supabaseServer
    .from("koleex_todos")
    .select(
      "id, tenant_id, title, created_by_account_id, assigned_by_account_id, approval_state, metadata",
    )
    .eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data } = await query.maybeSingle();
  return (data as TodoOwnership | null) ?? null;
}

function isObserverOf(t: TodoOwnership, accountId: string): boolean {
  const obs = t.metadata?.observers;
  return Array.isArray(obs) && obs.some((o) => o?.account_id === accountId);
}

async function isAssigneeOf(id: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id")
    .eq("todo_id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  return !!data;
}

/* Notify the assigner that a participant submitted the task for approval. */
async function notifySubmittedForApproval(
  t: TodoOwnership,
  actorId: string,
): Promise<void> {
  const assigner = t.assigned_by_account_id;
  if (!assigner || assigner === actorId) return;
  const title = t.title ?? "Task";
  await supabaseServer.from("inbox_messages").insert({
    recipient_account_id: assigner,
    sender_account_id: actorId,
    category: "task",
    subject: `Awaiting your approval: ${title}`,
    body: `The task "${title}" was submitted as done and needs your confirmation.`,
    link: `/todo?task=${t.id}`,
    metadata: { type: "todo_approval_request", todo_id: t.id },
  });
  await sendPushToAccounts([assigner], {
    title: "Task awaiting your approval",
    body: title,
    url: `/todo?task=${t.id}`,
  });
}

/* Notify assignees when the assigner confirms (done) or reopens the task. */
async function notifyApprovalDecision(
  t: TodoOwnership,
  actorId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const { data: rows } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("account_id")
    .eq("todo_id", t.id);
  const recipients = Array.from(
    new Set((rows ?? []).map((r) => (r as { account_id: string }).account_id)),
  ).filter((aid) => aid !== actorId);
  if (recipients.length === 0) return;
  const title = t.title ?? "Task";
  const approved = decision === "approved";
  await supabaseServer.from("inbox_messages").insert(
    recipients.map((recipientId) => ({
      recipient_account_id: recipientId,
      sender_account_id: actorId,
      category: "task",
      subject: approved
        ? `Task confirmed done: ${title}`
        : `Task reopened: ${title}`,
      body: approved
        ? `Your submission for "${title}" was confirmed. The task is done.`
        : `"${title}" was reopened — it is not fully done yet.`,
      link: `/todo?task=${t.id}`,
      metadata: { type: "todo_approval_decision", todo_id: t.id, decision },
    })),
  );
  await sendPushToAccounts(recipients, {
    title: approved ? "Task confirmed done" : "Task reopened",
    body: title,
    url: `/todo?task=${t.id}`,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "edit");
  if (deny) return deny;

  const existing = await loadTodo(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner =
    auth.is_super_admin ||
    existing.created_by_account_id === auth.account_id ||
    existing.assigned_by_account_id === auth.account_id;
  const isParticipant =
    !isOwner &&
    (isObserverOf(existing, auth.account_id) ||
      (await isAssigneeOf(id, auth.account_id)));

  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    updates: Record<string, unknown>;
    newAssigneeIds?: string[];
  };
  let updates = { ...body.updates };
  delete updates.tenant_id;
  delete updates.id;
  delete updates.created_by_account_id;
  delete updates.created_at;

  /* Participants (assignee / observer) may only move the task's situation.
     Everything else — title, dates, assignees, metadata, approval decisions —
     stays with the owner. Their "done" becomes a submission for approval. */
  let submittedForApproval = false;
  if (!isOwner) {
    const restricted: Record<string, unknown> = {};
    if (typeof updates.status === "string") restricted.status = updates.status;
    if ("approval_state" in updates) {
      const a = updates.approval_state;
      // Only the assigner decides approved / rejected.
      if (a === "pending" || a === null) restricted.approval_state = a;
    }
    if (restricted.status === "done") {
      // Server-enforced approval loop: a participant can never complete a
      // delegated task directly — it goes to the assigner as "pending".
      delete restricted.status;
      if (existing.approval_state !== "approved") restricted.approval_state = "pending";
    }
    if (Object.keys(restricted).length === 0) {
      return NextResponse.json(
        { error: "Only the assigner can change this" },
        { status: 403 },
      );
    }
    updates = restricted;
  }

  updates.updated_at = new Date().toISOString();

  // Keep completed/completed_at in lockstep with an explicit status change.
  if (typeof updates.status === "string") {
    const done = updates.status === "done";
    updates.completed = done;
    updates.completed_at = done ? new Date().toISOString() : null;
  }

  if (updates.approval_state === "pending" && existing.approval_state !== "pending") {
    submittedForApproval = true;
  }
  const approvalDecision =
    isOwner &&
    existing.approval_state === "pending" &&
    (updates.approval_state === "approved" || updates.approval_state === "rejected")
      ? (updates.approval_state as "approved" | "rejected")
      : null;

  /* Mention/observer-notify: if this edit sets metadata, capture the prior
     sets first so we only ping people newly added (not on every save). */
  const nextMeta = updates.metadata as
    | { mentions?: ObserverRef[]; observers?: ObserverRef[] }
    | undefined;
  const nextMentions = nextMeta?.mentions;
  const nextObservers = nextMeta?.observers;
  const priorMentionIds = Array.isArray(existing.metadata?.mentions)
    ? ((existing.metadata?.mentions ?? [])
        .map((m) => m.account_id)
        .filter(Boolean) as string[])
    : [];
  const priorObserverIds = Array.isArray(existing.metadata?.observers)
    ? ((existing.metadata?.observers ?? [])
        .map((o) => o.account_id)
        .filter(Boolean) as string[])
    : [];

  const { error } = await supabaseServer
    .from("koleex_todos")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  // Approval notifications (submit → assigner; decide → assignees).
  if (submittedForApproval) await notifySubmittedForApproval(existing, auth.account_id);
  if (approvalDecision) await notifyApprovalDecision(existing, auth.account_id, approvalDecision);

  if (isOwner && body.newAssigneeIds !== undefined) {
    /* Capture the prior assignee set BEFORE resyncing so we can notify only
       the people who are newly added (not everyone, every edit). */
    const { data: priorRows } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("account_id")
      .eq("todo_id", id);
    const priorIds = new Set(
      (priorRows ?? []).map((r) => (r as { account_id: string }).account_id),
    );

    await supabaseServer
      .from("koleex_todo_assignees")
      .delete()
      .eq("todo_id", id);
    if (body.newAssigneeIds.length > 0) {
      await supabaseServer.from("koleex_todo_assignees").insert(
        body.newAssigneeIds.map((accountId) => ({
          todo_id: id,
          account_id: accountId,
        })),
      );
    }

    /* Fan out inbox notifications to newly-added assignees (excluding self),
       mirroring the POST create fan-out so assigning via edit also notifies. */
    const addedIds = body.newAssigneeIds.filter(
      (aid) => aid !== auth.account_id && !priorIds.has(aid),
    );
    if (addedIds.length > 0) {
      const { data: t } = await supabaseServer
        .from("koleex_todos")
        .select("title, description, priority")
        .eq("id", id)
        .maybeSingle();
      const td = (t as { title?: string; description?: string | null; priority?: string } | null) ?? {};
      const notifs = addedIds.map((recipientId) => ({
        recipient_account_id: recipientId,
        sender_account_id: auth.account_id,
        category: "task",
        subject: `New task: ${td.title ?? "Task"}`,
        body: td.description || td.title || "You have a new task.",
        link: `/todo?task=${id}`,
        metadata: {
          type: "todo_assignment",
          todo_id: id,
          priority: td.priority ?? "medium",
        },
      }));
      await supabaseServer.from("inbox_messages").insert(notifs);
    }
  }

  // Notify newly-added @mentions and observers (excluding self + prior).
  const notifyAdded = async (
    next: ObserverRef[] | undefined,
    priorIds: string[],
    kind: "mention" | "observer",
  ) => {
    if (!Array.isArray(next)) return;
    const prior = new Set(priorIds);
    const added = Array.from(
      new Set(next.map((m) => m.account_id).filter(Boolean) as string[]),
    ).filter((mid) => mid !== auth.account_id && !prior.has(mid));
    if (added.length === 0) return;
    const title = existing.title ?? "Task";
    await supabaseServer.from("inbox_messages").insert(
      added.map((recipientId) => ({
        recipient_account_id: recipientId,
        sender_account_id: auth.account_id,
        category: "task",
        subject:
          kind === "mention"
            ? `You were mentioned: ${title}`
            : `You are now an observer: ${title}`,
        body:
          kind === "mention"
            ? "You were mentioned on a task."
            : "You were added as an observer — you can follow this task and update its situation.",
        link: `/todo?task=${id}`,
        metadata: { type: `todo_${kind}`, todo_id: id },
      })),
    );
  };
  if (isOwner) {
    await notifyAdded(nextMentions, priorMentionIds, "mention");
    await notifyAdded(nextObservers, priorObserverIds, "observer");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "delete");
  if (deny) return deny;

  const existing = await loadTodo(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canDelete =
    auth.is_super_admin ||
    existing.created_by_account_id === auth.account_id ||
    existing.assigned_by_account_id === auth.account_id;
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("koleex_todos")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
