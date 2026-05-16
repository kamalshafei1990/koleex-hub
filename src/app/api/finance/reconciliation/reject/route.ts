import "server-only";

/* ===========================================================================
   POST /api/finance/reconciliation/reject

   Marks a suggested candidate as rejected. Keeps the row for audit; the
   rescan endpoint won't re-suggest the same pair unless the underlying
   payment or movement changes materially (see rescan/route.ts).

   Body:
     candidate_id        uuid    (required)
     rejection_reason    string  (optional but encouraged)
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { FinanceReconciliationCandidate } from "@/lib/finance/types";

interface Body {
  candidate_id: string;
  rejection_reason?: string;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.candidate_id) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  /* Tenant + status check. */
  const { data: existing } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .select("id, tenant_id, status, payment_id, cash_movement_id")
    .eq("id", body.candidate_id)
    .maybeSingle();
  if (!existing || (existing as { tenant_id: string }).tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  if ((existing as { status: string }).status !== "suggested") {
    return NextResponse.json({ error: `Candidate is ${(existing as { status: string }).status}` }, { status: 409 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .update({
      status: "rejected",
      rejected_at: now,
      rejected_by: auth.account_id,
      rejection_reason: body.rejection_reason ?? null,
      updated_at: now,
    })
    .eq("id", body.candidate_id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[recon reject]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Audit row — captures the reject as a "review note" so it lands in
     the same history view as approvals/reconciliations. */
  await supabaseServer.from("finance_approval_history").insert({
    tenant_id: auth.tenant_id,
    entity_type: "payment",
    entity_id: (existing as { payment_id: string }).payment_id,
    action: "review_note",
    from_status: null,
    to_status: "rejected",
    actor_id: auth.account_id,
    notes: body.rejection_reason ?? "Reconciliation suggestion rejected by operator",
    metadata: {
      reconciliation_candidate_id: body.candidate_id,
      reconciliation: true,
      rejected: true,
      cash_movement_id: (existing as { cash_movement_id: string }).cash_movement_id,
    },
  });

  return NextResponse.json({ candidate: data as FinanceReconciliationCandidate });
}
