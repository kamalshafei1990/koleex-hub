import "server-only";

/* /api/visual-registry/systems — list (filter by subcategory_id, w/ link counts) + create. */

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
  const subcategoryId = new URL(req.url).searchParams.get("subcategory_id");

  const { data, error } = await listEntity(ENTITIES.systems, tid, subcategoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const systems = await Promise.all((data ?? []).map(async (s) => {
    const { count } = await supabaseServer.from("visual_asset_registry_links")
      .select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("product_system_id", s.id as string);
    return { ...s, asset_link_count: count ?? 0 };
  }));
  return NextResponse.json({ systems });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const r = await createEntity(ENTITIES.systems, auth.tenant_id, body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ system: r.data });
}
