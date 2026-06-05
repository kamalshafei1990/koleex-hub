import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import {
  ISSUE_TYPE_VALUES,
  SEVERITY_VALUES,
  STATUS_VALUES,
  moduleForRoute,
  type IssueType,
  type Severity,
  type IssueStatus,
} from "@/lib/qa/types";

const BUCKET = "qa-screenshots";

/* Resolve a stored screenshot path (within this tenant) to a short-lived
   signed URL. Returns null on any failure so the row still renders. */
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

  const route = clampStr(body.route, 300);
  // Trust the client's screenshot path only if it's under THIS tenant's prefix.
  const rawPath = clampStr(body.screenshot_path, 400);
  const screenshotPath = rawPath && rawPath.startsWith(`${auth.tenant_id}/`) ? rawPath : null;

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
    title,
    description: clampStr(body.description, 6000),
    expected_result: clampStr(body.expected_result, 4000),
    suggested_solution: clampStr(body.suggested_solution, 4000),
    screenshot_url: screenshotPath,
    browser_info: clampStr(body.browser_info, 400),
    device_info: clampStr(body.device_info, 400),
    screen_size: clampStr(body.screen_size, 40),
    language: clampStr(body.language, 20),
    timezone: clampStr(body.timezone, 60),
    status: "new" as IssueStatus,
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
  const module = url.searchParams.get("module");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  let query = supabaseServer
    .from("qa_issue_reports")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (module) query = query.eq("app_module", module);
  if (severity && (SEVERITY_VALUES as string[]).includes(severity)) query = query.eq("severity", severity);
  if (status && (STATUS_VALUES as string[]).includes(status)) query = query.eq("status", status);
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
  const reports = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      screenshot_url: await signScreenshot(auth.tenant_id, r.screenshot_url as string | null),
    })),
  );

  // Module facet list for the filter dropdown.
  const modules = Array.from(
    new Set(rows.map((r) => r.app_module as string | null).filter(Boolean) as string[]),
  ).sort();

  return NextResponse.json(
    { reports, modules },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
