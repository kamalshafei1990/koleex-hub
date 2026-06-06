import "server-only";

/* ---------------------------------------------------------------------------
   Reporter-safe QA issue API (Phase 4.1).

   A non-admin reporter can read THEIR OWN issue and reply publicly — without
   the admin console, internal notes, developer controls, or workflow mutation.
   All filtering is server-side: this endpoint never returns internal notes,
   developer_notes, or admin-only debug metadata, regardless of the client.

   Access: the caller must be the issue's reporter, OR a Super Admin (so admins
   can preview the reporter experience). Anyone else gets 404 — we don't leak
   the existence of issues that aren't yours.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logActivity } from "@/lib/qa/activity";
import { notifyIssue, parseMentions, resolveMentionedAccounts, issueLink } from "@/lib/qa/notify";
import { sanitizeAttachments, signAttachments } from "@/lib/qa/attachments";
import { watcherTargets } from "@/lib/qa/watchers";
import { loadFixEvidence } from "@/lib/qa/evidence";

const BUCKET = "qa-screenshots";

async function signScreenshot(tenantId: string, path: string | null): Promise<string | null> {
  if (!path || !path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Load the issue if the caller is allowed to see it (owner or admin). */
async function loadOwnedIssue(
  tenantId: string,
  issueId: string,
  accountId: string,
  isAdmin: boolean,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabaseServer
    .from("qa_issue_reports")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", issueId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (!isAdmin && row.reporter_id !== accountId) return null;
  return row;
}

/* GET /api/qa/my-issues/[id] — sanitized issue + PUBLIC comments + PUBLIC timeline. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const row = await loadOwnedIssue(auth.tenant_id, id, auth.account_id, auth.is_super_admin);
  if (!row) {
    // Covers deleted issue AND not-your-issue — same response, no existence leak.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Assignee display name (no id leak needed, just a label).
  let assignedToName: string | null = null;
  if (row.assigned_to) {
    const { data: acct } = await supabaseServer
      .from("accounts")
      .select("username, login_email")
      .eq("tenant_id", auth.tenant_id)
      .eq("id", row.assigned_to as string)
      .maybeSingle();
    if (acct) assignedToName = (acct as { username: string | null; login_email: string | null }).username
      || (acct as { login_email: string | null }).login_email || null;
  }

  // PUBLIC comments only — internal notes (and their attachments) are filtered
  // out in the query, so the reporter can never receive internal images.
  const { data: cmtRows } = await supabaseServer
    .from("qa_issue_comments")
    .select("id, user_name, user_role, message, attachments, created_at, edited_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("issue_id", id)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true })
    .limit(500);
  const cmts = await Promise.all(
    (cmtRows ?? []).map(async (c) => ({
      ...(c as Record<string, unknown>),
      attachments: await signAttachments(auth.tenant_id, (c as { attachments: unknown }).attachments),
    })),
  );

  // PUBLIC timeline — workflow events the reporter should see; internal-note
  // comment events are hidden.
  const { data: acts } = await supabaseServer
    .from("qa_issue_activity")
    .select("id, actor_name, activity_type, old_value, new_value, metadata, created_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("issue_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  const publicActivity = (acts ?? []).filter((a) => {
    const r = a as { activity_type: string; metadata: Record<string, unknown> | null };
    if (r.activity_type === "comment_added" && r.metadata && r.metadata.is_internal_note === true) return false;
    // Watcher add/remove is internal noise — reporters never see who is watching.
    if (r.activity_type === "watcher_added" || r.activity_type === "watcher_removed") return false;
    return true;
  });

  // Whitelisted, reporter-safe projection — NO developer_notes / debug metadata.
  const issue = {
    id: row.id,
    title: row.title,
    description: row.description,
    expected_result: row.expected_result,
    suggested_solution: row.suggested_solution,
    issue_type: row.issue_type,
    severity: row.severity,
    priority: row.priority,
    status: row.status,
    app_module: row.app_module,
    route: row.route,
    page_title: row.page_title,
    screenshot_url: await signScreenshot(auth.tenant_id, row.screenshot_url as string | null),
    resolution_summary: row.resolution_summary,
    fixed_commit: row.fixed_commit,
    assigned_to_name: assignedToName,
    reopen_count: row.reopen_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
    is_admin_view: auth.is_super_admin && row.reporter_id !== auth.account_id,
  };

  // Phase 9.2 — reporter sees BEFORE (their original screenshots, already on
  // the issue object) and AFTER (every cycle's after_attachments). We attach
  // the original report screenshot_urls too so the UI doesn't need a separate
  // call to map BEFORE → cycle.
  const fix_evidence = await loadFixEvidence(auth.tenant_id, id);
  // Also expose the original report's multi-shot URLs as the BEFORE set.
  const beforeRaw = Array.isArray(row.screenshot_urls) ? (row.screenshot_urls as unknown[]) : [];
  const beforeUrls: string[] = [];
  for (const p of beforeRaw) {
    if (typeof p !== "string") continue;
    const u = await signScreenshot(auth.tenant_id, p);
    if (u) beforeUrls.push(u);
  }
  if (beforeUrls.length === 0 && issue.screenshot_url) beforeUrls.push(issue.screenshot_url);

  return NextResponse.json(
    { issue, comments: cmts, activity: publicActivity, fix_evidence, before_urls: beforeUrls },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/* POST /api/qa/my-issues/[id] — reporter adds a PUBLIC reply (own issue only).
   is_internal_note is forced false server-side; the client cannot make a
   reporter reply internal, and reporters have no workflow mutation here. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const issue = await loadOwnedIssue(auth.tenant_id, id, auth.account_id, auth.is_super_admin);
  if (!issue) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const att = sanitizeAttachments(auth.tenant_id, body?.attachments);
  if (!att.ok) return NextResponse.json({ error: att.error }, { status: 400 });
  if (!message && att.value.length === 0) {
    return NextResponse.json({ error: "A message or an image is required." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("qa_issue_comments")
    .insert({
      tenant_id: auth.tenant_id,
      issue_id: id,
      user_id: auth.account_id,
      user_name: auth.username ?? null,
      user_role: "Reporter",
      message: message.slice(0, 8000),
      is_internal_note: false, // hard-forced — reporter replies are always public
      attachments: att.value,
    })
    .select("id, user_name, user_role, message, attachments, created_at, edited_at")
    .single();
  if (error) {
    console.error("[api/qa my-issues POST]", error.message);
    return NextResponse.json({ error: "Couldn't post the reply." }, { status: 500 });
  }
  const hasAttachment = att.value.length > 0;

  await supabaseServer
    .from("qa_issue_reports")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  await logActivity({
    tenant_id: auth.tenant_id,
    issue_id: id,
    actor_id: auth.account_id,
    actor_name: auth.username ?? null,
    activity_type: "comment_added",
    metadata: { is_internal_note: false },
  });

  // Notify the dev side (assignee + any @mentions) — never the actor. The
  // assignee gets the admin-console link.
  const mentioned = await resolveMentionedAccounts(auth.tenant_id, parseMentions(message));
  const actor = auth.username ?? "Reporter";
  const suffix = hasAttachment ? " (with image)" : "";
  await notifyIssue(
    { tenantId: auth.tenant_id, issueId: id, actorId: auth.account_id, actorName: auth.username ?? null },
    [
      ...mentioned.map((u) => ({
        recipientId: u.id,
        type: "qa_issue_mentioned" as const,
        title: "You were mentioned",
        body: `${actor} mentioned you on "${issue.title as string}"${suffix}`,
        link: issueLink(id),
      })),
      {
        recipientId: issue.assigned_to as string | null,
        type: "qa_comment_added" as const,
        title: "Reporter replied",
        body: `${actor} replied on "${issue.title as string}"${suffix}`,
        link: issueLink(id),
      },
      // Watchers (reporter replies are public → no internal restriction).
      ...await watcherTargets({
        tenantId: auth.tenant_id,
        issueId: id,
        actorId: auth.account_id,
        internal: false,
        type: "qa_comment_added",
        title: "Reporter replied",
        body: `${actor} replied on "${issue.title as string}"${suffix}`,
      }),
    ],
  );

  const comment = {
    ...(data as Record<string, unknown>),
    attachments: await signAttachments(auth.tenant_id, (data as { attachments: unknown }).attachments),
  };
  return NextResponse.json({ comment }, { status: 201 });
}
