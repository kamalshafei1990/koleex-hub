import "server-only";

/* ===========================================================================
   GET    /api/inventory/items/[id]   item detail + per-warehouse stock
   PATCH  /api/inventory/items/[id]   limited update
   DELETE /api/inventory/items/[id]   soft archive (status='archived')
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getItemStockSummary } from "@/lib/inventory/queries";
import { updateInventoryItem, archiveInventoryItem } from "@/lib/inventory/items";
import type { InventoryItem } from "@/lib/inventory/types";

const MODULE = "Inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stock = await getItemStockSummary(auth.tenant_id, id);
  return NextResponse.json({ item: data as InventoryItem, stock });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const patch = (await req.json().catch(() => null)) as Partial<InventoryItem> | null;
  if (!patch) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await updateInventoryItem(auth.tenant_id, id, patch, {
    actor_id: auth.account_id,
    is_super_admin: auth.is_super_admin,
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: r.error, code: r.code ?? null },
      { status: 422 },
    );
  }
  return NextResponse.json({ item: r.item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "delete");
  if (deny) return deny;

  const r = await archiveInventoryItem(auth.tenant_id, id, { actor_id: auth.account_id });
  if (!r.ok) {
    return NextResponse.json(
      { error: r.error, code: r.code ?? null },
      { status: r.code ? 422 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
