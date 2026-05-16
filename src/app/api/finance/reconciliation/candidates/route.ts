import "server-only";

/* ===========================================================================
   GET /api/finance/reconciliation/candidates

   Returns the active reconciliation queue for the caller's tenant.
   Joins the underlying payment + cash movement so the queue UI can
   render the decision without a second round-trip.

   Query parameters:
     status            ?status=suggested | confirmed | rejected | expired
                       (default: suggested,confirmed)
     limit             ?limit=100 (default 100, max 500)
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  CashMovement,
  FinancePayment,
  FinanceReconciliationCandidate,
} from "@/lib/finance/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "suggested,confirmed";
  const wantedStatuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ["suggested", "confirmed", "rejected", "expired"].includes(s));
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? "100") || 100),
  );

  const { data, error } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .select(
      `*,
       payment:finance_payments!finance_reconciliation_candidates_payment_id_fkey(*),
       cash_movement:finance_cash_movements!finance_reconciliation_candidates_cash_movement_id_fkey(*)
      `,
    )
    .eq("tenant_id", auth.tenant_id)
    .in("status", wantedStatuses.length ? wantedStatuses : ["suggested", "confirmed"])
    .order("confidence", { ascending: false })
    .order("suggested_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[reconciliation candidates GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = (data ?? []) as Array<
    FinanceReconciliationCandidate & {
      payment?: FinancePayment | null;
      cash_movement?: CashMovement | null;
    }
  >;

  return NextResponse.json({ candidates });
}
