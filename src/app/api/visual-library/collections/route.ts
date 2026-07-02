import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/collections — list + create visual collections.
   GET  → filtered list with asset counts + cover/icon previews.
   POST → create a collection (slug auto-generated, unique per tenant).
   Database-module gated, service-role backed.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { buildCollectionPatch, validateCollectionPatch, slugify } from "@/lib/visual-library/collection-fields";

function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  return `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()}/storage/v1/object/public/${bucket || "media"}/${path}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const type = (url.searchParams.get("collection_type") ?? "").trim();
  const style = (url.searchParams.get("style_type") ?? "").trim();
  const status = (url.searchParams.get("approval_status") ?? "").trim();
  const sort = (url.searchParams.get("sort") ?? "updated").trim();

  let query = supabaseServer.from("visual_collections").select("*").eq("tenant_id", auth.tenant_id);
  if (category) query = query.eq("category", category);
  if (type) query = query.eq("collection_type", type);
  if (style) query = query.eq("style_type", style);
  if (status) query = query.eq("approval_status", status);
  if (q) { const s = q.replace(/[%,]/g, " "); query = query.or(`name.ilike.%${s}%,code.ilike.%${s}%,description.ilike.%${s}%`); }
  query = sort === "name" ? query.order("name", { ascending: true }) : query.order("updated_at", { ascending: false });

  const { data: cols, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Asset counts (parallel head-counts — collections are few) + cover/icon previews.
  const previewIds = Array.from(new Set((cols ?? []).flatMap((c) => [c.icon_asset_id, c.cover_asset_id]).filter(Boolean))) as string[];
  const previews: Record<string, { bucket: string | null; path: string | null }> = {};
  if (previewIds.length) {
    const { data: pa } = await supabaseServer.from("visual_assets")
      .select("id, storage_bucket, svg_path").eq("tenant_id", auth.tenant_id).in("id", previewIds);
    for (const a of pa ?? []) previews[a.id as string] = { bucket: a.storage_bucket as string, path: a.svg_path as string };
  }

  const counts = await Promise.all((cols ?? []).map((c) =>
    supabaseServer.from("visual_collection_assets").select("id", { count: "exact", head: true }).eq("collection_id", c.id)
      .then((r) => r.count ?? 0)));

  let enriched = (cols ?? []).map((c, i) => ({
    ...c,
    asset_count: counts[i],
    icon_url: c.icon_asset_id && previews[c.icon_asset_id] ? publicUrl(previews[c.icon_asset_id].bucket, previews[c.icon_asset_id].path) : null,
    cover_url: c.cover_asset_id && previews[c.cover_asset_id] ? publicUrl(previews[c.cover_asset_id].bucket, previews[c.cover_asset_id].path) : null,
  }));
  if (sort === "count") enriched = enriched.sort((a, b) => (b.asset_count ?? 0) - (a.asset_count ?? 0));

  return NextResponse.json({ collections: enriched });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const meta = buildCollectionPatch(body);
  const name = typeof meta.name === "string" ? meta.name : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const verr = validateCollectionPatch(meta);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });

  let slug = typeof meta.slug === "string" && meta.slug ? slugify(meta.slug) : slugify(name);
  // Ensure unique slug per tenant.
  const { data: existing } = await supabaseServer.from("visual_collections")
    .select("slug").eq("tenant_id", auth.tenant_id).like("slug", `${slug}%`);
  const taken = new Set((existing ?? []).map((r) => r.slug as string));
  if (taken.has(slug)) { let n = 2; while (taken.has(`${slug}-${n}`)) n++; slug = `${slug}-${n}`; }

  const code = typeof meta.code === "string" && meta.code ? meta.code : `COL-${slug.toUpperCase().replace(/-/g, "").slice(0, 12)}`;

  const { data, error } = await supabaseServer.from("visual_collections").insert({
    tenant_id: auth.tenant_id,
    code, name, slug,
    description: meta.description ?? null,
    category: meta.category ?? null,
    collection_type: typeof meta.collection_type === "string" ? meta.collection_type : "icon_pack",
    style_type: meta.style_type ?? null,
    icon_asset_id: meta.icon_asset_id ?? null,
    cover_asset_id: meta.cover_asset_id ?? null,
    approval_status: typeof meta.approval_status === "string" ? meta.approval_status : "draft",
    visibility: typeof meta.visibility === "string" ? meta.visibility : "internal",
    usage_context: meta.usage_context ?? {},
    created_by: auth.account_id ?? null,
  }).select("id, slug").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id, slug: data?.slug });
}
