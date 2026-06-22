import "server-only";

/* POST /api/inventory/transfers/[id]/cancel — draft/pending → cancelled.
   For after-ship cleanup, use /void. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { transitionTransfer } from "@/lib/inventory/transfers";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const r = await transitionTransfer(auth.tenant_id, id, "cancelled", auth.account_id);
  if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Cancel failed.") }, { status: 422 });
  return NextResponse.json({ transfer: r.transfer });
}
