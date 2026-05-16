import "server-only";

/* ===========================================================================
   POST /api/finance/reconciliation/confirm

   Confirms a suggested match between a payment and a cash movement.

   Body:
     candidate_id    uuid    (required)
     notes           string  (optional — appended to reconciliation_notes)

   Side effects (all within one logical request):
     · candidate.status         → 'confirmed'
     · candidate.confirmed_at   → now
     · candidate.confirmed_by   → actor
     · payment.reconciliation_status changes per candidate_type:
         exact / fee_adjusted   → 'matched'
         partial / underpayment / overpayment → 'partially_matched'
         duplicate_risk         → 'mismatch'  (operator must review)
     · payment.actual_amount    → cash_movement.amount (if not set)
     · payment.difference_amount → server-calculated
     · cash_movement.reconciliation_status mirrors the payment status
     · cash_movement.related_payment_id is linked if not already
     · audit row written to finance_approval_history
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  CashMovement,
  FinancePayment,
  FinanceReconciliationCandidate,
  ReconciliationCandidateType,
  ReconciliationStatus,
} from "@/lib/finance/types";

interface Body {
  candidate_id: string;
  notes?: string;
}

function paymentStatusFor(candidateType: ReconciliationCandidateType): ReconciliationStatus {
  switch (candidateType) {
    case "exact":
    case "fee_adjusted":
      return "matched";
    case "partial":
    case "underpayment":
    case "overpayment":
      return "partially_matched";
    case "duplicate_risk":
      return "mismatch";
    default:
      return "matched";
  }
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

  /* Load candidate + joined entities; tenant-scope check. */
  const { data: candidateRow, error: loadErr } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .select(
      `*,
       payment:finance_payments!finance_reconciliation_candidates_payment_id_fkey(*),
       cash_movement:finance_cash_movements!finance_reconciliation_candidates_cash_movement_id_fkey(*)`,
    )
    .eq("id", body.candidate_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (loadErr) {
    console.error("[recon confirm load]", loadErr.message);
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!candidateRow) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const candidate = candidateRow as FinanceReconciliationCandidate & {
    payment?: FinancePayment | null;
    cash_movement?: CashMovement | null;
  };

  if (candidate.status !== "suggested") {
    return NextResponse.json({ error: `Candidate is ${candidate.status}` }, { status: 409 });
  }
  if (!candidate.payment || !candidate.cash_movement) {
    return NextResponse.json({ error: "Candidate is missing joined entities" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const targetReconStatus = paymentStatusFor(candidate.candidate_type);
  const expected = Number(candidate.payment.expected_amount ?? candidate.payment.amount ?? 0);
  const actual = Number(candidate.cash_movement.amount ?? 0);
  const diff = actual - expected;

  /* 1. Mark candidate confirmed. */
  const { error: candidateErr } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .update({
      status: "confirmed",
      confirmed_at: now,
      confirmed_by: auth.account_id,
      updated_at: now,
    })
    .eq("id", candidate.id)
    .eq("tenant_id", auth.tenant_id);
  if (candidateErr) {
    console.error("[recon confirm candidate]", candidateErr.message);
    return NextResponse.json({ error: candidateErr.message }, { status: 500 });
  }

  /* 2. Patch payment. */
  const paymentPatch: Record<string, unknown> = {
    reconciliation_status: targetReconStatus,
    reconciled_at: now,
    reconciled_by: auth.account_id,
    updated_at: now,
    actual_amount: candidate.payment.actual_amount ?? actual,
    difference_amount: candidate.payment.actual_amount != null
      ? Number(candidate.payment.actual_amount) - expected
      : diff,
  };
  if (!candidate.payment.bank_reference && candidate.cash_movement.bank_reference) {
    paymentPatch.bank_reference = candidate.cash_movement.bank_reference;
  }
  if (body.notes) {
    paymentPatch.reconciliation_notes = body.notes;
  }
  const { error: paymentErr } = await supabaseServer
    .from("finance_payments")
    .update(paymentPatch)
    .eq("id", candidate.payment.id)
    .eq("tenant_id", auth.tenant_id);
  if (paymentErr) {
    console.error("[recon confirm payment]", paymentErr.message);
    return NextResponse.json({ error: paymentErr.message }, { status: 500 });
  }

  /* 3. Patch movement — mirror status + link to the payment. */
  const movementPatch: Record<string, unknown> = {
    reconciliation_status: targetReconStatus,
    updated_at: now,
  };
  if (!candidate.cash_movement.related_payment_id) {
    movementPatch.related_payment_id = candidate.payment.id;
  }
  const { error: movementErr } = await supabaseServer
    .from("finance_cash_movements")
    .update(movementPatch)
    .eq("id", candidate.cash_movement.id)
    .eq("tenant_id", auth.tenant_id);
  if (movementErr) {
    console.error("[recon confirm movement]", movementErr.message);
    return NextResponse.json({ error: movementErr.message }, { status: 500 });
  }

  /* 4. Audit history — reuse the approval-history audit table so the
        whole control-plane can be queried from one place. */
  await supabaseServer.from("finance_approval_history").insert({
    tenant_id: auth.tenant_id,
    entity_type: "payment",
    entity_id: candidate.payment.id,
    action: "review_note",
    from_status: candidate.payment.reconciliation_status ?? "unreconciled",
    to_status: targetReconStatus,
    actor_id: auth.account_id,
    notes: body.notes ?? candidate.match_reason_summary,
    amount_approved: actual,
    metadata: {
      reconciliation_candidate_id: candidate.id,
      reconciliation: true,
      candidate_type: candidate.candidate_type,
      confidence: candidate.confidence,
      cash_movement_id: candidate.cash_movement.id,
    },
  });

  return NextResponse.json({
    ok: true,
    candidate_id: candidate.id,
    payment_id: candidate.payment.id,
    cash_movement_id: candidate.cash_movement.id,
    reconciliation_status: targetReconStatus,
    difference_amount: diff,
  });
}
