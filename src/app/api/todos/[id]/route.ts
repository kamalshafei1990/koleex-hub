import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  ASSIGN_TO_EVERYONE_DENIED,
  canAssignToEveryone,
  isTodoOwner,
  loadTodoOwnership,
  todoParticipation,
} from "@/lib/server/todo-access";
import { internalAccountIds } from "@/lib/server/internal-accounts";
import { readIdList, readTodoFields } from "@/lib/server/todo-input";
import { attachmentPathsOf, releaseTodoAttachments, removedAttachmentPaths } from "@/lib/server/todo-attachments";
import { ESCALATION_MARK } from "@/lib/server/todo-escalation";
import {
  clearApprovalRequest,
  clearTodoNotifications,
  notifyApprovalDecision,
  notifySubmittedForApproval,
  notifyTodoAssigned,
  notifyTodoPeopleAdded,
  pingTodosChanged,
} from "@/lib/server/todo-notify";

/* PATCH /api/todos/[id] — update fields + optionally re-sync assignees.
   DELETE /api/todos/[id] — remove the todo + assignees/notes (cascade).

   Auth rules (Type C / To-do), from lib/server/todo-access.ts:
     - Super Admin: anything in tenant
     - Creator (created_by_account_id = me): anything on own todo
     - Assigner (assigned_by_account_id = me): can edit own-assigned
     - Assignee / Observer (metadata.observers): may ONLY change the task's
       situation — status + submit/withdraw approval. Setting status "done"
       on a delegated task is converted server-side into approval_state
       "pending"; only the assigner can confirm it as truly done.
     - Everyone else: 403.

   Responses: 400 invalid input · 403 not allowed · 404 not in your tenant ·
   409 the approval state moved under you (someone decided first) · 200. */

interface ObserverRef {
  account_id?: string;
  username?: string;
  full_name?: string | null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "edit");
  if (deny) return deny;

  const existing = await loadTodoOwnership(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const actor = { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin };
  const { isOwner, isParticipant } = await todoParticipation(existing, actor);
  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    updates?: Record<string, unknown>;
    newAssigneeIds?: unknown;
    /* "Send back" from a notification: the reason alone. That caller does
       not hold the task's metadata, and `metadata` replaces the whole
       column — so the server writes the reason into the task's OWN
       metadata (below) instead of trusting a partial copy. */
    rejectionReason?: unknown;
  };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rawUpdates = body.updates && typeof body.updates === "object" && !Array.isArray(body.updates) ? body.updates : {};

  /* Participants (assignee / observer) may only move the task's situation.
     Everything else — title, dates, assignees, metadata, approval decisions —
     stays with the owner. Their "done" becomes a submission for approval. */
  let input: Record<string, unknown> = rawUpdates;
  if (!isOwner) {
    const restricted: Record<string, unknown> = {};
    if (typeof rawUpdates.status === "string") restricted.status = rawUpdates.status;
    if ("approval_state" in rawUpdates) {
      const a = rawUpdates.approval_state;
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
      return NextResponse.json({ error: "Only the assigner can change this" }, { status: 403 });
    }
    input = restricted;
  }

  /* The allow-list (lib/server/todo-input.ts): known columns type-checked,
     unknown ones — ids, tenant, audit stamps, reminded_at, the recurrence
     links — dropped. */
  const read = readTodoFields(input);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: 400 });
  const updates: Record<string, unknown> = read.fields;
  /* Turning "everyone" ON is an admin's call; turning it off, or re-saving
     a task that already has it, is not a new broadcast. */
  if (updates.assign_to_all === true && !existing.assign_to_all && !canAssignToEveryone(auth)) {
    return NextResponse.json({ error: ASSIGN_TO_EVERYONE_DENIED }, { status: 403 });
  }
  const newAssigneeIds = isOwner && body.newAssigneeIds !== undefined ? readIdList(body.newAssigneeIds) : undefined;
  if (newAssigneeIds === null) {
    return NextResponse.json({ error: "newAssigneeIds must be a list" }, { status: 400 });
  }
  if ("recurrence" in updates && updates.recurrence == null) updates.recurrence_until = null;

  /* `completed` on its own is the checkbox: fold it into the status so the
     two can never disagree. */
  if (typeof updates.completed === "boolean" && typeof updates.status !== "string") {
    updates.status = updates.completed ? "done" : existing.status === "done" ? "todo" : existing.status ?? "todo";
  }
  delete updates.completed;

  const nowIso = new Date().toISOString();
  updates.updated_at = nowIso;

  /* Keep completed/completed_at in lockstep with the status — but only when
     the status really CHANGES. The edit form sends its status on every
     save, and restamping completed_at each time rewrote when a finished
     task was finished. */
  if (typeof updates.status === "string") {
    const done = updates.status === "done";
    if (done !== existing.completed) {
      updates.completed = done;
      updates.completed_at = done ? nowIso : null;
    }
  }

  /* A moved reminder rings again; a moved due date can escalate again. */
  if ("remind_at" in updates && updates.remind_at !== existing.remind_at) updates.reminded_at = null;
  const dueMoved = "due_date" in updates && updates.due_date !== existing.due_date;

  let submittedForApproval = updates.approval_state === "pending" && existing.approval_state !== "pending";
  let approvalDecision =
    isOwner &&
    existing.approval_state === "pending" &&
    (updates.approval_state === "approved" || updates.approval_state === "rejected")
      ? (updates.approval_state as "approved" | "rejected")
      : null;
  /* An owner marking a PENDING submission done is confirming it — the same
     implicit approval the toggle route stamps. */
  if (!approvalDecision && isOwner && existing.approval_state === "pending" && updates.status === "done" && !("approval_state" in updates)) {
    updates.approval_state = "approved";
    approvalDecision = "approved";
  }
  if (approvalDecision) {
    /* The decision is stamped HERE, whichever path took it. */
    updates.approved_by_account_id = auth.account_id;
    updates.approved_at = nowIso;
    submittedForApproval = false;
  }

  /* `rejectionReason` (≤ 1000 chars) is the send-back reason on its own, so
     a caller never has to write the whole metadata column to return a task.
     The server writes it into metadata.rejection — merged into the metadata
     this request carries, or else into the task's OWN metadata; in that
     second case the write is conditional on the row being unchanged since
     it was read (updated_at below), so no concurrent edit is overwritten. */
  if (body.rejectionReason !== undefined && body.rejectionReason !== null && typeof body.rejectionReason !== "string") {
    return NextResponse.json({ error: "rejectionReason must be text" }, { status: 400 });
  }
  const reason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
  if (reason.length > 1000) {
    return NextResponse.json({ error: "The reason is too long (max 1000 characters)" }, { status: 400 });
  }
  let mergedIntoExisting = false;
  if (approvalDecision === "rejected" && reason) {
    const base = (updates.metadata as Record<string, unknown> | undefined) ?? existing.metadata ?? {};
    mergedIntoExisting = !("metadata" in updates);
    updates.metadata = { ...base, rejection: { reason, by: auth.account_id, at: nowIso } };
  }

  /* A RETURN MUST CARRY A REASON. Sending work back without saying why just
     puts the task around the loop again, so the reason is required here and
     not only in the dialog — the client can be bypassed. This rejects the
     decision, not the task: approval_state goes to "rejected" and the SAME
     row re-opens (completed false, status in_progress) below. */
  const rejectionReason = (updates.metadata as { rejection?: { reason?: unknown } } | undefined)?.rejection?.reason;
  if (approvalDecision === "rejected" && (typeof rejectionReason !== "string" || !rejectionReason.trim())) {
    return NextResponse.json({ error: "A reason is required when returning a task" }, { status: 400 });
  }

  /* The escalation stamp re-arms when the due date moves — dropped from
     whichever metadata this write carries. */
  if (dueMoved) {
    if (!("metadata" in updates)) mergedIntoExisting = true;
    const base = (updates.metadata as Record<string, unknown> | undefined) ?? existing.metadata;
    if (base && ESCALATION_MARK in base) {
      const next = { ...base };
      delete next[ESCALATION_MARK];
      updates.metadata = next;
    }
  }

  /* Mention/observer-notify: capture the prior sets so we only ping people
     newly added (not on every save). */
  const nextMeta = updates.metadata as { mentions?: ObserverRef[]; observers?: ObserverRef[] } | undefined;
  const idsOf = (list: ObserverRef[] | undefined) =>
    Array.isArray(list) ? (list.map((m) => m.account_id).filter(Boolean) as string[]) : [];
  const priorMentionIds = idsOf(existing.metadata?.mentions);
  const priorObserverIds = idsOf(existing.metadata?.observers);

  /* Returning re-opens THIS task rather than leaving it parked as done. */
  if (updates.approval_state === "rejected") {
    updates.completed = false;
    updates.completed_at = null;
    if (typeof updates.status !== "string" || updates.status === "done") {
      updates.status = "in_progress";
    }
  }

  /* Approval transitions are CONDITIONAL on the state read above, so two
     managers deciding at once — or a double-tapped submit — produce one
     decision and one notification, and the loser gets 409. */
  let q = supabaseServer.from("koleex_todos").update(updates).eq("id", id);
  /* Metadata the SERVER derived from the row it read: write only if that
     row is still the one read (optimistic lock on updated_at). */
  if (mergedIntoExisting && "metadata" in updates && existing.updated_at) q = q.eq("updated_at", existing.updated_at);
  if (approvalDecision) q = q.eq("approval_state", "pending");
  else if (submittedForApproval) {
    q = existing.approval_state === null ? q.is("approval_state", null) : q.eq("approval_state", existing.approval_state);
  }
  const { data: written, error } = await q.select("id");
  if (error) {
    console.error("[api/todos/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
  if ((written ?? []).length === 0) {
    return NextResponse.json({ error: "This task was just changed by someone else — reload it." }, { status: 409 });
  }

  /* A FINISHED TASK MUST NOT LEAVE ITS NOTIFICATIONS UNREAD. Awaited: the
     client refetches the bell right after this response. */
  if (updates.status === "done" && !existing.completed) await clearTodoNotifications(id);
  /* Sent back: the request for approval is answered, the task goes on. */
  if (approvalDecision === "rejected") await clearApprovalRequest(id);

  /* Reassignment — the diff, not a wipe-and-rewrite: removed people lose
     their row, new people gain one, everyone else keeps theirs (and its
     assigned_at). The task is never momentarily assignee-less. */
  let addedIds: string[] = [];
  if (newAssigneeIds !== undefined) {
    const [{ data: priorRows }, nextIds] = await Promise.all([
      supabaseServer.from("koleex_todo_assignees").select("account_id").eq("todo_id", id),
      /* Same INTERNAL-ONLY rule as create. */
      internalAccountIds(newAssigneeIds, auth.tenant_id),
    ]);
    const prior = new Set(((priorRows ?? []) as Array<{ account_id: string }>).map((r) => r.account_id));
    const next = new Set(nextIds);
    const removed = Array.from(prior).filter((a) => !next.has(a));
    addedIds = nextIds.filter((a) => !prior.has(a));
    const [delRes, insRes] = await Promise.all([
      removed.length > 0
        ? supabaseServer.from("koleex_todo_assignees").delete().eq("todo_id", id).in("account_id", removed)
        : Promise.resolve({ error: null }),
      addedIds.length > 0
        ? supabaseServer
            .from("koleex_todo_assignees")
            .upsert(addedIds.map((accountId) => ({ todo_id: id, account_id: accountId })), {
              onConflict: "todo_id,account_id",
              ignoreDuplicates: true,
            })
        : Promise.resolve({ error: null }),
    ]);
    if (delRes.error || insRes.error) {
      console.error("[api/todos/[id] PATCH] assignees:", delRes.error?.message ?? insRes.error?.message);
      return NextResponse.json({ error: "Failed to update assignees" }, { status: 500 });
    }
  }

  /* Everything below informs other people — after the response. */
  const title = (updates.title as string | undefined) ?? existing.title;
  const todoLike = {
    id,
    title,
    description: "description" in updates ? (updates.description as string | null) : existing.description,
    priority: (updates.priority as string | undefined) ?? existing.priority ?? "medium",
    tenant_id: existing.tenant_id,
  };
  /* Attachments this edit removed: their objects go once nothing else
     (another period of the same series, a copy) still lists them. */
  const releasedPaths = "metadata" in updates ? removedAttachmentPaths(existing.metadata, updates.metadata) : [];
  after(async () => {
    if (releasedPaths.length > 0) await releaseTodoAttachments(existing.tenant_id, releasedPaths);
    if (submittedForApproval) await notifySubmittedForApproval({ ...existing, title }, auth.account_id);
    if (approvalDecision) {
      await notifyApprovalDecision(
        todoLike,
        auth.account_id,
        approvalDecision,
        typeof rejectionReason === "string" ? rejectionReason.trim() || undefined : undefined,
      );
    }
    if (addedIds.length > 0) await notifyTodoAssigned(todoLike, addedIds, auth.account_id);
    if (isOwner && nextMeta) {
      const newly = (next: ObserverRef[] | undefined, prior: string[]) => {
        if (!Array.isArray(next)) return [];
        const before = new Set(prior);
        return Array.from(new Set(idsOf(next))).filter((mid) => !before.has(mid));
      };
      await notifyTodoPeopleAdded(todoLike, "mention", newly(nextMeta.mentions, priorMentionIds), auth.account_id);
      await notifyTodoPeopleAdded(todoLike, "observer", newly(nextMeta.observers, priorObserverIds), auth.account_id);
    }
    await pingTodosChanged(existing.tenant_id ?? auth.tenant_id);
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "delete");
  if (deny) return deny;

  const existing = await loadTodoOwnership(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isTodoOwner(existing, { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin })) {
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

  /* The task is gone, so every notification about it is finished business —
     otherwise it keeps counting in the bell and links to a row that no
     longer exists. Awaited: the client recounts the bell right after. */
  await clearTodoNotifications(id);
  const paths = attachmentPathsOf(existing.metadata);
  after(async () => {
    if (paths.length > 0) await releaseTodoAttachments(existing.tenant_id, paths);
    await pingTodosChanged(existing.tenant_id ?? auth.tenant_id);
  });
  return NextResponse.json({ ok: true });
}
