import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  ISSUE_TYPE_VALUES,
  SEVERITY_VALUES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  moduleForRoute,
  type IssueType,
  type Severity,
  type IssueStatus,
} from "@/lib/qa/types";
import { logActivity } from "@/lib/qa/activity";
import { notifyIssue, issueLink } from "@/lib/qa/notify";

const BUCKET = "qa-screenshots";

/* Resolve a stored screenshot path (within this tenant) to a short-lived
   signed URL. Returns null on any failure so the row still renders. */
/** Sign every screenshot path on the multi-shot array. Order preserved.
 *  Without this the list endpoint returned raw storage paths in
 *  `screenshot_urls`, which the admin viewer's gallery then tried to load
 *  as `<img src="490fbd4d-.../uuid.png">` — 404, broken image, alt text
 *  showing as "screenshot". */
async function signScreenshots(tenantId: string, paths: unknown): Promise<string[] | null> {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const out: string[] = [];
  for (const p of paths) {
    if (typeof p !== "string") continue;
    const u = await signScreenshot(tenantId, p);
    if (u) out.push(u);
  }
  return out.length > 0 ? out : null;
}
async function signScreenshot(tenantId: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  // Never sign a path that isn't under the caller's tenant prefix.
  if (!path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/* ── POST /api/qa/reports — submit a report (any authenticated user) ── */
export async function POST(req: Request) {
  // No `req` → reporting is allowed even while a Super Admin is viewing-as.
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const title = clampStr(body.title, 200);
  if (!title) return NextResponse.json({ error: "A short title is required." }, { status: 400 });

  const issueType = (ISSUE_TYPE_VALUES as string[]).includes(String(body.issue_type))
    ? (body.issue_type as IssueType)
    : "bug";
  const severity = (SEVERITY_VALUES as string[]).includes(String(body.severity))
    ? (body.severity as Severity)
    : "medium";
  // Reporter-chosen priority (issue bed8bed6). Defaults to "normal" if absent
  // or invalid; admins can still re-prioritise during triage.
  const priority = (PRIORITY_VALUES as string[]).includes(String(body.priority))
    ? (body.priority as string)
    : "normal";

  const route = clampStr(body.route, 300);
  // Trust client-supplied storage paths only if they live under THIS tenant's
  // prefix. Same rule for the single back-compat field and the multi-shot array.
  const isTenantPath = (p: unknown): p is string =>
    typeof p === "string" && p.length > 0 && p.startsWith(`${auth.tenant_id}/`);
  const rawPath = clampStr(body.screenshot_path, 400);
  const screenshotPath = isTenantPath(rawPath) ? rawPath : null;
  const screenshotPathsArr: string[] = Array.isArray(body.screenshot_paths)
    ? (body.screenshot_paths as unknown[])
        .slice(0, 10)
        .filter(isTenantPath)
        .map((p) => p.slice(0, 400))
    : [];
  // If only the array was sent, mirror the first entry into the scalar field
  // so consumers that read screenshot_url keep working unchanged.
  const screenshotPathFinal = screenshotPath ?? (screenshotPathsArr[0] ?? null);
  const screenshotPathsFinal = screenshotPathsArr.length > 0 ? screenshotPathsArr : null;

  const row = {
    tenant_id: auth.tenant_id,
    reporter_id: auth.account_id,
    reporter_name: auth.username ?? null,
    reporter_email: auth.login_email ?? null,
    app_module: clampStr(body.app_module, 80) ?? moduleForRoute(route),
    route,
    page_title: clampStr(body.page_title, 200),
    issue_type: issueType,
    severity,
    priority,
    title,
    description: clampStr(body.description, 6000),
    expected_result: clampStr(body.expected_result, 4000),
    suggested_solution: clampStr(body.suggested_solution, 4000),
    screenshot_url: screenshotPathFinal,
    screenshot_urls: screenshotPathsFinal,
    browser_info: clampStr(body.browser_info, 400),
    device_info: clampStr(body.device_info, 400),
    screen_size: clampStr(body.screen_size, 40),
    language: clampStr(body.language, 20),
    timezone: clampStr(body.timezone, 60),
    status: "new" as IssueStatus,
    // Phase-2 component inspection metadata.
    component_name: clampStr(body.component_name, 120),
    component_module: clampStr(body.component_module, 80),
    component_section: clampStr(body.component_section, 120),
    component_record_id: clampStr(body.component_record_id, 120),
    component_rect:
      body.component_rect && typeof body.component_rect === "object" && !Array.isArray(body.component_rect)
        ? body.component_rect
        : null,
    component_styles:
      body.component_styles && typeof body.component_styles === "object" && !Array.isArray(body.component_styles)
        ? body.component_styles
        : null,
    // Multi-select: the reporter can pick several components in one report.
    // The scalar component_* fields mirror the first entry for back-compat with
    // any consumer that hasn't been updated yet. Cap at 20 to keep payloads sane.
    components:
      Array.isArray(body.components) && body.components.length > 0
        ? (body.components as unknown[]).slice(0, 20).filter((c) => c && typeof c === "object" && !Array.isArray(c))
        : null,
    // Future-ready fields (accepted if a client sends them; UI not wired yet).
    component_path: clampStr(body.component_path, 300),
    data_entity: clampStr(body.data_entity, 80),
    db_table: clampStr(body.db_table, 80),
    repro_steps: clampStr(body.repro_steps, 6000),
    session_id: clampStr(body.session_id, 80),
  };

  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("[api/qa/reports POST]", error.message);
    return NextResponse.json({ error: "Couldn't save the report." }, { status: 500 });
  }

  // Seed the activity timeline with the creation event (best-effort).
  await logActivity({
    tenant_id: auth.tenant_id,
    issue_id: data.id,
    actor_id: auth.account_id,
    actor_name: auth.username ?? null,
    activity_type: "created",
    new_value: title,
  });

  // Auto-add the reporter as a watcher so they receive every update on
  // their own issue without having to opt in. Best-effort — a duplicate
  // (already-watching) error is silently swallowed by the unique index.
  try {
    await supabaseServer
      .from("qa_issue_watchers")
      .insert({ tenant_id: auth.tenant_id, issue_id: data.id, account_id: auth.account_id })
      .select("issue_id");
  } catch { /* unique-constraint or RLS quirk — no-op */ }

  // Notification fan-out. Every Super Admin in the tenant is told a new
  // issue was filed (so the QA owners see it without manually polling),
  // and the reporter themselves never gets self-notified (the notify
  // helper drops the actor automatically). Best-effort: a notify failure
  // must not break the report submission.
  try {
    const { data: admins } = await supabaseServer
      .from("accounts")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("status", "active")
      .eq("is_super_admin", true);
    const reporter = auth.username ?? auth.login_email ?? "Someone";
    const moduleLabel = clampStr(body.app_module, 80) ?? moduleForRoute(route);
    const subject = `New issue: ${title}`;
    const messageBody = `${reporter} filed "${title}" on ${moduleLabel}${route ? ` (${route})` : ""}.`;
    await notifyIssue(
      { tenantId: auth.tenant_id, issueId: data.id, actorId: auth.account_id, actorName: auth.username ?? null },
      (admins ?? []).map((a) => ({
        recipientId: a.id,
        type: "qa_issue_assigned" as const,   // closest existing type; UI surfaces it as a task chip
        title: subject,
        body: messageBody,
        link: issueLink(data.id),
      })),
    );
  } catch (e) {
    console.error("[api/qa/reports POST notify]", e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

/* ── GET /api/qa/reports — list (admins / management only) ── */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised to view issue reports." }, { status: 403 });
  }

  const url = new URL(req.url);
  const p = url.searchParams;
  const module = p.get("module");
  const severity = p.get("severity");
  const status = p.get("status");
  const priority = p.get("priority");
  const assignee = p.get("assignee");           // account id | "unassigned"
  const reporter = p.get("reporter");           // reporter account id
  const claudeReady = p.get("claude_ready");    // "1" | "0"
  const duplicate = p.get("duplicate");         // "1" (only duplicates) | "0" (exclude)
  const from = p.get("from");                   // ISO date (created_at >=)
  const to = p.get("to");                       // ISO date (created_at <=)
  const q = (p.get("q") ?? "").trim();

  let query = supabaseServer
    .from("qa_issue_reports")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (module) query = query.eq("app_module", module);
  if (severity && (SEVERITY_VALUES as string[]).includes(severity)) query = query.eq("severity", severity);
  if (status && (STATUS_VALUES as string[]).includes(status)) query = query.eq("status", status);
  if (priority && (PRIORITY_VALUES as string[]).includes(priority)) query = query.eq("priority", priority);
  if (assignee === "unassigned") query = query.is("assigned_to", null);
  else if (assignee) query = query.eq("assigned_to", assignee);
  if (reporter) query = query.eq("reporter_id", reporter);
  if (claudeReady === "1") query = query.eq("claude_ready", true);
  else if (claudeReady === "0") query = query.eq("claude_ready", false);
  if (duplicate === "1") query = query.not("duplicate_of_issue_id", "is", null);
  else if (duplicate === "0") query = query.is("duplicate_of_issue_id", null);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (q) {
    const s = q.replace(/[%_]/g, "\\$&");
    query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/qa/reports GET]", error.message);
    return NextResponse.json({ error: "Couldn't load reports." }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const ids = rows.map((r) => r.id as string);

  // Hydrate assignee display names (one round-trip).
  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assigned_to as string | null).filter(Boolean) as string[]),
  );
  const nameById: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: accts } = await supabaseServer
      .from("accounts")
      .select("id, username, login_email")
      .eq("tenant_id", auth.tenant_id)
      .in("id", assigneeIds);
    for (const a of (accts ?? []) as Array<{ id: string; username: string | null; login_email: string | null }>) {
      nameById[a.id] = a.username || a.login_email || "—";
    }
  }

  // Hydrate comment counts (one round-trip, counted in JS).
  const commentCount: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: cmts } = await supabaseServer
      .from("qa_issue_comments")
      .select("issue_id")
      .eq("tenant_id", auth.tenant_id)
      .in("issue_id", ids);
    for (const c of (cmts ?? []) as Array<{ issue_id: string }>) {
      commentCount[c.issue_id] = (commentCount[c.issue_id] ?? 0) + 1;
    }
  }

  const reports = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      screenshot_url: await signScreenshot(auth.tenant_id, r.screenshot_url as string | null),
      // Sign every entry on the multi-shot array as well — previously this
      // came through as raw storage paths so the admin viewer's gallery
      // tried to <img src="490fbd4d-.../uuid.png"> and 404'd. (Bug from QA
      // report 46dba6b3.)
      screenshot_urls: await signScreenshots(auth.tenant_id, r.screenshot_urls),
      assigned_to_name: r.assigned_to ? nameById[r.assigned_to as string] ?? null : null,
      comment_count: commentCount[r.id as string] ?? 0,
    })),
  );

  // Facets for filter dropdowns.
  const modules = Array.from(
    new Set(rows.map((r) => r.app_module as string | null).filter(Boolean) as string[]),
  ).sort();
  const assignees = assigneeIds
    .map((id) => ({ id, name: nameById[id] ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { reports, modules, assignees },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
