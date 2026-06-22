import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/quality
   GET    → the asset's visual-quality profile. Computed on first read (lazy)
            and cached in visual_asset_quality; ?recompute=1 forces a refresh.
            Also returns similar assets, collection compatibility, warnings.
   PATCH  → manual review: overall_status override + manual_notes + reviewer.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { computeQuality, svgMetrics, type SvgMetrics } from "@/lib/visual-library/quality";
import { QUALITY_STATUSES } from "@/lib/visual-library/types";

const STATUS = new Set<string>(QUALITY_STATUSES);
function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${bucket || "media"}/${path}`;
}
const baseStem = (s: string) => (s || "").toLowerCase().replace(/-(alt|[0-9]+)$/g, "").trim();

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;
  const recompute = new URL(req.url).searchParams.get("recompute") === "1";

  const { data: asset } = await supabaseServer.from("visual_assets")
    .select("id, title, slug, source_name, style, asset_type, approval_status, status, svg_path, storage_bucket, category, keywords")
    .eq("id", id).eq("tenant_id", tid).maybeSingle();
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: existing } = await supabaseServer.from("visual_asset_quality").select("*").eq("asset_id", id).maybeSingle();

  // ── Deterministic duplicate / similarity detection ──
  const stem = baseStem((asset.source_name as string) || (asset.slug as string) || "");
  const kw = (asset.keywords as string[]) ?? [];
  const { data: sameCat } = await supabaseServer.from("visual_assets")
    .select("id, title, slug, source_name, keywords, storage_bucket, svg_path")
    .eq("tenant_id", tid).eq("category", asset.category).neq("id", id).limit(400);
  const similar = (sameCat ?? []).map((o) => {
    const oStem = baseStem((o.source_name as string) || (o.slug as string) || "");
    const shared = ((o.keywords as string[]) ?? []).filter((k) => kw.includes(k)).length;
    const stemMatch = stem && oStem === stem;
    const score = (stemMatch ? 3 : 0) + shared;
    return { id: o.id as string, title: o.title as string, public_url: publicUrl(o.storage_bucket as string, o.svg_path as string), score };
  }).filter((o) => o.score >= 2).sort((a, b) => b.score - a.score).slice(0, 8);

  // ── Member collections (for compatibility / style consistency) ──
  const { data: links } = await supabaseServer.from("visual_collection_assets").select("collection_id").eq("tenant_id", tid).eq("asset_id", id);
  const colIds = Array.from(new Set((links ?? []).map((l) => l.collection_id as string)));
  let collections: { name: string; preferred_style: string | null; preferred_monochrome: boolean | null }[] = [];
  if (colIds.length) {
    const { data: cols } = await supabaseServer.from("visual_collections").select("name, preferred_style, preferred_monochrome").in("id", colIds);
    collections = (cols ?? []) as typeof collections;
  }

  // Use cached profile unless missing/forced.
  if (existing && !recompute) {
    return NextResponse.json({ quality: existing, similar, collections, cached: true });
  }

  // ── Lightweight SVG parse for visual metrics ──
  let metrics: SvgMetrics | null = null;
  const url = publicUrl(asset.storage_bucket as string, asset.svg_path as string);
  if (url) {
    try {
      const res = await fetch(url);
      if (res.ok && (res.headers.get("content-type") ?? "").includes("svg")) metrics = svgMetrics(await res.text());
    } catch { /* ignore — score from metadata only */ }
  }

  const computed = computeQuality({ asset: asset as never, collections, metrics, similarCount: similar.length });
  const { warnings, ...scores } = computed;

  const row = {
    tenant_id: tid, asset_id: id, ...scores,
    visually_similar_to: similar.map((s) => s.id),
    duplicate_group_id: existing?.duplicate_group_id ?? null,
    ai_notes: existing?.ai_notes ?? null,
    manual_notes: existing?.manual_notes ?? null,
    reviewed_by: existing?.reviewed_by ?? null,
    reviewed_at: existing?.reviewed_at ?? null,
    computed_at: new Date().toISOString(),
  };
  const { data: saved, error } = await supabaseServer.from("visual_asset_quality")
    .upsert(row, { onConflict: "asset_id" }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quality: saved ?? row, warnings, similar, collections, cached: false });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const patch: Record<string, unknown> = { reviewed_by: auth.account_id ?? null, reviewed_at: new Date().toISOString() };
  if (typeof body.overall_status === "string" && STATUS.has(body.overall_status)) patch.overall_status = body.overall_status;
  if (typeof body.manual_notes === "string") patch.manual_notes = body.manual_notes.trim() || null;

  // Ensure a row exists, then update.
  await supabaseServer.from("visual_asset_quality").upsert({ tenant_id: auth.tenant_id, asset_id: id }, { onConflict: "asset_id", ignoreDuplicates: true });
  const { error } = await supabaseServer.from("visual_asset_quality").update(patch).eq("asset_id", id).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
