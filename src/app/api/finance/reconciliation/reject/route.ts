import "server-only";

/* ===========================================================================
   POST /api/finance/reconciliation/reject

   Phase S.1A — atomic transition via fn_recon_reject_candidate.
   The conditional UPDATE pins status='suggested'; if another operator
   already moved the candidate (confirmed, rejected, expired), the
   RETURNING is empty and we surface 409. Audit row written only when
   the state transition actually succeeded.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { FinanceReconciliationCandidate } from "@/lib/finance/types";

interface Body {
  candidate_id: string;
  rejection_reason?: string;
}

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  candidate?: FinanceReconciliationCandidate;
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

  const { data, error } = await supabaseServer.rpc("fn_recon_reject_candidate", {
    p_candidate_id: body.candidate_id,
    p_tenant_id: auth.tenant_id,
    p_actor_id: auth.account_id,
    p_reason: body.rejection_reason ?? null,
  });

  if (error) {
    console.error("[recon reject rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as RpcResult;
  if (!result.ok) {
    const status = result.code === 404 ? 404 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict" }, { status });
  }

  return NextResponse.json({ candidate: result.candidate });
}
