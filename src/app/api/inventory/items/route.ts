import "server-only";

/* ===========================================================================
   GET  /api/inventory/items         list inventory items
   POST /api/inventory/items         create item (+ optional opening balance)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listInventoryItems } from "@/lib/inventory/queries";
import { createInventoryItem } from "@/lib/inventory/items";
import type { CreateItemInput } from "@/lib/inventory/types";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  try {
    const items = await listInventoryItems({
      tenantId: auth.tenant_id,
      search: url.searchParams.get("q") ?? undefined,
      typeId: url.searchParams.get("type_id") ?? undefined,
      status: (url.searchParams.get("status") as "active" | "inactive" | "archived" | null) ?? undefined,
      limit: Number(url.searchParams.get("limit")) || 200,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Partial<CreateItemInput> | null;
  if (!body?.item_name) return NextResponse.json({ error: "item_name required" }, { status: 400 });

  const r = await createInventoryItem({
    ...body,
    tenant_id: auth.tenant_id,
    item_name: body.item_name,
    created_by: auth.account_id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ item: r.item, opening_movement_id: r.opening_movement_id });
}
