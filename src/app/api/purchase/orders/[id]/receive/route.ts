import "server-only";

/* ===========================================================================
   POST /api/purchase/orders/[id]/receive

   Body:
     { warehouse_id?, received_at?, carrier?, tracking_no?, notes?,
       lines: [{ po_item_id, qty_received, qty_accepted?, qty_rejected?,
                 warehouse_id?, condition_notes? }] }

   On success creates a receipt header + lines, posts one inventory
   stock movement per accepted line, flips the receipt to 'posted',
   and recomputes the PO header status.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { receivePurchaseOrder } from "@/lib/purchase/receiving";
import type { ReceiveRequest } from "@/lib/purchase/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Purchase");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as ReceiveRequest | null;
  if (!body || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "lines[] required" }, { status: 400 });
  }

  const outcome = await receivePurchaseOrder({
    poId: id,
    tenantId: auth.tenant_id,
    receivedBy: auth.account_id,
    request: body,
  });
  if (!outcome.ok) return NextResponse.json(outcome, { status: outcome.code ?? 500 });
  return NextResponse.json(outcome);
}
