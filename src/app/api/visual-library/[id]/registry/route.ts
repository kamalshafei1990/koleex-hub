import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/registry
   GET   → this asset's business-structure links (division/category/subcategory/
           system + usage role), inherited DNA, compatibility warnings, coverage
           contribution, and the division option list for the editor.
   PATCH → add / update / remove a registry link (deterministic, no AI).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveInheritedDna } from "@/lib/visual-library/registry";
import { REGISTRY_USAGE_ROLES } from "@/lib/visual-library/types";
import { logVisualAssetEvent } from "@/lib/visual-library/events";

const ROLES = new Set<string>(REGISTRY_USAGE_ROLES);

async function loadLinks(tid: string, assetId: string) {
  const { data: links } = await supabaseServer.from("visual_asset_registry_links")
    .select("*").eq("tenant_id", tid).eq("asset_id", assetId).order("priority", { ascending: false });
  const rows = links ?? [];
  // Resolve labels in bulk.
  const ids = {
    div: [...new Set(rows.map((r) => r.division_id).filter(Boolean))] as string[],
    cat: [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[],
    sub: [...new Set(rows.map((r) => r.subcategory_id).filter(Boolean))] as string[],
    sys: [...new Set(rows.map((r) => r.product_system_id).filter(Boolean))] as string[],
  };
  const nameMap = async (table: string, list: string[]) => {
    if (!list.length) return {} as Record<string, { name: string; dna: string | null; style: string | null }>;
    const { data } = await supabaseServer.from(table).select("id, name, dna_profile_id, visual_style").eq("tenant_id", tid).in("id", list);
    const m: Record<string, { name: string; dna: string | null; style: string | null }> = {};
    for (const r of data ?? []) m[r.id as string] = { name: r.name as string, dna: (r.dna_profile_id as string) ?? null, style: (r.visual_style as string) ?? null };
    return m;
  };
  const [dm, cm, sm, pm] = await Promise.all([
    nameMap("visual_divisions", ids.div), nameMap("visual_categories", ids.cat),
    nameMap("visual_subcategories", ids.sub),
    (async () => {
      if (!ids.sys.length) return {} as Record<string, { name: string; style: string | null }>;
      const { data } = await supabaseServer.from("visual_product_systems").select("id, name, visual_style").eq("tenant_id", tid).in("id", ids.sys);
      const m: Record<string, { name: string; style: string | null }> = {};
      for (const r of data ?? []) m[r.id as string] = { name: r.name as string, style: (r.visual_style as string) ?? null };
      return m;
    })(),
  ]);
  const enriched = rows.map((r) => ({
    ...r,
    division_name: r.division_id ? dm[r.division_id as string]?.name ?? null : null,
    category_name: r.category_id ? cm[r.category_id as string]?.name ?? null : null,
    subcategory_name: r.subcategory_id ? sm[r.subcategory_id as string]?.name ?? null : null,
    product_system_name: r.product_system_id ? pm[r.product_system_id as string]?.name ?? null : null,
  }));
  return { rows: enriched, dm, cm, sm };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const [{ data: asset }, { rows, dm, cm, sm }, { data: divisions }, { data: profiles }] = await Promise.all([
    supabaseServer.from("visual_assets").select("id, title, visual_asset_code, style, category, subcategory").eq("id", id).eq("tenant_id", tid).maybeSingle(),
    loadLinks(tid, id),
    supabaseServer.from("visual_divisions").select("id, name, slug").eq("tenant_id", tid).eq("active", true).order("sort_order"),
    supabaseServer.from("design_dna_profiles").select("id, name").eq("tenant_id", tid),
  ]);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const profileName = (pid: string) => (profiles ?? []).find((p) => p.id === pid)?.name ?? null;

  // Inherited DNA — use the most specific link (one with a subcategory).
  const deepest = rows.find((r) => r.subcategory_id) ?? rows.find((r) => r.category_id) ?? rows[0];
  const inherited = deepest ? resolveInheritedDna({
    subcategory: deepest.subcategory_id ? { dna_profile_id: sm[deepest.subcategory_id as string]?.dna ?? null, visual_style: sm[deepest.subcategory_id as string]?.style ?? null } : null,
    category: deepest.category_id ? { dna_profile_id: cm[deepest.category_id as string]?.dna ?? null, visual_style: cm[deepest.category_id as string]?.style ?? null } : null,
    division: deepest.division_id ? { dna_profile_id: dm[deepest.division_id as string]?.dna ?? null, visual_style: dm[deepest.division_id as string]?.style ?? null } : null,
    profileName,
  }) : null;

  // Deterministic compatibility warnings.
  const warnings: string[] = [];
  if (rows.length === 0) warnings.push("Asset is not mapped to any business structure yet.");
  if (rows.some((r) => r.deprecated)) warnings.push("One or more registry links are marked deprecated.");
  if (inherited?.visual_style && asset.style && inherited.visual_style !== asset.style) {
    warnings.push(`Asset style "${asset.style}" differs from inherited "${inherited.visual_style}".`);
  }
  if (rows.length > 0 && !rows.some((r) => r.product_system_id)) warnings.push("Not linked to any product system.");

  return NextResponse.json({
    asset: { id: asset.id, title: asset.title, code: asset.visual_asset_code, style: asset.style },
    links: rows, inherited_dna: inherited, warnings,
    coverage_contribution: { systems: rows.filter((r) => r.product_system_id).length, roles: [...new Set(rows.map((r) => r.usage_role))] },
    divisions: divisions ?? [],
    usage_roles: REGISTRY_USAGE_ROLES,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const action = body.action;

  if (action === "remove") {
    const linkId = typeof body.link_id === "string" ? body.link_id : "";
    if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 });
    const { error } = await supabaseServer.from("visual_asset_registry_links").delete().eq("id", linkId).eq("tenant_id", tid).eq("asset_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    const linkId = typeof body.link_id === "string" ? body.link_id : "";
    if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof body.usage_role === "string" && ROLES.has(body.usage_role)) patch.usage_role = body.usage_role;
    for (const f of ["priority", "visual_weight"]) if (f in body) patch[f] = Number(body[f]) || 0;
    for (const f of ["required", "recommended", "deprecated"]) if (f in body) patch[f] = body[f] === true;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no editable fields" }, { status: 400 });
    const { error } = await supabaseServer.from("visual_asset_registry_links").update(patch).eq("id", linkId).eq("tenant_id", tid).eq("asset_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // default: add
  const role = typeof body.usage_role === "string" && ROLES.has(body.usage_role) ? body.usage_role : "feature";
  const str = (k: string) => (typeof body[k] === "string" && body[k] ? (body[k] as string) : null);
  const division_id = str("division_id"), category_id = str("category_id"), subcategory_id = str("subcategory_id"), product_system_id = str("product_system_id");
  if (!division_id && !category_id && !subcategory_id && !product_system_id) {
    return NextResponse.json({ error: "Select at least a division." }, { status: 400 });
  }
  const row = {
    tenant_id: tid, asset_id: id, division_id, category_id, subcategory_id, product_system_id,
    usage_role: role, priority: Number(body.priority) || 0,
    required: body.required === true, recommended: body.recommended === true, deprecated: body.deprecated === true,
    visual_weight: Number(body.visual_weight) || 1,
  };
  const { error } = await supabaseServer.from("visual_asset_registry_links").upsert(row, { onConflict: "asset_id,division_id,category_id,subcategory_id,product_system_id,usage_role" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logVisualAssetEvent({
    tenantId: tid, assetId: id, actorId: auth.account_id ?? null,
    eventType: "registry", summary: `Registry: mapped as ${role.replace(/-/g, " ")}`,
    metadata: { division_id, category_id, subcategory_id, product_system_id, usage_role: role },
  });
  return NextResponse.json({ ok: true });
}
