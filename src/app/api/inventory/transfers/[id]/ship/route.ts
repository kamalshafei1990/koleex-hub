import "server-only";

/* POST /api/inventory/transfers/[id]/ship — approved → shipped.
   Atomically creates + posts transfer_out movements for every item. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { shipTransfer } from "@/lib/inventory/transfers";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const r = await shipTransfer(auth.tenant_id, id, auth.account_id);
  if (!r.ok) {
    return NextResponse.json(
      {
        error: humanizeError(r.error ?? "Ship failed."),
        offending_item_id: r.offending_item_id ?? null,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true });
}
