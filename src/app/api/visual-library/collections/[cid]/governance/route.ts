import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/collections/[cid]/governance  (cid = uuid or slug)
   GET    → context rules for the collection (enriched with context).
   POST   → add a rule { context_id, rule }.
   DELETE → remove a rule (?rule_id=).
   (Style-rule fields + target_modules/platforms are edited via the
    collection PATCH endpoint.)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { RULE_KINDS } from "@/lib/visual-library/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RULES = new Set<string>(RULE_KINDS);

async function resolveId(cid: string, tid: string): Promise<string | null> {
  if (UUID.test(cid)) return cid;
  const { data } = await supabaseServer.from("visual_collections").select("id").eq("tenant_id", tid).eq("slug", cid).maybeSingle();
  return (data?.id as string) ?? null;
}

export async function GET(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rules } = await supabaseServer.from("visual_context_rules")
    .select("*").eq("tenant_id", auth.tenant_id).eq("entity_type", "collection").eq("entity_id", colId);
  const ctxIds = Array.from(new Set((rules ?? []).map((r) => r.context_id as string)));
  const ctxById: Record<string, unknown> = {};
  if (ctxIds.length) {
    const { data: ctxs } = await supabaseServer.from("visual_usage_contexts").select("id, slug, name, context_type").in("id", ctxIds);
    for (const c of ctxs ?? []) ctxById[c.id as string] = c;
  }
  return NextResponse.json({ rules: (rules ?? []).map((r) => ({ ...r, context: ctxById[r.context_id as string] ?? null })) });
}

export async function POST(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const contextId = typeof body.context_id === "string" ? body.context_id : "";
  const rule = typeof body.rule === "string" && RULES.has(body.rule) ? body.rule : "";
  if (!contextId || !rule) return NextResponse.json({ error: "context_id and valid rule required" }, { status: 400 });

  const { error } = await supabaseServer.from("visual_context_rules").upsert({
    tenant_id: auth.tenant_id, entity_type: "collection", entity_id: colId, context_id: contextId, rule,
    created_by: auth.account_id ?? null,
  }, { onConflict: "tenant_id,entity_type,entity_id,context_id,rule", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ruleId = new URL(req.url).searchParams.get("rule_id");
  if (!ruleId) return NextResponse.json({ error: "rule_id required" }, { status: 400 });
  const { error } = await supabaseServer.from("visual_context_rules")
    .delete().eq("id", ruleId).eq("tenant_id", auth.tenant_id).eq("entity_type", "collection").eq("entity_id", colId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
