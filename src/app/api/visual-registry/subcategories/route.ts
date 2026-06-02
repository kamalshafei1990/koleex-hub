import "server-only";

/* /api/visual-registry/subcategories — list (filter by category_id, w/ counts) + create. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { ENTITIES, listEntity, createEntity } from "@/lib/visual-library/registry-crud";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;
  const categoryId = new URL(req.url).searchParams.get("category_id");

  const { data, error } = await listEntity(ENTITIES.subcategories, tid, categoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subcategories = await Promise.all((data ?? []).map(async (s) => {
    const [{ count: sysCount }, { count: typeCount }, { count: linkCount }] = await Promise.all([
      supabaseServer.from("visual_product_systems").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("subcategory_id", s.id as string),
      supabaseServer.from("visual_types").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("subcategory_id", s.id as string).eq("active", true),
      supabaseServer.from("visual_asset_registry_links").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("subcategory_id", s.id as string),
    ]);
    return { ...s, system_count: sysCount ?? 0, type_count: typeCount ?? 0, asset_link_count: linkCount ?? 0 };
  }));
  return NextResponse.json({ subcategories });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const r = await createEntity(ENTITIES.subcategories, auth.tenant_id, body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ subcategory: r.data });
}
