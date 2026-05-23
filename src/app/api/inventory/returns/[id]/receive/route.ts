import "server-only";

/* POST /api/inventory/returns/[id]/receive — customer return: approved → received.
   Atomically creates + posts return_in movements; routes each line by
   disposition (restock → warehouse, scrap → SCRAP, quarantine/vendor_return
   → QUARANTINE). */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { receiveReturn } from "@/lib/inventory/returns";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const r = await receiveReturn(auth.tenant_id, id, auth.account_id);
  if (!r.ok) {
    return NextResponse.json(
      { error: humanizeError(r.error ?? "Receive failed.") },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true });
}
