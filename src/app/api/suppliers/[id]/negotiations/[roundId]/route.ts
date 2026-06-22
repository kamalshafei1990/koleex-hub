import "server-only";

/* ---------------------------------------------------------------------------
   DELETE /api/suppliers/[id]/negotiations/[roundId] — remove a negotiation round.
   Tenant + supplier scoped, Suppliers-module gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; roundId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "delete");
  if (deny) return deny;

  const { id, roundId } = await ctx.params;
  const tid = auth.tenant_id;

  const { error } = await supabaseServer
    .from("supplier_negotiation_rounds")
    .delete()
    .eq("id", roundId).eq("tenant_id", tid).eq("supplier_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
