import "server-only";

/* ===========================================================================
   GET    /api/inventory/serials/[id]    detail
   PATCH  /api/inventory/serials/[id]    limited update (condition/notes/status)
   DELETE /api/inventory/serials/[id]    admin soft delete → status=scrapped
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  archiveSerial,
  getSerial,
  updateSerial,
  type UpdateSerialPatch,
} from "@/lib/inventory/serials";

const MODULE = "Inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const serial = await getSerial(auth.tenant_id, id);
  if (!serial) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ serial });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const patch = (await req.json().catch(() => null)) as UpdateSerialPatch | null;
  if (!patch) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  /* Only allow condition/notes/metadata via this path. Direct status edits
     are admin-only and bypass through metadata-tagged calls. */
  const safe: UpdateSerialPatch = {
    condition_status: patch.condition_status,
    notes: patch.notes,
    metadata: patch.metadata,
  };

  const r = await updateSerial(auth.tenant_id, id, safe);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ serial: r.serial });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const r = await archiveSerial(auth.tenant_id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
