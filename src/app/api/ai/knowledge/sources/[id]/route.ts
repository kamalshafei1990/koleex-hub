/* /api/ai/knowledge/sources/[id] — one source + its units (queue detail),
   bulk approve, delete. Super-admin gateway over RLS-deny tables. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { invalidateTaughtAnswersCache, invalidateApprovedSearchCache } from "@/lib/server/ai-knowledge";
import { dbError } from "@/lib/server/ai/http/api-error";

export const dynamic = "force-dynamic";

/* EVERY ROW IS ADDRESSED BY ID *AND* TENANT. The gate is super-admin only,
   but the rule the list route and qa/route.ts follow is one tenant's rows
   per caller, and a mutation keyed on the raw id alone was the one place it
   did not hold (audit, 2026-09-11). Written inline per query — a generic
   helper over the query builder sent the type checker into infinite
   instantiation. */
function tenantIs(tenantId: string | null | undefined): { column: "tenant_id"; value: string | null } {
  return { column: "tenant_id", value: tenantId ?? null };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const t = tenantIs(auth.tenant_id);
  let srcQ = supabaseServer.from("ai_sources").select("*").eq("id", id);
  srcQ = t.value === null ? srcQ.is(t.column, null) : srcQ.eq(t.column, t.value);
  let kuQ = supabaseServer
    .from("ai_knowledge_units")
    .select("id, seq, kind, title, body, locator, tags, trust_score, tokens, status, languages")
    .eq("source_id", id)
    .order("seq", { ascending: true });
  kuQ = t.value === null ? kuQ.is(t.column, null) : kuQ.eq(t.column, t.value);
  const [srcRes, kuRes] = await Promise.all([srcQ.maybeSingle(), kuQ]);
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
    const t = tenantIs(auth.tenant_id);
    let q = supabaseServer
      .from("ai_knowledge_units")
      .update({
        status,
        approved_by: status === "approved" ? auth.account_id ?? null : null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { count: "exact" })
      .eq("source_id", id)
      .eq("status", "draft");
    q = t.value === null ? q.is(t.column, null) : q.eq(t.column, t.value);
    const { error, count } = await q;
    if (error) return dbError("knowledge/sources/id", error);
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
    const t = tenantIs(auth.tenant_id);
    let q = supabaseServer
      .from("ai_sources")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id);
    q = t.value === null ? q.is(t.column, null) : q.eq(t.column, t.value);
    const { error } = await q;
    if (error) return dbError("knowledge/sources/id", error);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const t = tenantIs(auth.tenant_id);
  let q = supabaseServer.from("ai_sources").delete().eq("id", id);
  q = t.value === null ? q.is(t.column, null) : q.eq(t.column, t.value);
  const { error } = await q;
  if (error) return dbError("knowledge/sources/id", error);
  return NextResponse.json({ ok: true });
}
