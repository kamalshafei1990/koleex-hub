import "server-only";

/* /api/visual-registry/types — list (filter by subcategory_id) + create. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { ENTITIES, listEntity, createEntity } from "@/lib/visual-library/registry-crud";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const subcategoryId = new URL(req.url).searchParams.get("subcategory_id");
  const { data, error } = await listEntity(ENTITIES.types, auth.tenant_id, subcategoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const r = await createEntity(ENTITIES.types, auth.tenant_id, body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ type: r.data });
}
