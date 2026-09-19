import "server-only";

/* ---------------------------------------------------------------------------
   todo-notify — the to-do approval hand-off, in one place.

   "Participant marks a delegated task done → the assigner is asked to
   confirm" was written three times by hand (the PATCH route, the toggle
   route and the AI agent's completeTodo tool), byte-for-byte alike except
   for what each copy forgot: none passed the push `kind`, so the Approvals
   switch in Settings could mute the row and the chime but never the push.
   One helper, one shape, every caller.

   Fire-and-forget safe: a notification hiccup never fails the mutation.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

export interface ApprovalTodoLike {
  id: string;
  title: string | null;
  tenant_id?: string | null;
  assigned_by_account_id: string | null;
}

/** Tell the assigner a participant submitted the task as done. No-op when
 *  the task has no assigner or the actor IS the assigner. */
export async function notifySubmittedForApproval(
  t: ApprovalTodoLike,
  actorId: string,
): Promise<void> {
  const assigner = t.assigned_by_account_id;
  if (!assigner || assigner === actorId) return;
  const title = t.title ?? "Task";
  try {
    await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: assigner,
      sender_account_id: actorId,
      tenant_id: t.tenant_id ?? null,
      category: "task",
      subject: `Awaiting your approval: ${title}`,
      body: `The task "${title}" was submitted as done and needs your confirmation.`,
      link: `/todo?task=${t.id}`,
      metadata: { type: "todo_approval_request", todo_id: t.id },
    });
    await emitPings([{ topic: rtTopic.inbox(assigner) }]);
    await sendPushToAccounts([assigner], {
      title: "Task awaiting your approval",
      body: title,
      url: `/todo?task=${t.id}`,
      tag: `todo-approval-${t.id}`,
      kind: "todo_approval_request",
    });
  } catch (e) {
    console.error("[todo-notify] approval request:", e instanceof Error ? e.message : e);
  }
}
