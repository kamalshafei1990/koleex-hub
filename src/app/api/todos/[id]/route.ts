import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import {
  internalAccountIds,
  isTodoOwner,
  loadTodoOwnership,
  todoParticipation,
} from "@/lib/server/todo-access";
import {
  clearTodoNotifications,
  notifyApprovalDecision,
  notifySubmittedForApproval,
  notifyTodoAssigned,
  notifyTodoPeopleAdded,
  pingTodosChanged,
} from "@/lib/server/todo-notify";
import { isTodoApprovalState, isTodoPriority, isTodoRecurrence, isTodoStatus } from "@/lib/todo-enums";

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
*/

interface ObserverRef {
  account_id?: string;
  username?: string;
  full_name?: string | null;
}

/* Columns the client may never set. Ownership, identity and the approval
   audit stamps are decided here. */
const SERVER_OWNED = [
  "id", "tenant_id", "created_at", "created_by_account_id",
  "approved_by_account_id", "approved_at", "reminded_at",
  "recurrence_parent_id", "recurrence_spawned_for",
] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
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

  const body = (await req.json()) as {
    updates: Record<string, unknown>;
    newAssigneeIds?: string[];
  };
  let updates: Record<string, unknown> = { ...(body.updates ?? {}) };
  for (const k of SERVER_OWNED) delete updates[k];

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

  /* Vocabularies (lib/todo-enums.ts). The create route validated these;
     this route let anything through, so an unknown cadence reached the
     recurrence engine. */
  if ("status" in updates && !isTodoStatus(updates.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if ("priority" in updates && !isTodoPriority(updates.priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }
  if ("recurrence" in updates && updates.recurrence != null && !isTodoRecurrence(updates.recurrence)) {
    return NextResponse.json({ error: "Invalid recurrence" }, { status: 400 });
  }
  if ("approval_state" in updates && updates.approval_state != null && !isTodoApprovalState(updates.approval_state)) {
    return NextResponse.json({ error: "Invalid approval state" }, { status: 400 });
  }
  if ("recurrence" in updates && updates.recurrence == null) updates.recurrence_until = null;

  const nowIso = new Date().toISOString();
  updates.updated_at = nowIso;

  // Keep completed/completed_at in lockstep with an explicit status change.
  if (typeof updates.status === "string") {
    const done = updates.status === "done";
    updates.completed = done;
    updates.completed_at = done ? nowIso : null;
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
  /* The decision is stamped HERE, whichever path took it — the client used
     to send approved_by / approved_at itself, and the toggle route and the
     AI tool never set them at all. */
  if (approvalDecision) {
    updates.approved_by_account_id = auth.account_id;
    updates.approved_at = nowIso;
  }

  /* A RETURN MUST CARRY A REASON. Sending work back without saying why just
     puts the task around the loop again, so the reason is required here and
     not only in the dialog — the client can be bypassed. Note this rejects
     the decision, not the task: approval_state goes to "rejected" and the
     SAME row re-opens (completed false, status in_progress) further down.
     A return never creates a second task. */
  const rejectionReason = (updates.metadata as { rejection?: { reason?: unknown } } | undefined)?.rejection?.reason;
  if (approvalDecision === "rejected" && (typeof rejectionReason !== "string" || !rejectionReason.trim())) {
    return NextResponse.json(
      { error: "A reason is required when returning a task" },
      { status: 400 },
    );
  }

  /* Mention/observer-notify: if this edit sets metadata, capture the prior
     sets first so we only ping people newly added (not on every save). */
  const nextMeta = updates.metadata as
    | { mentions?: ObserverRef[]; observers?: ObserverRef[] }
    | undefined;
  const idsOf = (list: ObserverRef[] | undefined) =>
    Array.isArray(list) ? (list.map((m) => m.account_id).filter(Boolean) as string[]) : [];
  const priorMentionIds = idsOf(existing.metadata?.mentions);
  const priorObserverIds = idsOf(existing.metadata?.observers);

  /* Returning re-opens THIS task rather than leaving it parked as done —
     enforced server-side so the row can never be left completed while its
     approval reads "rejected". */
  if (updates.approval_state === "rejected") {
    updates.completed = false;
    updates.completed_at = null;
    if (typeof updates.status !== "string" || updates.status === "done") {
      updates.status = "in_progress";
    }
  }

  const { error } = await supabaseServer
    .from("koleex_todos")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("[api/todos/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  /* A FINISHED TASK MUST NOT LEAVE ITS NOTIFICATIONS UNREAD — owner, 2026-08:
     "if one task finished or read still I can see the notification". Every
     row that points at this task, for every recipient, whatever its type. */
  if (updates.status === "done") await clearTodoNotifications(id);

  // Approval notifications (submit → assigner; decide → assignees).
  if (submittedForApproval) await notifySubmittedForApproval(existing, auth.account_id);
  if (approvalDecision) {
    await notifyApprovalDecision(
      existing,
      auth.account_id,
      approvalDecision,
      typeof rejectionReason === "string" ? rejectionReason.trim() || undefined : undefined,
    );
  }

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

    /* Same INTERNAL-ONLY rule as create: reassignment must not be able to
       hand company work to a customer/portal account. */
    const nextAssigneeIds = await internalAccountIds(body.newAssigneeIds, auth.tenant_id);

    await supabaseServer
      .from("koleex_todo_assignees")
      .delete()
      .eq("todo_id", id);
    if (nextAssigneeIds.length > 0) {
      await supabaseServer.from("koleex_todo_assignees").insert(
        nextAssigneeIds.map((accountId) => ({ todo_id: id, account_id: accountId })),
      );
    }

    const addedIds = nextAssigneeIds.filter((aid) => !priorIds.has(aid));
    if (addedIds.length > 0) {
      const { data: t } = await supabaseServer
        .from("koleex_todos")
        .select("id, title, description, priority, tenant_id")
        .eq("id", id)
        .maybeSingle();
      if (t) {
        await notifyTodoAssigned(
          t as { id: string; title: string | null; description: string | null; priority: string; tenant_id: string | null },
          addedIds,
          auth.account_id,
        );
      }
    }
  }

  // Notify newly-added @mentions and observers (excluding self + prior).
  if (isOwner && nextMeta) {
    const todoLike = { id, title: existing.title, tenant_id: existing.tenant_id };
    const newly = (next: ObserverRef[] | undefined, prior: string[]) => {
      if (!Array.isArray(next)) return [];
      const before = new Set(prior);
      return Array.from(new Set(idsOf(next))).filter((mid) => !before.has(mid));
    };
    await notifyTodoPeopleAdded(todoLike, "mention", newly(nextMeta.mentions, priorMentionIds), auth.account_id);
    await notifyTodoPeopleAdded(todoLike, "observer", newly(nextMeta.observers, priorObserverIds), auth.account_id);
  }

  await pingTodosChanged(existing.tenant_id ?? auth.tenant_id);
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
     longer exists. Best-effort; the delete already succeeded. */
  await clearTodoNotifications(id);
  await pingTodosChanged(existing.tenant_id ?? auth.tenant_id);
  return NextResponse.json({ ok: true });
}
