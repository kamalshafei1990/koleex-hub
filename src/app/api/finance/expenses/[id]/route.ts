import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { refuseIfInLedger } from "@/lib/accounting/hooks";

interface RouteCtx { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "delete");
  if (deny) return deny;
  const { id } = await ctx.params;
  const refuse = await refuseIfInLedger("finance_expenses", id, auth.tenant_id);
  if (refuse) return refuse;
  const { error } = await supabaseServer
    .from("finance_expenses")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
