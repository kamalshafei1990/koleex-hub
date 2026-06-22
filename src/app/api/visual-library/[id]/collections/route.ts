import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/collections
   GET  → collections this asset belongs to (id, name, slug, role).
   POST → add this asset to one or more collections ({ collection_ids[], role }).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { validRole } from "@/lib/visual-library/collection-fields";
import { logVisualAssetEvent } from "@/lib/visual-library/events";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { id } = await ctx.params;
  const { data: links } = await supabaseServer.from("visual_collection_assets")
    .select("id, collection_id, role").eq("tenant_id", auth.tenant_id).eq("asset_id", id);
  const colIds = (links ?? []).map((l) => l.collection_id as string);
  const byId: Record<string, { name: string; slug: string }> = {};
  if (colIds.length) {
    const { data: cols } = await supabaseServer.from("visual_collections")
      .select("id, name, slug").eq("tenant_id", auth.tenant_id).in("id", colIds);
    for (const c of cols ?? []) byId[c.id as string] = { name: c.name as string, slug: c.slug as string };
  }
  const memberships = (links ?? []).map((l) => ({
    link_id: l.id, collection_id: l.collection_id, role: l.role,
    name: byId[l.collection_id as string]?.name ?? "—", slug: byId[l.collection_id as string]?.slug ?? null,
  }));
  return NextResponse.json({ memberships });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const colIds: string[] = Array.isArray(body.collection_ids)
    ? body.collection_ids.filter((x): x is string => typeof x === "string")
    : typeof body.collection_id === "string" ? [body.collection_id] : [];
  if (!colIds.length) return NextResponse.json({ error: "collection_id(s) required" }, { status: 400 });
  const role = validRole(body.role) ? String(body.role) : "secondary";

  // verify collections belong to tenant
  const { data: cols } = await supabaseServer.from("visual_collections").select("id").eq("tenant_id", auth.tenant_id).in("id", colIds);
  const ok = new Set((cols ?? []).map((c) => c.id as string));
  const rows = colIds.filter((c) => ok.has(c)).map((c) => ({ tenant_id: auth.tenant_id, collection_id: c, asset_id: id, role }));
  if (!rows.length) return NextResponse.json({ error: "No valid collections" }, { status: 400 });

  const { error } = await supabaseServer.from("visual_collection_assets")
    .upsert(rows, { onConflict: "collection_id,asset_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseServer.from("visual_collections").update({ updated_at: new Date().toISOString() }).in("id", rows.map((r) => r.collection_id));
  await logVisualAssetEvent({ tenantId: auth.tenant_id, assetId: id, actorId: auth.account_id ?? null, eventType: "collection", summary: `Added to ${rows.length} collection(s)` });
  return NextResponse.json({ ok: true, added: rows.length });
}
