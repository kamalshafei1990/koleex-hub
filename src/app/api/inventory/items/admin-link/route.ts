import "server-only";

/* ===========================================================================
   POST /api/inventory/items/admin-link

   INV-H1 Scope 3 — Admin repair: link an existing inventory_item to an
   existing product. Calls fn_inventory_link_item_to_product which
   enforces the one-active-profile-per-product invariant.

   Body: { inventory_item_id: uuid, product_id: uuid }
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

  const body = (await req.json().catch(() => ({}))) as {
    inventory_item_id?: string;
    product_id?: string;
  };
  if (!body.inventory_item_id || !body.product_id) {
    return NextResponse.json(
      { error: "inventory_item_id and product_id required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer.rpc(
    "fn_inventory_link_item_to_product",
    {
      p_tenant_id: auth.tenant_id,
      p_inventory_item_id: body.inventory_item_id,
      p_product_id: body.product_id,
    },
  );
  if (error) {
    /* Surface the duplicate-profile guard cleanly. */
    if (error.message?.includes("INV_H1_DUPLICATE_PROFILE")) {
      return NextResponse.json(
        { error: "A stock profile already exists for this product.", code: "INV_H1_DUPLICATE_PROFILE" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: data === true });
}
