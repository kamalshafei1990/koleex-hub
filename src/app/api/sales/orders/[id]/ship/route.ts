import "server-only";

/* ===========================================================================
   POST /api/sales/orders/[id]/ship

   Body:
     { source_location_id?, tracking_no?, notes?, shipped_at?,
       lines: [{ sales_order_item_id, qty }] }

   Creates a shipment header + lines, posts one inventory OUT movement
   per line that has an inventory_item_id, flips the shipment to
   'shipped', and recomputes the SO header status.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { shipSalesOrder } from "@/lib/sales/shipping";
import type { ShipRequest } from "@/lib/sales/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Orders");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as ShipRequest | null;
  if (!body || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "lines[] required" }, { status: 400 });
  }

  const outcome = await shipSalesOrder({
    soId: id,
    tenantId: auth.tenant_id,
    shippedBy: auth.account_id,
    request: body,
  });
  if (!outcome.ok) return NextResponse.json(outcome, { status: outcome.code ?? 500 });
  return NextResponse.json(outcome);
}
