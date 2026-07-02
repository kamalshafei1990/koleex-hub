import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/collections/[cid]/assets  (cid = uuid or slug)
   GET    → paginated member assets (enriched with preview), ordered by sort_order.
   POST   → add one or many assets (asset_ids[]) with a role.
   PATCH  → update an item's role, or reorder ({ order: [linkId,…] }).
   DELETE → remove an asset from the collection (?asset_id= or ?link_id=).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { validRole } from "@/lib/visual-library/collection-fields";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  return `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()}/storage/v1/object/public/${bucket || "media"}/${path}`;
}
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

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "120", 10) || 120));
  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  const { data: links, count, error } = await supabaseServer
    .from("visual_collection_assets")
    .select("*", { count: "exact" })
    .eq("collection_id", colId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assetIds = (links ?? []).map((l) => l.asset_id as string);
  const byId: Record<string, unknown> = {};
  if (assetIds.length) {
    const { data: assets } = await supabaseServer.from("visual_assets").select("*").eq("tenant_id", auth.tenant_id).in("id", assetIds);
    for (const a of assets ?? []) byId[a.id as string] = { ...a, public_url: publicUrl(a.storage_bucket as string, a.svg_path as string) };
  }
  const items = (links ?? []).map((l) => ({ ...l, asset: byId[l.asset_id as string] ?? null }));
  return NextResponse.json({ items, total: count ?? items.length, page, pageSize });
}

export async function POST(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const ids: string[] = Array.isArray(body.asset_ids)
    ? body.asset_ids.filter((x): x is string => typeof x === "string")
    : typeof body.asset_id === "string" ? [body.asset_id] : [];
  if (!ids.length) return NextResponse.json({ error: "asset_id(s) required" }, { status: 400 });
  const role = validRole(body.role) ? String(body.role) : "secondary";

  // base sort_order = current max
  const { data: maxRow } = await supabaseServer.from("visual_collection_assets")
    .select("sort_order").eq("collection_id", colId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  let base = (maxRow?.sort_order as number) ?? 0;

  // verify targets belong to tenant
  const { data: found } = await supabaseServer.from("visual_assets").select("id").eq("tenant_id", auth.tenant_id).in("id", ids);
  const ok = new Set((found ?? []).map((r) => r.id as string));

  const rows = ids.filter((id) => ok.has(id)).map((id) => ({
    tenant_id: auth.tenant_id, collection_id: colId, asset_id: id, role, sort_order: ++base,
  }));
  if (!rows.length) return NextResponse.json({ error: "No valid assets" }, { status: 400 });

  const { error } = await supabaseServer.from("visual_collection_assets")
    .upsert(rows, { onConflict: "collection_id,asset_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseServer.from("visual_collections").update({ updated_at: new Date().toISOString() }).eq("id", colId);
  return NextResponse.json({ ok: true, added: rows.length });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  // Reorder
  if (Array.isArray(body.order)) {
    const order = body.order.filter((x): x is string => typeof x === "string");
    await Promise.all(order.map((linkId, i) =>
      supabaseServer.from("visual_collection_assets").update({ sort_order: i }).eq("id", linkId).eq("collection_id", colId)));
    return NextResponse.json({ ok: true });
  }
  // Role change on a single link
  const linkId = typeof body.link_id === "string" ? body.link_id : "";
  if (linkId && validRole(body.role)) {
    const { error } = await supabaseServer.from("visual_collection_assets")
      .update({ role: String(body.role) }).eq("id", linkId).eq("collection_id", colId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "delete");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const colId = await resolveId(cid, auth.tenant_id);
  if (!colId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const assetId = url.searchParams.get("asset_id");
  const linkId = url.searchParams.get("link_id");
  let qb = supabaseServer.from("visual_collection_assets").delete().eq("collection_id", colId);
  if (linkId) qb = qb.eq("id", linkId);
  else if (assetId) qb = qb.eq("asset_id", assetId);
  else return NextResponse.json({ error: "asset_id or link_id required" }, { status: 400 });
  const { error } = await qb;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
