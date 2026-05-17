import "server-only";

/* ===========================================================================
   GET /api/inventory/balances
     ?warehouse_id=  optional filter
     ?product_id=    optional filter
     ?only_positive  hide rows with zero on-hand
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildBalancesSnapshot } from "@/lib/inventory/queries";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouse_id") ?? undefined;
  const productId = url.searchParams.get("product_id") ?? undefined;
  const onlyPositive = url.searchParams.get("only_positive") === "1";

  try {
    const balances = await buildBalancesSnapshot({
      tenantId: auth.tenant_id,
      warehouseId,
      productId,
      onlyPositive,
    });
    return NextResponse.json({ balances });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
