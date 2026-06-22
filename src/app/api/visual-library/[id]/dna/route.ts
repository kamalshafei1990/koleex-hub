import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/dna
   GET    → KOLEEX Design DNA analysis vs the Core profile. Computed on first
            read (lazy), cached in asset_dna_analysis; ?recompute=1 forces.
            Returns analysis + violations + pattern matches + visual-language
            similar assets.
   PATCH  → manual review notes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { svgMetrics, type SvgMetrics } from "@/lib/visual-library/quality";
import { computeDna } from "@/lib/visual-library/design-dna";
import type { DnaRule, DnaPattern } from "@/lib/visual-library/types";

function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${bucket || "media"}/${path}`;
}

async function coreProfile(tid: string) {
  const { data } = await supabaseServer.from("design_dna_profiles")
    .select("id").eq("tenant_id", tid).eq("slug", "koleex-core").maybeSingle();
  return (data?.id as string) ?? null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;
  const recompute = new URL(req.url).searchParams.get("recompute") === "1";

  const profileId = await coreProfile(tid);
  if (!profileId) return NextResponse.json({ error: "DNA profile missing" }, { status: 500 });

  const { data: asset } = await supabaseServer.from("visual_assets")
    .select("id, title, style, asset_type, approval_status, category, svg_path, storage_bucket, is_multipath")
    .eq("id", id).eq("tenant_id", tid).maybeSingle();
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Visual-language similar (NOT semantic): same style + same multipath flag + same category-ish family.
  const { data: sim } = await supabaseServer.from("visual_assets")
    .select("id, title, storage_bucket, svg_path, is_multipath")
    .eq("tenant_id", tid).eq("style", asset.style ?? "outline").eq("is_multipath", asset.is_multipath ?? false)
    .neq("id", id).not("svg_path", "is", null).limit(8);
  const similar = (sim ?? []).map((s) => ({ id: s.id as string, title: s.title as string, public_url: publicUrl(s.storage_bucket as string, s.svg_path as string) }));

  const { data: existing } = await supabaseServer.from("asset_dna_analysis").select("*").eq("asset_id", id).eq("profile_id", profileId).maybeSingle();
  if (existing && !recompute) {
    return NextResponse.json({ dna: existing, similar, cached: true });
  }

  // Member collections (style) + rules + patterns
  const { data: links } = await supabaseServer.from("visual_collection_assets").select("collection_id").eq("tenant_id", tid).eq("asset_id", id);
  const colIds = Array.from(new Set((links ?? []).map((l) => l.collection_id as string)));
  let collections: { name: string; preferred_style: string | null }[] = [];
  if (colIds.length) {
    const { data: cols } = await supabaseServer.from("visual_collections").select("name, preferred_style").in("id", colIds);
    collections = (cols ?? []) as typeof collections;
  }
  const [{ data: rules }, { data: patterns }] = await Promise.all([
    supabaseServer.from("design_dna_rules").select("*").eq("profile_id", profileId),
    supabaseServer.from("design_dna_patterns").select("*").eq("profile_id", profileId),
  ]);

  // SVG metrics
  let metrics: SvgMetrics | null = null;
  const url = publicUrl(asset.storage_bucket as string, asset.svg_path as string);
  if (url) {
    try { const r = await fetch(url); if (r.ok && (r.headers.get("content-type") ?? "").includes("svg")) metrics = svgMetrics(await r.text()); } catch { /* metadata only */ }
  }

  const r = computeDna({ asset: asset as never, metrics, collections, rules: (rules ?? []) as DnaRule[], patterns: (patterns ?? []) as DnaPattern[] });
  const { violations, ...scores } = r;

  const row = {
    tenant_id: tid, asset_id: id, profile_id: profileId, ...scores,
    pattern_matches: scores.pattern_matches,
    review_notes: existing?.review_notes ?? null, reviewed_by: existing?.reviewed_by ?? null,
    computed_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabaseServer.from("asset_dna_analysis")
    .upsert(row, { onConflict: "asset_id,profile_id" }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dna: saved ?? row, violations, similar, cached: false });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;
  const profileId = await coreProfile(auth.tenant_id);
  if (!profileId) return NextResponse.json({ error: "DNA profile missing" }, { status: 500 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  await supabaseServer.from("asset_dna_analysis").upsert({ tenant_id: auth.tenant_id, asset_id: id, profile_id: profileId }, { onConflict: "asset_id,profile_id", ignoreDuplicates: true });
  const { error } = await supabaseServer.from("asset_dna_analysis")
    .update({ review_notes: typeof body.review_notes === "string" ? body.review_notes.trim() || null : null, reviewed_by: auth.account_id ?? null })
    .eq("asset_id", id).eq("profile_id", profileId).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
