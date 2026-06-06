import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/qa/reports/bulk — apply one workflow change to many issues.

   Body shape:
     { ids: string[], change: { status? | priority? | assigned_to? } }

   Admin-only, tenant-scoped, single batched update (no N+1). Each meaningful
   change is mirrored into qa_issue_activity for traceability — same shape as
   the per-issue PATCH route writes — but kept light: no notifications fan-out
   on bulk ops (that would flood inboxes); the per-issue PATCH is still the
   path for "I want everyone notified".
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  STATUS_VALUES,
  PRIORITY_VALUES,
  type ActivityType,
  type IssueStatus,
  type Priority,
} from "@/lib/qa/types";
import { logActivity } from "@/lib/qa/activity";

const MAX_IDS = 200;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids[] required" }, { status: 400 });
  }

  const change = (body.change ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let activityKind: ActivityType | null = null;
  let activityTo: string | null = null;

  if (typeof change.status === "string" && (STATUS_VALUES as string[]).includes(change.status)) {
    patch.status = change.status as IssueStatus;
    activityKind = "status_changed";
    activityTo = change.status as string;
  } else if (typeof change.priority === "string" && (PRIORITY_VALUES as string[]).includes(change.priority)) {
    patch.priority = change.priority as Priority;
    activityKind = "priority_changed";
    activityTo = change.priority as string;
  } else if ("assigned_to" in change) {
    // null = unassign; uuid = assign to that account.
    const v = change.assigned_to;
    if (v === null) {
      patch.assigned_to = null;
      patch.assigned_at = null;
      patch.assigned_by = null;
      activityKind = "assigned";
      activityTo = null;
    } else if (typeof v === "string" && v.length > 0) {
      patch.assigned_to = v;
      patch.assigned_at = new Date().toISOString();
      patch.assigned_by = auth.account_id;
      activityKind = "assigned";
      activityTo = v;
    } else {
      return NextResponse.json({ error: "assigned_to must be a uuid or null" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "change must include status | priority | assigned_to" }, { status: 400 });
  }

  // Read current rows so the activity log captures the FROM value per issue.
  const { data: before, error: readErr } = await supabaseServer
    .from("qa_issue_reports")
    .select("id, status, priority, assigned_to")
    .eq("tenant_id", auth.tenant_id)
    .in("id", ids);
  if (readErr) {
    console.error("[api/qa/reports/bulk read]", readErr.message);
    return NextResponse.json({ error: "Read failed." }, { status: 500 });
  }
  const beforeById = new Map<string, { status: string; priority: string; assigned_to: string | null }>();
  for (const r of (before ?? []) as Array<{ id: string; status: string; priority: string; assigned_to: string | null }>) {
    beforeById.set(r.id, { status: r.status, priority: r.priority, assigned_to: r.assigned_to });
  }
  const validIds = Array.from(beforeById.keys());
  if (validIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error: upErr } = await supabaseServer
    .from("qa_issue_reports")
    .update(patch)
    .eq("tenant_id", auth.tenant_id)
    .in("id", validIds);
  if (upErr) {
    console.error("[api/qa/reports/bulk update]", upErr.message);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  // Best-effort activity log per issue. Failures are swallowed so a slow
  // activity write doesn't block the bulk acknowledgement.
  await Promise.allSettled(
    validIds.map((id) => {
      const prev = beforeById.get(id)!;
      const kind = activityKind!;
      const from =
        kind === "status_changed" ? prev.status :
        kind === "priority_changed" ? prev.priority :
        prev.assigned_to;
      return logActivity({
        tenant_id: auth.tenant_id,
        issue_id: id,
        actor_id: auth.account_id,
        actor_name: auth.username ?? null,
        activity_type: kind,
        old_value: from,
        new_value: activityTo,
        metadata: { source: "bulk" },
      });
    }),
  );

  return NextResponse.json({ ok: true, updated: validIds.length });
}
