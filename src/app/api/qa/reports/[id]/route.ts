import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { STATUS_VALUES } from "@/lib/qa/types";

const BUCKET = "qa-screenshots";

async function signScreenshot(tenantId: string, path: string | null): Promise<string | null> {
  if (!path || !path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
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
  const report = {
    ...data,
    screenshot_url: await signScreenshot(auth.tenant_id, (data as { screenshot_url: string | null }).screenshot_url),
  };
  return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
}

/* PATCH /api/qa/reports/[id] — triage / resolve (admins / management only). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.status === "string") {
    if (!(STATUS_VALUES as string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    patch.status = body.status;
    // Stamp resolved_at when moving into a terminal state; clear it otherwise.
    patch.resolved_at = ["fixed", "rejected", "duplicate", "closed"].includes(body.status)
      ? new Date().toISOString()
      : null;
  }
  if ("assigned_to" in body) patch.assigned_to = body.assigned_to || null;
  if ("developer_notes" in body)
    patch.developer_notes = typeof body.developer_notes === "string" ? body.developer_notes.slice(0, 8000) : null;
  if ("resolution_summary" in body)
    patch.resolution_summary = typeof body.resolution_summary === "string" ? body.resolution_summary.slice(0, 4000) : null;
  if ("fixed_commit" in body)
    patch.fixed_commit = typeof body.fixed_commit === "string" ? body.fixed_commit.trim().slice(0, 120) : null;

  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const report = {
    ...data,
    screenshot_url: await signScreenshot(auth.tenant_id, (data as { screenshot_url: string | null }).screenshot_url),
  };
  return NextResponse.json({ report });
}
