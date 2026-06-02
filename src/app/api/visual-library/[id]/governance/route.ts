import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/governance
   GET    → context rules (allowed/forbidden/preferred) + violations +
            per-collection compatibility scores.
   POST   → add a rule { context_id, rule }.
   DELETE → remove a rule (?rule_id=).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { compatibilityScore, assetViolations } from "@/lib/visual-library/governance";
import { logVisualAssetEvent } from "@/lib/visual-library/events";
import { RULE_KINDS } from "@/lib/visual-library/types";

const RULES = new Set<string>(RULE_KINDS);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const [{ data: asset }, { data: rules }, { data: links }] = await Promise.all([
    supabaseServer.from("visual_assets").select("style, asset_type, approval_status, svg_path").eq("id", id).eq("tenant_id", tid).maybeSingle(),
    supabaseServer.from("visual_context_rules").select("*").eq("tenant_id", tid).eq("entity_type", "asset").eq("entity_id", id),
    supabaseServer.from("visual_collection_assets").select("collection_id").eq("tenant_id", tid).eq("asset_id", id),
  ]);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrich rules with their context.
  const ctxIds = Array.from(new Set((rules ?? []).map((r) => r.context_id as string)));
  const ctxById: Record<string, unknown> = {};
  if (ctxIds.length) {
    const { data: ctxs } = await supabaseServer.from("visual_usage_contexts").select("id, slug, name, context_type, icon, color").in("id", ctxIds);
    for (const c of ctxs ?? []) ctxById[c.id as string] = c;
  }
  const enriched = (rules ?? []).map((r) => ({ ...r, context: ctxById[r.context_id as string] ?? null }));
  const forbiddenNames = enriched.filter((r) => r.rule === "forbidden").map((r) => (r.context as { name?: string } | null)?.name ?? "context");

  // Member collections (for compatibility + style-mismatch violations).
  const colIds = Array.from(new Set((links ?? []).map((l) => l.collection_id as string)));
  let collections: { id: string; name: string; preferred_style: string | null; preferred_monochrome: boolean | null }[] = [];
  if (colIds.length) {
    const { data: cols } = await supabaseServer.from("visual_collections").select("id, name, preferred_style, preferred_monochrome").in("id", colIds);
    collections = (cols ?? []) as typeof collections;
  }
  const compatibility = collections.map((c) => ({ collection_id: c.id, name: c.name, score: compatibilityScore(asset as never, c as never) }));
  const violations = assetViolations(asset as never, forbiddenNames, collections as never);

  return NextResponse.json({ rules: enriched, compatibility, violations });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const contextId = typeof body.context_id === "string" ? body.context_id : "";
  const rule = typeof body.rule === "string" && RULES.has(body.rule) ? body.rule : "";
  if (!contextId || !rule) return NextResponse.json({ error: "context_id and valid rule required" }, { status: 400 });

  const { error } = await supabaseServer.from("visual_context_rules").upsert({
    tenant_id: auth.tenant_id, entity_type: "asset", entity_id: id, context_id: contextId, rule,
    notes: typeof body.notes === "string" ? body.notes : null, created_by: auth.account_id ?? null,
  }, { onConflict: "tenant_id,entity_type,entity_id,context_id,rule", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logVisualAssetEvent({ tenantId: auth.tenant_id, assetId: id, actorId: auth.account_id ?? null, eventType: "governance_rule", summary: `Governance rule: ${rule}` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const ruleId = new URL(req.url).searchParams.get("rule_id");
  if (!ruleId) return NextResponse.json({ error: "rule_id required" }, { status: 400 });
  const { error } = await supabaseServer.from("visual_context_rules")
    .delete().eq("id", ruleId).eq("tenant_id", auth.tenant_id).eq("entity_type", "asset").eq("entity_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
