import "server-only";

/* /api/visual-registry/subcategories/[id] — PATCH + DELETE (soft archive). */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { ENTITIES, patchEntity, archiveEntity } from "@/lib/visual-library/registry-crud";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const r = await patchEntity(ENTITIES.subcategories, auth.tenant_id, id, body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ subcategory: r.data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "delete");
  if (deny) return deny;
  const { id } = await ctx.params;
  const r = await archiveEntity(ENTITIES.subcategories, auth.tenant_id, id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
