import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadTodoOwnership, todoParticipation } from "@/lib/server/todo-access";
import { clearTodoNotifications, notifySubmittedForApproval, pingTodosChanged } from "@/lib/server/todo-notify";

/* POST /api/todos/[id]/toggle
   Flip the completed flag.

   Owners (Super Admin / creator / assigner) flip it directly.
   Participants (assignees + metadata.observers) can NOT complete a delegated
   task outright — ticking it submits it for the assigner's approval
   (approval_state = "pending"); ticking again withdraws the submission.
   This mirrors the client flow but is enforced HERE so the approval loop
   cannot be bypassed by calling the API directly. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* A state change is an EDIT. This route asked for "create", so a role
     allowed to add tasks but not to change them could still flip any task it
     could see. */
  const deny = await requireModuleAction(auth, "To-do", "edit");
  if (deny) return deny;

  const [t, { data: row }] = await Promise.all([
    loadTodoOwnership(id, auth.tenant_id),
    supabaseServer.from("koleex_todos").select("completed").eq("id", id).maybeSingle(),
  ]);
  if (!t || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const completed = Boolean((row as { completed: boolean | null }).completed);

  const { isOwner, isParticipant } = await todoParticipation(t, {
    accountId: auth.account_id,
    isSuperAdmin: auth.is_super_admin,
  });
  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  /* Participant path: completing = submit for approval, not done. */
  if (!isOwner && !completed && t.approval_state !== "approved") {
    const withdrawing = t.approval_state === "pending";
    const { error } = await supabaseServer
      .from("koleex_todos")
      .update({ approval_state: withdrawing ? null : "pending", updated_at: now })
      .eq("id", id);
    if (error) {
      console.error("[api/todos/[id]/toggle]", error.message);
      return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
    }
    if (!withdrawing) await notifySubmittedForApproval(t, auth.account_id);
    await pingTodosChanged(t.tenant_id ?? auth.tenant_id);
    return NextResponse.json({ ok: true, approval: withdrawing ? null : "pending" });
  }

  const completing = !completed;
  // Owner completing a pending submission = implicit approval, stamped as
  // such; un-completing clears any stale approval state.
  const implicitApproval = completing && t.approval_state === "pending";
  const { error } = await supabaseServer
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
    .eq("id", id);

  if (error) {
    console.error("[api/todos/[id]/toggle]", error.message);
    return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
  }

  /* Completing a task closes the loop: every still-unread inbox row that
     points at it (reminders, recurring spawns, assignment notes — all
     recipients) is finished business. Un-completing does NOT resurrect
     them: a notification whose moment passed is history. */
  if (completing) await clearTodoNotifications(id);
  await pingTodosChanged(t.tenant_id ?? auth.tenant_id);
  return NextResponse.json({ ok: true });
}
