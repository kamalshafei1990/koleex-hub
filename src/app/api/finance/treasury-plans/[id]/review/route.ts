import "server-only";

/* ===========================================================================
   POST /api/finance/treasury-plans/[id]/review

   Single-reviewer governance gate. Three decisions:

     · approve          → status='approved' + approved_by + approved_at
     · request_changes  → status='draft'    (reviewer asks for edits)
     · archive          → status='archived'

   Every decision writes a finance_treasury_plan_reviews row for audit.
   Plans are never hard-deleted.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { TreasuryPlan, TreasuryPlanReview, TreasuryPlanReviewDecision } from "@/lib/finance/types";

interface Body {
  decision: TreasuryPlanReviewDecision;
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !["approve", "request_changes", "archive"].includes(body.decision)) {
    return NextResponse.json({ error: "decision must be approve/request_changes/archive" }, { status: 400 });
  }

  const { data: existing } = await supabaseServer
    .from("finance_treasury_plans")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  const plan = existing as TreasuryPlan;
  if (plan.status === "archived") {
    return NextResponse.json({ error: "Plan already archived" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    reviewed_by: auth.account_id,
    review_notes: body.notes ?? plan.review_notes,
  };
  if (body.decision === "approve") {
    patch.status = "approved";
    patch.approved_by = auth.account_id;
    patch.approved_at = now;
  } else if (body.decision === "request_changes") {
    patch.status = "draft";
  } else if (body.decision === "archive") {
    patch.status = "archived";
  }

  const [{ data: updatedPlan, error: updateErr }, { data: reviewRow, error: reviewErr }] = await Promise.all([
    supabaseServer
      .from("finance_treasury_plans")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single(),
    supabaseServer
      .from("finance_treasury_plan_reviews")
      .insert({
        plan_id: id,
        tenant_id: auth.tenant_id,
        reviewer: auth.account_id,
        decision: body.decision,
        notes: body.notes ?? null,
      })
      .select("*")
      .single(),
  ]);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  if (reviewErr) return NextResponse.json({ error: reviewErr.message }, { status: 500 });

  return NextResponse.json({
    plan: updatedPlan as TreasuryPlan,
    review: reviewRow as TreasuryPlanReview,
  });
}
