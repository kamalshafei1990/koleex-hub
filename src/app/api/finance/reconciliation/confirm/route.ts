import "server-only";

/* ===========================================================================
   POST /api/finance/reconciliation/confirm

   Phase S.1A — Transactional Integrity Hardening.

   This endpoint used to perform four sequential writes (candidate +
   payment + movement + audit) with no transaction wrap. Two operators
   confirming the same candidate concurrently could corrupt the ledger
   by both writing audit rows + flipping movement.related_payment_id.

   The whole mutation now lives inside the Postgres function
   `fn_recon_confirm_candidate`, which:

     · Locks candidate, payment, and cash movement FOR UPDATE in a
       deterministic order (deadlock-free across the suite).
     · Validates that the candidate is still `suggested`, the payment
       is not already `verified`, and the movement is not `verified`.
     · Applies the cascading state transitions + audit insert atomically.
     · Returns 409 if any guard fails — silent overwrite is impossible.

   Frontend contract is unchanged.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

interface Body {
  candidate_id: string;
  notes?: string;
}

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  candidate_id?: string;
  payment_id?: string;
  cash_movement_id?: string;
  reconciliation_status?: string;
  difference_amount?: number;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.candidate_id) {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer.rpc("fn_recon_confirm_candidate", {
    p_candidate_id: body.candidate_id,
    p_tenant_id: auth.tenant_id,
    p_actor_id: auth.account_id,
    p_notes: body.notes ?? null,
  });

  if (error) {
    console.error("[recon confirm rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as RpcResult;
  if (!result.ok) {
    /* Function returned a structured conflict — pass the code through. */
    const status = result.code === 404 ? 404 : result.code === 400 ? 400 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict" }, { status });
  }

  return NextResponse.json(result);
}
