import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/relationships

   GET  → outgoing relationships for an asset, enriched with the target asset's
          preview. Optional ?status= & ?type= filters. Fast: indexed on
          (source_asset_id, status), one extra batched fetch for previews.
   POST → create one or more relationships from this asset to target(s).
          Auto-creates the reverse edge for bidirectional types (opposite_of,
          similar_to, parent_of↔child_of, …).

   visual_asset_relationships is RLS-locked to the service role.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  isRelationshipType, reverseOf, coerceConfidence, validStatus,
} from "@/lib/visual-library/relationship-fields";
import type { RelationshipType } from "@/lib/visual-library/types";
import { logVisualAssetEvent } from "@/lib/visual-library/events";

function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${bucket || "media"}/${path}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "").trim();

  let q = supabaseServer
    .from("visual_asset_relationships")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_asset_id", id)
    .order("confidence_score", { ascending: false })
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (type) q = q.eq("relationship_type", type);

  const { data: rels, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targetIds = Array.from(new Set((rels ?? []).map((r) => r.target_asset_id)));
  const previews: Record<string, unknown> = {};
  if (targetIds.length) {
    const { data: assets } = await supabaseServer
      .from("visual_assets")
      .select("id, title, visual_asset_code, slug, category, svg_path, storage_bucket, approval_status")
      .eq("tenant_id", auth.tenant_id)
      .in("id", targetIds);
    for (const a of assets ?? []) {
      previews[a.id as string] = {
        ...a, public_url: publicUrl(a.storage_bucket as string, a.svg_path as string),
      };
    }
  }

  const enriched = (rels ?? []).map((r) => ({ ...r, related_asset: previews[r.target_asset_id] ?? null }));
  return NextResponse.json({ relationships: enriched });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const type = body.relationship_type;
  if (!isRelationshipType(type)) return NextResponse.json({ error: "Invalid relationship_type" }, { status: 400 });
  const relType = type as RelationshipType;

  const targets: string[] = Array.isArray(body.target_asset_ids)
    ? body.target_asset_ids.filter((x): x is string => typeof x === "string")
    : typeof body.target_asset_id === "string" ? [body.target_asset_id] : [];
  if (!targets.length) return NextResponse.json({ error: "target_asset_id(s) required" }, { status: 400 });

  const confidence = coerceConfidence(body.confidence_score);
  const status = validStatus(body.status) ? String(body.status) : "approved";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const autoReverse = body.auto_reverse !== false;

  // Verify all targets belong to this tenant (and aren't the source).
  const validTargets = targets.filter((t) => t && t !== id);
  const { data: found } = await supabaseServer
    .from("visual_assets").select("id").eq("tenant_id", tid).in("id", validTargets);
  const okTargets = new Set((found ?? []).map((r) => r.id as string));

  const rows: Record<string, unknown>[] = [];
  for (const t of validTargets) {
    if (!okTargets.has(t)) continue;
    rows.push({
      tenant_id: tid, source_asset_id: id, target_asset_id: t,
      relationship_type: relType, confidence_score: confidence, status, notes,
      origin: "manual", created_by: auth.account_id ?? null,
    });
    const rev = autoReverse ? reverseOf(relType) : null;
    if (rev) {
      rows.push({
        tenant_id: tid, source_asset_id: t, target_asset_id: id,
        relationship_type: rev, confidence_score: confidence, status, notes,
        origin: "manual", created_by: auth.account_id ?? null,
      });
    }
  }
  if (!rows.length) return NextResponse.json({ error: "No valid targets" }, { status: 400 });

  // Upsert so re-linking the same edge doesn't error on the unique constraint.
  const { error } = await supabaseServer
    .from("visual_asset_relationships")
    .upsert(rows, { onConflict: "tenant_id,source_asset_id,target_asset_id,relationship_type", ignoreDuplicates: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logVisualAssetEvent({ tenantId: tid, assetId: id, actorId: auth.account_id ?? null, eventType: "relationship", summary: `Linked: ${relType.replace(/_/g, " ")}` });

  return NextResponse.json({ ok: true, created: rows.length });
}
