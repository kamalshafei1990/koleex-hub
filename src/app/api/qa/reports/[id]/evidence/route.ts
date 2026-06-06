import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/reports/[id]/evidence — Phase 9.2 fix evidence.

   Admins/developers (is_super_admin) attach AFTER screenshots + a fix
   summary / commit / PR link to a report. Each call creates a new row in
   qa_fix_evidence; multiple cycles supported (fix → reopen → fix again).

   The request body uses paths that were already uploaded via the existing
   POST /api/qa/upload endpoint — we don't replicate the upload pipeline.

   On success: optionally flips the issue status to 'fixed' (if it isn't
   already), logs activity, and notifies the reporter + watchers via the
   existing notifyIssue helper.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logActivity } from "@/lib/qa/activity";
import { notifyIssue, issueLink } from "@/lib/qa/notify";
import { watcherTargets } from "@/lib/qa/watchers";

interface AttachmentIn {
  path: unknown;
  type?: unknown;
  size?: unknown;
  label?: unknown;
}

function clean(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const summary    = clean(body.summary, 4000);
  const commitHash = clean(body.commit_hash, 80);
  const prLink     = clean(body.pr_link, 500);

  const rawAtts = Array.isArray(body.after_attachments) ? (body.after_attachments as AttachmentIn[]) : [];
  // Reject paths from other tenants — defence in depth on top of RLS.
  const tenantPrefix = `${auth.tenant_id}/`;
  const attachments = rawAtts
    .filter((a) => typeof a?.path === "string" && (a.path as string).startsWith(tenantPrefix))
    .slice(0, 12)  // sane cap per cycle
    .map((a) => ({
      path:  a.path  as string,
      type:  typeof a.type  === "string" ? (a.type  as string).slice(0, 80) : null,
      size:  typeof a.size  === "number" ? a.size : null,
      label: typeof a.label === "string" ? (a.label as string).slice(0, 200) : null,
    }));

  if (attachments.length === 0 && !summary && !commitHash && !prLink) {
    return NextResponse.json(
      { error: "Provide at least one screenshot, a summary, a commit, or a PR link." },
      { status: 400 },
    );
  }

  // Load issue (tenant guard + reporter for the notify).
  const { data: issue, error: issueErr } = await supabaseServer
    .from("qa_issue_reports")
    .select("id, tenant_id, title, status, reporter_id, assigned_to")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", id)
    .maybeSingle();
  if (issueErr) {
    console.error("[api/qa evidence read issue]", issueErr.message);
    return NextResponse.json({ error: "Read failed." }, { status: 500 });
  }
  if (!issue) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Compute the next cycle number — count existing rows, +1. Race-tolerant
  // because two concurrent writes would just produce two rows with the same
  // cycle, which the UI handles by display order on created_at.
  const { count: prior } = await supabaseServer
    .from("qa_fix_evidence")
    .select("id", { count: "exact", head: true })
    .eq("issue_id", id);
  const cycle = (prior ?? 0) + 1;

  const insert = {
    tenant_id: auth.tenant_id,
    issue_id: id,
    cycle_number: cycle,
    summary,
    commit_hash: commitHash,
    pr_link: prLink,
    after_attachments: attachments,
    created_by: auth.account_id,
    created_by_name: auth.username ?? null,
  };

  const { data: created, error: insErr } = await supabaseServer
    .from("qa_fix_evidence")
    .insert(insert)
    .select("id")
    .single();
  if (insErr) {
    console.error("[api/qa evidence insert]", insErr.message);
    return NextResponse.json({ error: "Could not save evidence." }, { status: 500 });
  }

  // Flip status to 'fixed' if it isn't already, and stamp resolved_at +
  // fixed_commit. Doesn't regress a 'verified' issue.
  const promoteStatuses = new Set(["new", "triaged", "in_progress", "needs_more_info", "reopened"]);
  if (promoteStatuses.has(issue.status)) {
    await supabaseServer
      .from("qa_issue_reports")
      .update({
        status: "fixed",
        fixed_commit: commitHash ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id);
    await logActivity({
      tenant_id: auth.tenant_id,
      issue_id: id,
      actor_id: auth.account_id,
      actor_name: auth.username ?? null,
      activity_type: "status_changed",
      old_value: issue.status,
      new_value: "fixed",
      metadata: { source: "fix-evidence", cycle, evidence_id: created.id },
    });
  }

  // Always log a comment-style activity so the timeline records the new cycle.
  await logActivity({
    tenant_id: auth.tenant_id,
    issue_id: id,
    actor_id: auth.account_id,
    actor_name: auth.username ?? null,
    activity_type: "comment_added",
    new_value: `Cycle ${cycle} evidence`,
    metadata: { source: "fix-evidence", cycle, evidence_id: created.id, kind: "evidence_added" },
  });

  // Notify reporter + watchers. notifyIssue dedupes + self-suppresses.
  const title = `Fix evidence added (cycle ${cycle})`;
  const message = `${auth.username ?? "Admin"} attached fix evidence for "${issue.title}". Open to compare BEFORE / AFTER.`;
  const watchers = await watcherTargets({
    tenantId: auth.tenant_id,
    issueId: id,
    actorId: auth.account_id,
    internal: false,
    type: "qa_status_changed",
    title,
    body: message,
  });
  const targets = [
    // Reporter always gets it, pointed at their reporter-safe view.
    ...(issue.reporter_id && issue.reporter_id !== auth.account_id
      ? [{
          recipientId: issue.reporter_id,
          type: "qa_status_changed" as const,
          title,
          body: message,
          link: `/qa/report/${id}`,
        }]
      : []),
    ...watchers,
  ];
  await notifyIssue(
    { tenantId: auth.tenant_id, issueId: id, actorId: auth.account_id, actorName: auth.username ?? null },
    targets,
  );

  return NextResponse.json({ id: created.id, cycle }, { status: 201 });
}
