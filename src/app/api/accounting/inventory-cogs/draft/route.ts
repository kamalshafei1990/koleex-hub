import "server-only";

/* ===========================================================================
   POST /api/accounting/inventory-cogs/draft

   Body: { shipment_id: string }

   Creates a draft journal entry for a shipped sales shipment:
     Dr 5400  Cost of Goods Sold
     Cr 1400  Inventory Asset
   Amount = sum of total_cost stamped on each linked OUT movement.

   Idempotent — re-running for the same shipment returns the existing
   active draft.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { draftInventoryCogs } from "@/lib/accounting/posting";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { shipment_id?: string } | null;
  if (!body?.shipment_id) {
    return NextResponse.json({ error: "shipment_id required" }, { status: 400 });
  }

  const r = await draftInventoryCogs(
    { tenantId: auth.tenant_id, postedByAccountId: auth.account_id },
    body.shipment_id,
  );
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 500 });
  return NextResponse.json(r);
}
