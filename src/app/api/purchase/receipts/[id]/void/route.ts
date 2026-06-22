import "server-only";

/* ===========================================================================
   POST /api/purchase/receipts/[id]/void
   Reverses each inventory movement the receipt created and flips it
   to 'voided'. The PO header status recomputes automatically.
   Body: { reason?: string }
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { voidPurchaseReceipt } from "@/lib/purchase/receiving";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Purchase", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const r = await voidPurchaseReceipt({
    receiptId: id,
    tenantId: auth.tenant_id,
    voidedBy: auth.account_id,
    reason: body?.reason ?? null,
  });
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 500 });
  return NextResponse.json(r);
}
