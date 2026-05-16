import "server-only";

/* ===========================================================================
   GET /api/finance/treasury
     Returns the treasury inputs the dashboard's intelligence pipeline
     needs: bank accounts and cash movements (last 180 days).

   Tenant-scoped; Finance module gated. The shape of this endpoint is
   intentionally lean — the dashboard already does heavy aggregation
   client-side via buildIntelligence(), and the treasury engine handles
   the math. This route just hands over rows.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { BankAccount, CashMovement } from "@/lib/finance/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const sinceIso = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);

  const [accountsRes, movementsRes] = await Promise.all([
    supabaseServer.from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("bank_name", { ascending: true }),
    supabaseServer.from("finance_cash_movements")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .gte("movement_date", sinceIso)
      .order("movement_date", { ascending: false })
      .limit(500),
  ]);

  if (accountsRes.error) {
    console.error("[api/finance/treasury accounts]", accountsRes.error.message);
    return NextResponse.json({ error: "Failed to load bank accounts" }, { status: 500 });
  }
  if (movementsRes.error) {
    console.error("[api/finance/treasury movements]", movementsRes.error.message);
    return NextResponse.json({ error: "Failed to load cash movements" }, { status: 500 });
  }

  return NextResponse.json({
    accounts: (accountsRes.data ?? []) as BankAccount[],
    movements: (movementsRes.data ?? []) as CashMovement[],
  });
}
