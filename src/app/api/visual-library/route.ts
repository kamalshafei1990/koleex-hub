import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library — list + create visual assets.

   GET  → paginated, filtered list (q, category, asset_type, approval_status,
          style, tag). Tenant-scoped, Database-module gated.
   POST → register a governed asset row (file already uploaded via
          /api/storage/upload). Generates an asset code if not supplied.

   visual_assets is RLS-locked to the service role, so all access flows
   through here with requireAuth + requireModuleAccess('Database').
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildAssetPatch, validateAssetPatch, codeNameToken, CATEGORY_CODE } from "@/lib/visual-library/asset-fields";
import type { VisualAsset } from "@/lib/visual-library/types";

function withPublicUrl(row: VisualAsset): VisualAsset {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = row.storage_bucket || "media";
  const path = row.svg_path || row.preview_path || null;
  return { ...row, public_url: path ? `${base}/storage/v1/object/public/${bucket}/${path}` : null };
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const assetType = (url.searchParams.get("asset_type") ?? "").trim();
  const approval = (url.searchParams.get("approval_status") ?? "").trim();
  const style = (url.searchParams.get("style") ?? "").trim();
  const tag = (url.searchParams.get("tag") ?? "").trim().toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(120, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "60", 10) || 60));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseServer
    .from("visual_assets")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (assetType) query = query.eq("asset_type", assetType);
  if (approval) query = query.eq("approval_status", approval);
  if (style) query = query.eq("style", style);
  if (tag) query = query.contains("tags", [tag]);
  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(
      `title.ilike.%${safe}%,visual_asset_code.ilike.%${safe}%,source_name.ilike.%${safe}%,description.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[api/visual-library GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    assets: (data ?? []).map((r) => withPublicUrl(r as VisualAsset)),
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const meta = buildAssetPatch(body);
  const verr = validateAssetPatch(meta);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });

  const title = typeof meta.title === "string" ? meta.title : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const svgPath = typeof body.svg_path === "string" ? body.svg_path.trim() : "";
  if (!svgPath) return NextResponse.json({ error: "svg_path is required" }, { status: 400 });

  const assetType = typeof meta.asset_type === "string" && meta.asset_type ? meta.asset_type : "icon";
  const category = typeof meta.category === "string" && meta.category ? meta.category : "General";

  // Generate a unique asset code if none supplied: ICO-{CAT}-{NAME}-{NNN}.
  let code = typeof body.visual_asset_code === "string" ? body.visual_asset_code.trim() : "";
  if (!code) {
    const prefix = assetType === "icon" ? "ICO" : assetType.slice(0, 3).toUpperCase();
    const cat = CATEGORY_CODE[category] ?? "GEN";
    const name = codeNameToken(typeof body.source_name === "string" ? body.source_name : title);
    const { count } = await supabaseServer
      .from("visual_assets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", auth.tenant_id)
      .ilike("visual_asset_code", `${prefix}-${cat}-${name}-%`);
    const seq = String((count ?? 0) + 1).padStart(3, "0");
    code = `${prefix}-${cat}-${name}-${seq}`;
  }

  const { data, error } = await supabaseServer
    .from("visual_assets")
    .insert({
      tenant_id: auth.tenant_id,
      visual_asset_code: code,
      source_name: typeof body.source_name === "string" ? body.source_name : null,
      title,
      title_cn: meta.title_cn ?? null,
      title_ar: meta.title_ar ?? null,
      description: meta.description ?? null,
      asset_type: assetType,
      category,
      subcategory: meta.subcategory ?? null,
      flaticon_folder: typeof body.flaticon_folder === "string" ? body.flaticon_folder : null,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      usage: Array.isArray(meta.usage) ? meta.usage : [],
      style: meta.style ?? "outline",
      file_type: typeof body.file_type === "string" ? body.file_type : "svg",
      storage_bucket: typeof body.storage_bucket === "string" ? body.storage_bucket : "media",
      svg_path: svgPath,
      preview_path: typeof body.preview_path === "string" ? body.preview_path : null,
      original_file: typeof body.original_file === "string" ? body.original_file : null,
      viewbox: typeof body.viewbox === "string" ? body.viewbox : null,
      width: typeof body.width === "number" ? body.width : null,
      height: typeof body.height === "number" ? body.height : null,
      file_size: typeof body.file_size === "number" ? body.file_size : null,
      mime_type: typeof body.mime_type === "string" ? body.mime_type : null,
      is_multipath: body.is_multipath === true,
      source: typeof meta.source === "string" ? meta.source : "upload",
      notes: meta.notes ?? null,
      approval_status: typeof meta.approval_status === "string" && meta.approval_status ? meta.approval_status : "draft",
      created_by: auth.account_id ?? null,
    })
    .select("id, visual_asset_code")
    .maybeSingle();

  if (error) {
    console.error("[api/visual-library POST]", error.message);
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null, code: data?.visual_asset_code ?? code });
}
