import "server-only";

/* POST /api/inventory/returns/[id]/ship — supplier return: approved → shipped.
   Atomically creates + posts return_out movements from the return's
   warehouse. Negative stock is forbidden — pre-flight aborts the batch. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { shipReturn } from "@/lib/inventory/returns";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const r = await shipReturn(auth.tenant_id, id, auth.account_id);
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
