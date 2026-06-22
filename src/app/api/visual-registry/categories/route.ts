import "server-only";

/* /api/visual-registry/categories — list (filter by division_id, w/ counts) + create. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { ENTITIES, listEntity, createEntity } from "@/lib/visual-library/registry-crud";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;
  const divisionId = new URL(req.url).searchParams.get("division_id");

  const { data, error } = await listEntity(ENTITIES.categories, tid, divisionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories = await Promise.all((data ?? []).map(async (c) => {
    const [{ count: subCount }, { count: linkCount }] = await Promise.all([
      supabaseServer.from("visual_subcategories").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("category_id", c.id as string),
      supabaseServer.from("visual_asset_registry_links").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("category_id", c.id as string),
    ]);
    return { ...c, subcategory_count: subCount ?? 0, asset_link_count: linkCount ?? 0 };
  }));
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const r = await createEntity(ENTITIES.categories, auth.tenant_id, body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ category: r.data });
}
