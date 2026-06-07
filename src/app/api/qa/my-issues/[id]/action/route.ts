import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/my-issues/[id]/action — reporter verification loop.

   The ONLY workflow mutation a non-admin can perform: confirm the fix worked
   ("verify") or push back ("reopen"). Tightly scoped:
     • caller must be the issue's reporter
     • current status must be "fixed"
     • action ∈ { "verify", "reopen" }; "reopen" requires a non-empty reason

   Successful verify → status=verified, resolved_at=now
   Successful reopen → status=reopened, reopen_count++, reopen_reason
   Both fan out notifications to the assignee + admin watchers and log a row
   in qa_issue_activity for the timeline.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logActivity } from "@/lib/qa/activity";
import { notifyIssue, issueLink } from "@/lib/qa/notify";
import { watcherTargets } from "@/lib/qa/watchers";
import { sanitizeAttachments } from "@/lib/qa/attachments";

interface IssueRow {
  id: string;
  tenant_id: string;
  title: string;
  reporter_id: string | null;
  assigned_to: string | null;
  status: string;
  reopen_count: number | null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action !== "verify" && action !== "reopen") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (action === "reopen" && reason.length === 0) {
    return NextResponse.json({ error: "A short reason is required to reopen." }, { status: 400 });
  }
  // Optional screenshot(s) attached to a reopen — validated + tenant-scoped.
  const att = sanitizeAttachments(auth.tenant_id, body?.attachments);
  if (!att.ok) return NextResponse.json({ error: att.error }, { status: 400 });

  // Load + ownership check + status guard, in a single round-trip.
  const { data, error: readErr } = await supabaseServer
    .from("qa_issue_reports")
    .select("id, tenant_id, title, reporter_id, assigned_to, status, reopen_count")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    console.error("[api/qa my-issues action read]", readErr.message);
    return NextResponse.json({ error: "Read failed." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const issue = data as IssueRow;
  // Reporter-only. Don't leak existence to other accounts.
  if (issue.reporter_id !== auth.account_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Verify / reopen only make sense from the "fixed" state.
  if (issue.status !== "fixed") {
    return NextResponse.json({ error: "Only available while the issue is marked Fixed." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (action === "verify") {
    patch.status = "verified";
    patch.resolved_at = now;
  } else {
    patch.status = "reopened";
    patch.reopened_at = now;
    patch.reopen_reason = reason;
    patch.reopen_count = (issue.reopen_count ?? 0) + 1;
  }

  const { error: upErr } = await supabaseServer
    .from("qa_issue_reports")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (upErr) {
    console.error("[api/qa my-issues action update]", upErr.message);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  // Activity timeline.
  await logActivity({
    tenant_id: auth.tenant_id,
    issue_id: id,
    actor_id: auth.account_id,
    actor_name: auth.username ?? null,
    activity_type: action === "verify" ? "resolved" : "reopened",
    old_value: "fixed",
    new_value: action === "verify" ? "verified" : "reopened",
    metadata: action === "verify"
      ? { by: "reporter" }
      : { by: "reporter", reason },
  });

  // Unify reopen with the discussion (issue: "reopen is separate from the
  // discussion"). Mirror the reopen reason into the thread as a comment so it
  // shows inline in the conversation, not only buried in the activity log.
  if (action === "reopen") {
    const { error: cErr } = await supabaseServer.from("qa_issue_comments").insert({
      tenant_id: auth.tenant_id,
      issue_id: id,
      user_id: auth.account_id,
      user_name: auth.username ?? null,
      user_role: "reporter",
      message: `Reopened — ${reason}`,
      is_internal_note: false,
      attachments: att.value,
    });
    if (cErr) console.error("[api/qa my-issues action reopen-comment]", cErr.message);
  }

  // Notify the assignee + admin watchers — never the actor.
  const actor = auth.username ?? "Reporter";
  const title = action === "verify"
    ? "Reporter verified the fix"
    : "Reporter reopened the issue";
  const messageBody = action === "verify"
    ? `${actor} confirmed the fix worked on "${issue.title}".`
    : `${actor} reopened "${issue.title}". Reason: ${reason}`;
  await notifyIssue(
    { tenantId: auth.tenant_id, issueId: id, actorId: auth.account_id, actorName: auth.username ?? null },
    [
      {
        recipientId: issue.assigned_to,
        type: action === "verify" ? "qa_issue_verified" as const : "qa_issue_reopened" as const,
        title,
        body: messageBody,
        link: issueLink(id),
        alert: action === "reopen",
      },
      ...await watcherTargets({
        tenantId: auth.tenant_id,
        issueId: id,
        actorId: auth.account_id,
        internal: false,
        type: action === "verify" ? "qa_issue_verified" : "qa_issue_reopened",
        title,
        body: messageBody,
      }),
    ],
  );

  return NextResponse.json({ ok: true, status: patch.status });
}
