import "server-only";

/* ===========================================================================
   POST /api/inventory/items/admin-backfill

   INV-H1 Scope 1 — Bulk backfill helper. Walks every unlinked
   inventory_item in the tenant and tries fn_inventory_backfill_link_to_product.
   Returns per-item outcome counts.

   Body: { allow_create_product?: boolean }   default false
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const MODULE = "Inventory";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as { allow_create_product?: boolean };
  const allowCreate = body.allow_create_product === true;

  const { data: items, error } = await supabaseServer
    .from("inventory_items")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .is("linked_product_id", null)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let linked = 0;
  let skipped = 0;
  const results: Array<{ item_id: string; product_id: string | null }> = [];
  for (const it of (items ?? []) as Array<{ id: string }>) {
    const { data, error: rpcErr } = await supabaseServer.rpc(
      "fn_inventory_backfill_link_to_product",
      {
        p_tenant_id: auth.tenant_id,
        p_inventory_item_id: it.id,
        p_allow_create_product: allowCreate,
      },
    );
    if (rpcErr) {
      skipped += 1;
      results.push({ item_id: it.id, product_id: null });
      continue;
    }
    const pid = (data as string | null) ?? null;
    if (pid) linked += 1; else skipped += 1;
    results.push({ item_id: it.id, product_id: pid });
  }

  return NextResponse.json({
    total: items?.length ?? 0,
    linked,
    skipped,
    allow_create_product: allowCreate,
    results,
  });
}
