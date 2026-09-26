import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadTodoOwnership, todoParticipation } from "@/lib/server/todo-access";
import {
  clearTodoNotifications,
  notifyApprovalDecision,
  notifySubmittedForApproval,
  pingTodosChanged,
} from "@/lib/server/todo-notify";

/* POST /api/todos/[id]/toggle
   Flip the completed flag.

   Owners (Super Admin / creator / assigner) flip it directly.
   Participants (assignees + metadata.observers) can NOT complete a delegated
   task outright — ticking it submits it for the assigner's approval
   (approval_state = "pending"); ticking again withdraws the submission.
   This mirrors the client flow but is enforced HERE so the approval loop
   cannot be bypassed by calling the API directly.

   A flip is CONDITIONAL on the state it was computed from: a double tap, or
   two people ticking at once, used to read the same state and both write —
   the second "flip" undoing the first, or two approval requests. The loser
   now gets 409 and the state the first one left. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  /* A state change is an EDIT, not a create. */
  const deny = await requireModuleAction(auth, "To-do", "edit");
  if (deny) return deny;

  const t = await loadTodoOwnership(id, auth.tenant_id);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const completed = Boolean(t.completed);

  const { isOwner, isParticipant } = await todoParticipation(t, {
    accountId: auth.account_id,
    isSuperAdmin: auth.is_super_admin,
  });
  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const conflict = () =>
    NextResponse.json({ error: "This task was just changed by someone else.", conflict: true }, { status: 409 });

  /* Participant path: completing = submit for approval, not done. */
  if (!isOwner && !completed && t.approval_state !== "approved") {
    const withdrawing = t.approval_state === "pending";
    let q = supabaseServer
      .from("koleex_todos")
      .update({ approval_state: withdrawing ? null : "pending", updated_at: now })
      .eq("id", id)
      .eq("completed", false);
    q = t.approval_state === null ? q.is("approval_state", null) : q.eq("approval_state", t.approval_state);
    const { data, error } = await q.select("id");
    if (error) {
      console.error("[api/todos/[id]/toggle]", error.message);
      return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
    }
    if (!data || data.length === 0) return conflict();
    after(async () => {
      if (!withdrawing) await notifySubmittedForApproval(t, auth.account_id);
      await pingTodosChanged(t.tenant_id ?? auth.tenant_id);
    });
    return NextResponse.json({ ok: true, approval: withdrawing ? null : "pending" });
  }

  const completing = !completed;
  // Owner completing a pending submission = implicit approval, stamped as
  // such; un-completing clears any stale approval state.
  const implicitApproval = completing && t.approval_state === "pending";
  const { data, error } = await supabaseServer
    .from("koleex_todos")
    .update({
      completed: completing,
      completed_at: completing ? now : null,
      // Keep the workflow stage in sync with the checkbox.
      status: completing ? "done" : "todo",
      approval_state: completing ? (implicitApproval ? "approved" : t.approval_state) : null,
      ...(implicitApproval ? { approved_by_account_id: auth.account_id, approved_at: now } : {}),
      updated_at: now,
    })
    .eq("id", id)
    .eq("completed", completed)
    .select("id");

  if (error) {
    console.error("[api/todos/[id]/toggle]", error.message);
    return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
  }
  if (!data || data.length === 0) return conflict();

  /* Completing a task closes the loop: every still-unread inbox row that
     points at it (reminders, recurring spawns, assignment notes — all
     recipients) is finished business. Awaited — the client recounts the
     bell right after this answer. Un-completing does NOT resurrect them. */
  if (completing) await clearTodoNotifications(id);
  after(async () => {
    /* Ticking a submission done IS confirming it — the assignees hear, as
       they do when the assigner approves from the notification. */
    if (implicitApproval) await notifyApprovalDecision(t, auth.account_id, "approved");
    await pingTodosChanged(t.tenant_id ?? auth.tenant_id);
  });
  return NextResponse.json({ ok: true, completed: completing });
}
