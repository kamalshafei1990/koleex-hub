import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  STATUS_VALUES,
  PRIORITY_VALUES,
  RESOLVED_STATUSES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type IssueStatus,
  type Priority,
} from "@/lib/qa/types";
import { logActivity, type ActivityInput } from "@/lib/qa/activity";
import { notifyIssue, reporterIssueLink, type NotifyTarget, type QaNotificationType } from "@/lib/qa/notify";
import { watcherTargets } from "@/lib/qa/watchers";

const BUCKET = "qa-screenshots";

async function signScreenshot(tenantId: string, path: string | null): Promise<string | null> {
  if (!path || !path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Resolve assignee account ids → display names (one round-trip). */
async function nameMap(tenantId: string, ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const want = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (want.length === 0) return {};
  const { data } = await supabaseServer
    .from("accounts")
    .select("id, username, login_email")
    .eq("tenant_id", tenantId)
    .in("id", want);
  const out: Record<string, string> = {};
  for (const a of (data ?? []) as Array<{ id: string; username: string | null; login_email: string | null }>) {
    out[a.id] = a.username || a.login_email || "—";
  }
  return out;
}

/* GET /api/qa/reports/[id] — full detail (admins / management only). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const row = data as Record<string, unknown>;
  const names = await nameMap(auth.tenant_id, [row.assigned_to as string | null]);
  const report = {
    ...row,
    screenshot_url: await signScreenshot(auth.tenant_id, row.screenshot_url as string | null),
    assigned_to_name: row.assigned_to ? names[row.assigned_to as string] ?? null : null,
  };
  return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}

/* PATCH /api/qa/reports/[id] — workflow mutations (admins / management only).

   Supports, in one call:
     • status change            { status }
     • priority change          { priority }
     • (re)assignment           { assigned_to: uuid | null }
     • duplicate linking        { duplicate_of_issue_id: uuid | null }
     • reopen                   { action: "reopen", reopen_reason }
     • triage notes / commit    { developer_notes, resolution_summary, fixed_commit }
   Every meaningful change is mirrored into qa_issue_activity. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); // block QA workflow writes while in view-as mode
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  // Load current row first — we need old values to diff for the timeline.
  const { data: current, error: loadErr } = await supabaseServer
    .from("qa_issue_reports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const cur = current as Record<string, unknown>;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  const activities: Omit<ActivityInput, "tenant_id" | "issue_id" | "actor_id" | "actor_name">[] = [];

  // ── Reopen ────────────────────────────────────────────────────────────
  // Preserves prior resolution_summary / fixed_commit; only flips the status.
  if (body.action === "reopen") {
    // Only a resolved issue can be reopened — guards against inflating
    // reopen_count and emitting a spurious "reopened" event on a live issue.
    if (!(RESOLVED_STATUSES as string[]).includes(cur.status as string)) {
      return NextResponse.json({ error: "Only a resolved issue can be reopened." }, { status: 400 });
    }
    const reason = typeof body.reopen_reason === "string" ? body.reopen_reason.trim().slice(0, 2000) : null;
    patch.status = "reopened" satisfies IssueStatus;
    patch.reopened_at = now;
    patch.reopen_reason = reason;
    patch.reopen_count = (Number(cur.reopen_count) || 0) + 1;
    patch.resolved_at = null;
    activities.push({
      activity_type: "reopened",
      old_value: cur.status as string,
      new_value: "reopened",
      metadata: reason ? { reason } : {},
    });
  } else if (typeof body.status === "string") {
    // ── Status change ─────────────────────────────────────────────────
    if (!(STATUS_VALUES as string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    if (body.status !== cur.status) {
      patch.status = body.status;
      patch.resolved_at = (RESOLVED_STATUSES as string[]).includes(body.status) ? now : null;
      activities.push({
        activity_type: "status_changed",
        old_value: cur.status as string,
        new_value: body.status,
      });
    }
  }

  // ── Priority ──────────────────────────────────────────────────────────
  if (typeof body.priority === "string") {
    if (!(PRIORITY_VALUES as string[]).includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    }
    if (body.priority !== cur.priority) {
      patch.priority = body.priority;
      activities.push({
        activity_type: "priority_changed",
        old_value: (cur.priority as string) ?? "normal",
        new_value: body.priority,
      });
    }
  }

  // ── Assignment / reassignment ─────────────────────────────────────────
  if ("assigned_to" in body) {
    const next = (body.assigned_to as string | null) || null;
    const prev = (cur.assigned_to as string | null) || null;
    if (next !== prev) {
      // Validate the target is an account in this tenant.
      if (next) {
        const { data: acct } = await supabaseServer
          .from("accounts")
          .select("id, username, login_email")
          .eq("tenant_id", auth.tenant_id)
          .eq("id", next)
          .maybeSingle();
        if (!acct) return NextResponse.json({ error: "Assignee not found in this tenant." }, { status: 400 });
        patch.assigned_to = next;
        patch.assigned_at = now;
        patch.assigned_by = auth.account_id;
        activities.push({
          activity_type: "assigned",
          old_value: prev,
          new_value: next,
          metadata: {
            assignee_name:
              (acct as { username: string | null; login_email: string | null }).username ||
              (acct as { login_email: string | null }).login_email ||
              null,
          },
        });
      } else {
        patch.assigned_to = null;
        patch.assigned_at = null;
        patch.assigned_by = auth.account_id;
        activities.push({ activity_type: "unassigned", old_value: prev, new_value: null });
      }
    }
  }

  // ── Duplicate linking (manual) ────────────────────────────────────────
  if ("duplicate_of_issue_id" in body) {
    const next = (body.duplicate_of_issue_id as string | null) || null;
    const prev = (cur.duplicate_of_issue_id as string | null) || null;
    if (next !== prev) {
      if (next) {
        if (next === id) {
          return NextResponse.json({ error: "An issue can't duplicate itself." }, { status: 400 });
        }
        const { data: target } = await supabaseServer
          .from("qa_issue_reports")
          .select("id")
          .eq("tenant_id", auth.tenant_id)
          .eq("id", next)
          .maybeSingle();
        if (!target) return NextResponse.json({ error: "Target issue not found." }, { status: 400 });
        patch.duplicate_of_issue_id = next;
        // Marking a duplicate also moves it to the duplicate status.
        if (cur.status !== "duplicate") {
          patch.status = "duplicate";
          patch.resolved_at = now;
        }
        activities.push({ activity_type: "duplicate_marked", old_value: prev, new_value: next });
      } else {
        patch.duplicate_of_issue_id = null;
        activities.push({ activity_type: "duplicate_marked", old_value: prev, new_value: null });
      }
    }
  }

  // ── Triage notes / resolution / commit ────────────────────────────────
  if ("developer_notes" in body)
    patch.developer_notes = typeof body.developer_notes === "string" ? body.developer_notes.slice(0, 8000) : null;
  if ("resolution_summary" in body)
    patch.resolution_summary = typeof body.resolution_summary === "string" ? body.resolution_summary.slice(0, 4000) : null;
  if ("fixed_commit" in body) {
    const next = typeof body.fixed_commit === "string" ? body.fixed_commit.trim().slice(0, 120) : null;
    patch.fixed_commit = next || null;
    if (next && next !== (cur.fixed_commit as string | null)) {
      activities.push({ activity_type: "commit_added", old_value: (cur.fixed_commit as string | null) ?? null, new_value: next });
    }
  }

  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Mirror the changes into the timeline (best-effort).
  if (activities.length > 0) {
    await logActivity(
      activities.map((a) => ({
        ...a,
        tenant_id: auth.tenant_id,
        issue_id: id,
        actor_id: auth.account_id,
        actor_name: auth.username ?? null,
      })),
    );
  }

  /* ── Notifications (best-effort) ──────────────────────────────────────
     Derived from the final patch diff so ordering between branches never
     matters. notifyIssue suppresses the actor and dedupes per recipient. */
  {
    const actor = auth.username ?? "Someone";
    const title = (cur.title as string) ?? "an issue";
    const reporterId = (cur.reporter_id as string | null) ?? null;
    const reporterLink = reporterIssueLink(id); // reporters → safe read-only view
    const effectiveAssignee = ("assigned_to" in patch
      ? (patch.assigned_to as string | null)
      : (cur.assigned_to as string | null)) ?? null;
    const targets: NotifyTarget[] = [];
    // Watchers get one notification per PATCH for the primary change (first
    // wins); phrased in the third person (never "assigned you").
    let watcherEvt: { type: QaNotificationType; title: string; body: string; alert?: boolean } | null = null;

    if (body.action === "reopen") {
      const reason = (patch.reopen_reason as string | null) || null;
      const msg = `${actor} reopened "${title}"${reason ? `: ${reason}` : ""}`;
      targets.push({ recipientId: effectiveAssignee, type: "qa_issue_reopened", title: "Issue reopened", body: msg });
      targets.push({ recipientId: reporterId, type: "qa_issue_reopened", title: "Issue reopened", body: msg, link: reporterLink });
      watcherEvt ??= { type: "qa_issue_reopened", title: "Issue reopened", body: msg };
    } else if (patch.status && patch.status !== cur.status) {
      const newStatus = patch.status as IssueStatus;
      const type =
        newStatus === "verified" ? "qa_issue_verified"
        : newStatus === "closed" ? "qa_issue_closed"
        : newStatus === "duplicate" ? "qa_issue_duplicate_marked"
        : "qa_status_changed";
      const msg = `${actor} moved "${title}" to ${STATUS_LABEL[newStatus] ?? newStatus}`;
      const ntitle = `Status: ${STATUS_LABEL[newStatus] ?? newStatus}`;
      targets.push({ recipientId: reporterId, type, title: ntitle, body: msg, link: reporterLink });
      targets.push({ recipientId: effectiveAssignee, type, title: ntitle, body: msg });
      watcherEvt ??= { type, title: ntitle, body: msg };
    }

    if (patch.priority && patch.priority !== cur.priority) {
      const np = patch.priority as Priority;
      const pbody = `${actor} set "${title}" priority to ${PRIORITY_LABEL[np] ?? np}`;
      targets.push({
        recipientId: effectiveAssignee,
        type: "qa_priority_changed",
        title: `Priority: ${PRIORITY_LABEL[np] ?? np}`,
        body: pbody,
        alert: np === "urgent",
      });
      watcherEvt ??= { type: "qa_priority_changed", title: `Priority: ${PRIORITY_LABEL[np] ?? np}`, body: pbody, alert: np === "urgent" };
    }

    // New assignee (assigned or reassigned) — only when it actually changed.
    if ("assigned_to" in patch && patch.assigned_to) {
      const reassigned = !!(cur.assigned_to as string | null);
      targets.push({
        recipientId: patch.assigned_to as string,
        type: reassigned ? "qa_issue_reassigned" : "qa_issue_assigned",
        title: reassigned ? "Issue reassigned to you" : "Issue assigned to you",
        body: `${actor} assigned you "${title}"`,
      });
      watcherEvt ??= {
        type: reassigned ? "qa_issue_reassigned" : "qa_issue_assigned",
        title: reassigned ? "Issue reassigned" : "Issue assigned",
        body: `${actor} ${reassigned ? "reassigned" : "assigned"} "${title}"`,
      };
    }

    // Duplicate marked → tell the reporter.
    if ("duplicate_of_issue_id" in patch && patch.duplicate_of_issue_id) {
      const dmsg = `${actor} marked "${title}" as a duplicate`;
      targets.push({
        recipientId: reporterId,
        type: "qa_issue_duplicate_marked",
        title: "Marked as duplicate",
        body: dmsg,
        link: reporterLink,
      });
      watcherEvt ??= { type: "qa_issue_duplicate_marked", title: "Marked as duplicate", body: dmsg };
    }

    // Fan out the primary change to watchers (workflow events are never
    // internal). Appended last so notifyIssue keeps the more specific
    // reporter/assignee target for anyone who is also a watcher.
    if (watcherEvt) {
      targets.push(...await watcherTargets({
        tenantId: auth.tenant_id,
        issueId: id,
        actorId: auth.account_id,
        internal: false,
        ...watcherEvt,
      }));
    }

    if (targets.length > 0) {
      await notifyIssue(
        { tenantId: auth.tenant_id, issueId: id, actorId: auth.account_id, actorName: auth.username ?? null },
        targets,
      );
    }
  }

  const row = data as Record<string, unknown>;
  const names = await nameMap(auth.tenant_id, [row.assigned_to as string | null]);
  const report = {
    ...row,
    screenshot_url: await signScreenshot(auth.tenant_id, row.screenshot_url as string | null),
    assigned_to_name: row.assigned_to ? names[row.assigned_to as string] ?? null : null,
  };
  return NextResponse.json({ report });
}
