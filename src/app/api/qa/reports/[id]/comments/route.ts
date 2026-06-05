import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { logActivity } from "@/lib/qa/activity";

/* Confirm the issue exists in the caller's tenant. Returns the row or null. */
async function issueInTenant(tenantId: string, issueId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("qa_issue_reports")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", issueId)
    .maybeSingle();
  return !!data;
}

function roleLabel(auth: { is_super_admin: boolean; user_type: string | null }): string | null {
  if (auth.is_super_admin) return "Super Admin";
  return auth.user_type ?? null;
}

/* GET /api/qa/reports/[id]/comments — discussion thread (admins only). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  if (!(await issueInTenant(auth.tenant_id, id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { data, error } = await supabaseServer
    .from("qa_issue_comments")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("issue_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

/* POST /api/qa/reports/[id]/comments — add a reply / internal note. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  if (!(await issueInTenant(auth.tenant_id, id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const row = {
    tenant_id: auth.tenant_id,
    issue_id: id,
    user_id: auth.account_id,
    user_name: auth.username ?? null,
    user_role: roleLabel(auth),
    message: message.slice(0, 8000),
    is_internal_note: body?.is_internal_note === true,
  };

  const { data, error } = await supabaseServer
    .from("qa_issue_comments")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/qa comments POST]", error.message);
    return NextResponse.json({ error: "Couldn't post the comment." }, { status: 500 });
  }

  // Touch the parent so list ordering / "last activity" stays fresh, and log.
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
    metadata: { is_internal_note: row.is_internal_note },
  });

  return NextResponse.json({ comment: data }, { status: 201 });
}
