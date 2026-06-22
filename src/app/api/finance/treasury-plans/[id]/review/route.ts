import "server-only";

/* ===========================================================================
   POST /api/finance/treasury-plans/[id]/review

   Phase S.1A — Transactional integrity hardening.

   The previous implementation issued the plan UPDATE and the review-
   row INSERT in parallel via Promise.all. If two reviewers clicked
   contradicting decisions (approve vs request_changes) at the same
   time, both wrote rows and the final plan state was arbitrary.

   This route now defers to `fn_treasury_plan_review` which:

     · Locks the plan FOR UPDATE.
     · Validates the requested decision is legal from the current
       status (approve from draft/under_review; request_changes from
       draft/under_review/approved; archive from anything except
       archived).
     · Pins the previous status in the UPDATE WHERE — concurrent
       reviewers receive 409.
     · Writes the append-only review row only after the UPDATE
       succeeded.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { TreasuryPlan, TreasuryPlanReviewDecision } from "@/lib/finance/types";

interface Body {
  decision: TreasuryPlanReviewDecision;
  notes?: string;
}

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  plan?: TreasuryPlan;
  review_id?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !["approve", "request_changes", "archive"].includes(body.decision)) {
    return NextResponse.json({ error: "decision must be approve/request_changes/archive" }, { status: 400 });
  }

  const { data, error } = await supabaseServer.rpc("fn_treasury_plan_review", {
    p_plan_id:   id,
    p_tenant_id: auth.tenant_id,
    p_actor_id:  auth.account_id,
    p_decision:  body.decision,
    p_notes:     body.notes ?? null,
  });

  if (error) {
    console.error("[treasury-plan review rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as RpcResult;
  if (!result.ok) {
    const status = result.code === 404 ? 404 : result.code === 400 ? 400 : 409;
    return NextResponse.json({ error: result.error ?? "Conflict", details: result }, { status });
  }

  return NextResponse.json({
    plan: result.plan,
    review: { id: result.review_id, decision: body.decision, notes: body.notes ?? null },
  });
}
