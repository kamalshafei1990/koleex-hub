import "server-only";

/* ===========================================================================
   PATCH  /api/inventory/item-types/[id]   update a tenant-custom type
   DELETE /api/inventory/item-types/[id]   archive or hard-delete depending
                                            on whether items reference it
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { updateItemType, archiveItemType } from "@/lib/inventory/items";
import type { ColorToken, IconName } from "@/lib/inventory/types";

interface PatchBody {
  type_name?: string;
  icon?: IconName;
  color?: ColorToken;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await updateItemType(auth.tenant_id, id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ type: r.type });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "delete");
  if (deny) return deny;

  const r = await archiveItemType(auth.tenant_id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
