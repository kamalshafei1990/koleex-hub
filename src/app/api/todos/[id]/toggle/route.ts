import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { sendPushToAccounts } from "@/lib/server/web-push";

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
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;

  // Load the todo + check assignee membership in parallel.
  const [{ data: todo }, { data: assignee }] = await Promise.all([
    supabaseServer
      .from("koleex_todos")
      .select(
        "id, title, completed, tenant_id, created_by_account_id, assigned_by_account_id, approval_state, metadata",
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id")
      .eq("todo_id", id)
      .eq("account_id", auth.account_id)
      .maybeSingle(),
  ]);

  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth.tenant_id && (todo as { tenant_id: string | null }).tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const t = todo as {
    id: string;
    title: string | null;
    completed: boolean;
    created_by_account_id: string | null;
    assigned_by_account_id: string | null;
    approval_state: string | null;
    metadata: { observers?: Array<{ account_id?: string }> } | null;
  };

  const isOwner =
    auth.is_super_admin ||
    t.created_by_account_id === auth.account_id ||
    t.assigned_by_account_id === auth.account_id;
  const isObserver =
    Array.isArray(t.metadata?.observers) &&
    (t.metadata?.observers ?? []).some((o) => o?.account_id === auth.account_id);
  const isParticipant = !!assignee || isObserver;

  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();

  /* Participant path: completing = submit for approval, not done. */
  if (!isOwner && !t.completed && t.approval_state !== "approved") {
    const withdrawing = t.approval_state === "pending";
    const { error } = await supabaseServer
      .from("koleex_todos")
      .update({ approval_state: withdrawing ? null : "pending", updated_at: now })
      .eq("id", id);
    if (error) {
      console.error("[api/todos/[id]/toggle]", error.message);
      return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
    }
    if (!withdrawing && t.assigned_by_account_id && t.assigned_by_account_id !== auth.account_id) {
      const title = t.title ?? "Task";
      await supabaseServer.from("inbox_messages").insert({
        recipient_account_id: t.assigned_by_account_id,
        sender_account_id: auth.account_id,
        category: "task",
        subject: `Awaiting your approval: ${title}`,
        body: `The task "${title}" was submitted as done and needs your confirmation.`,
        link: `/todo?task=${id}`,
        metadata: { type: "todo_approval_request", todo_id: id },
      });
      await sendPushToAccounts([t.assigned_by_account_id], {
        title: "Task awaiting your approval",
        body: title,
        url: `/todo?task=${id}`,
      });
    }
    return NextResponse.json({ ok: true, approval: withdrawing ? null : "pending" });
  }

  const { error } = await supabaseServer
    .from("koleex_todos")
    .update({
      completed: !t.completed,
      completed_at: !t.completed ? now : null,
      // Keep the workflow stage in sync with the checkbox.
      status: !t.completed ? "done" : "todo",
      // Owner completing a pending submission = implicit approval;
      // un-completing clears any stale approval state.
      approval_state: !t.completed
        ? (t.approval_state === "pending" ? "approved" : t.approval_state)
        : null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("[api/todos/[id]/toggle]", error.message);
    return NextResponse.json({ error: "Failed to toggle" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
