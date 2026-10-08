import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supplierOutstanding } from "@/lib/finance/calc";
import type { FinanceOrderSupplier } from "@/lib/finance/types";
import { canSeeBankAndProfit, canSeeCostData, hideOrderFigures } from "@/lib/experience";

/* The same rule as the list (/api/finance/orders): expected_profit only with
   «Bank & Profit», the supplier costs only with the private-records switch —
   0 with profit_hidden / cost_hidden otherwise; each line's outstanding_amount
   stays. Guarded by validate:finance-perf §G. */

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const { data, error } = await supabaseServer
    .from("finance_orders")
    .select("*, suppliers:finance_order_suppliers(*)")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[finance_orders detail]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = {
    ...data,
    suppliers: ((data.suppliers ?? []) as FinanceOrderSupplier[]).map((s) => ({ ...s, outstanding_amount: supplierOutstanding(s) })),
  };
  return NextResponse.json({ order: hideOrderFigures(order, { profit: await canSeeBankAndProfit(auth), cost: canSeeCostData(auth) }) });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "delete");
  if (deny) return deny;
  const { id } = await ctx.params;
  const { error } = await supabaseServer
    .from("finance_orders")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
