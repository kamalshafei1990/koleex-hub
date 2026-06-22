import "server-only";

/* ===========================================================================
   POST /api/finance/payments/[id]/reconcile

   Phase S.1A — Transactional integrity hardening.

   The previous implementation read the payment, decided a target
   status, then issued a blanket UPDATE without checking the row's
   actual current status — so two operators picking different actions
   (one "match", one "dispute") could both succeed and the audit
   would record both even though the final state reflected only the
   later writer.

   This route now defers the entire transition to
   `fn_payment_reconcile_transition`. The function:

     · Locks the row FOR UPDATE.
     · Returns idempotent success if the row is already at the
       target status AND no new actual_amount / notes were supplied.
     · Validates the requested transition against an explicit
       per-action allow list of prior statuses.
     · Applies the UPDATE with the previous status pinned in WHERE
       so a concurrent transition by another operator surfaces 409.
     · Writes the audit row only after the UPDATE succeeded.

   Action vocabulary:
     · match           → matched
     · partial_match   → partially_matched
     · mismatch        → mismatch
     · dispute         → disputed
     · verify          → verified
     · reset           → unreconciled
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
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

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  payment?: FinancePayment;
  idempotent?: boolean;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }
  const targetStatus = STATUS_FOR_ACTION[body.action];
  if (!targetStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const { data, error } = await supabaseServer.rpc("fn_payment_reconcile_transition", {
    p_payment_id:    id,
    p_tenant_id:     auth.tenant_id,
    p_actor_id:      auth.account_id,
    p_action:        body.action,
    p_target_status: targetStatus,
    p_actual_amount: body.actual_amount ?? null,
    p_bank_reference: body.bank_reference ?? null,
    p_bank_account:   body.bank_account ?? null,
    p_notes:          body.notes ?? null,
  });

  if (error) {
    console.error("[payment reconcile rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as RpcResult;
  if (!result.ok) {
    const status = result.code === 404 ? 404 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict", details: result }, { status });
  }

  return NextResponse.json({ payment: result.payment });
}
