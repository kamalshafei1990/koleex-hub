/* /api/ai/knowledge/sources/[id] — one source + its units (queue detail),
   bulk approve, delete. Super-admin gateway over RLS-deny tables. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { invalidateTaughtAnswersCache, invalidateApprovedSearchCache } from "@/lib/server/ai-knowledge";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const [srcRes, kuRes] = await Promise.all([
    supabaseServer.from("ai_sources").select("*").eq("id", id).maybeSingle(),
    supabaseServer
      .from("ai_knowledge_units")
      .select("id, seq, kind, title, body, locator, tags, trust_score, tokens, status, languages")
      .eq("source_id", id)
      .order("seq", { ascending: true }),
  ]);
  if (!srcRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ source: srcRes.data, units: kuRes.data ?? [] });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  /* Bulk transition for the whole source's DRAFT queue. */
  if (body.action === "approve_all" || body.action === "retire_all") {
    const status = body.action === "approve_all" ? "approved" : "retired";
    const { error, count } = await supabaseServer
      .from("ai_knowledge_units")
      .update({
        status,
        approved_by: status === "approved" ? auth.account_id ?? null : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { count: "exact" })
      .eq("source_id", id)
      .eq("status", "draft");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    /* THE AI'S VIEW OF TRUTH JUST CHANGED, SO DROP WHAT IT CACHED.
       Both planes, not one: taught pairs feed the written lanes' prompt and the
       approved-search cache feeds search_knowledge, which is the ONLY route a
       voice call has to any of this. Invalidating one left the owner teaching
       something, hearing the chat box use it, and hearing a call not — for a
       minute, which is long enough to look permanent and be reported as broken. */
    invalidateTaughtAnswersCache(auth.tenant_id ?? null);
    invalidateApprovedSearchCache(auth.tenant_id ?? null);
    return NextResponse.json({ updated: count ?? 0 });
  }
  if (body.status && ["archived", "ready"].includes(body.status)) {
    const { error } = await supabaseServer
      .from("ai_sources")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const { error } = await supabaseServer.from("ai_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
