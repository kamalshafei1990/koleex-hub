import "server-only";

/* ===========================================================================
   /api/finance/payments/[id]/reconcile

   Single endpoint for the reconciliation state machine:

     action ∈ (
       match            — actual ≈ expected, mark `matched`
       partial_match    — actual differs by a small tolerance, mark `partially_matched`
       mismatch         — diff exceeds tolerance, mark `mismatch`
       dispute          — formally disputed
       verify           — manager seal on a matched / mismatch decision
       reset            — back to unreconciled
     )

   Body may carry:
     actual_amount     numeric  (the bank-reported figure)
     bank_reference    string
     bank_account      string
     notes             string

   The DB trigger derives `difference_amount` from
   (actual_amount − expected_amount); we read it back on the response.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { FinancePayment, ReconciliationStatus } from "@/lib/finance/types";

type Action = "match" | "partial_match" | "mismatch" | "dispute" | "verify" | "reset";

const STATUS_FOR_ACTION: Record<Action, ReconciliationStatus> = {
  match:         "matched",
  partial_match: "partially_matched",
  mismatch:      "mismatch",
  dispute:       "disputed",
  verify:        "verified",
  reset:         "unreconciled",
};

interface Body {
  action: Action;
  actual_amount?: number;
  bank_reference?: string;
  bank_account?: string;
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = (await req.json()) as Body;
  if (!body || !body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }
  const targetStatus = STATUS_FOR_ACTION[body.action];
  if (!targetStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  /* Tenant scope check. */
  const { data: existing } = await supabaseServer
    .from("finance_payments").select("id, tenant_id").eq("id", id).maybeSingle();
  if (!existing || (existing as { tenant_id: string }).tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    reconciliation_status: targetStatus,
    reconciled_at: targetStatus === "unreconciled" ? null : now,
    reconciled_by: targetStatus === "unreconciled" ? null : auth.account_id,
    updated_at: now,
  };
  if (body.actual_amount != null)    patch.actual_amount = body.actual_amount;
  if (body.bank_reference !== undefined)  patch.bank_reference  = body.bank_reference || null;
  if (body.bank_account !== undefined)    patch.bank_account    = body.bank_account || null;
  if (body.notes !== undefined)           patch.reconciliation_notes = body.notes || null;

  /* Append a history entry so the audit trail captures reconciliation
     actions alongside approval actions. */
  await supabaseServer.from("finance_approval_history").insert({
    tenant_id: auth.tenant_id,
    entity_type: "payment",
    entity_id: id,
    action: body.action === "verify" ? "approve"
          : body.action === "mismatch" ? "request_changes"
          : body.action === "dispute"  ? "reject"
          : "review_note",
    from_status: null,
    to_status: targetStatus,
    actor_id: auth.account_id,
    notes: body.notes ?? null,
    amount_approved: body.actual_amount ?? null,
    metadata: {
      reconciliation: true,
      bank_reference: body.bank_reference ?? null,
    },
  });

  const { data, error } = await supabaseServer
    .from("finance_payments").update(patch).eq("id", id).eq("tenant_id", auth.tenant_id)
    .select("*").single();
  if (error) {
    console.error("[payment reconcile POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ payment: data as FinancePayment });
}
