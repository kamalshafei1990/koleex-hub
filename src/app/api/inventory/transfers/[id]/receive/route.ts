import "server-only";

/* POST /api/inventory/transfers/[id]/receive — shipped → received.
   Atomically creates + posts transfer_in movements at the destination. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { receiveTransfer } from "@/lib/inventory/transfers";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const r = await receiveTransfer(auth.tenant_id, id, auth.account_id);
  if (!r.ok) {
    return NextResponse.json({ error: humanizeError(r.error ?? "Receive failed.") }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
