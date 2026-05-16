import "server-only";

/* ===========================================================================
   POST /api/finance/treasury-plans/[id]/archive

   Soft-deactivates a plan. Plans are never hard-deleted; archive
   flips status to 'archived' and records an audit review row. The
   plan remains visible in the archive list and the timeline.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { TreasuryPlan } from "@/lib/finance/types";

interface Body {
  notes?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Body;
  const { data: existing } = await supabaseServer
    .from("finance_treasury_plans")
    .select("id, tenant_id, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if ((existing as { status: string }).status === "archived") {
    return NextResponse.json({ error: "Already archived" }, { status: 409 });
  }

  const { data: plan, error } = await supabaseServer
    .from("finance_treasury_plans")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseServer.from("finance_treasury_plan_reviews").insert({
    plan_id: id,
    tenant_id: auth.tenant_id,
    reviewer: auth.account_id,
    decision: "archive",
    notes: body.notes ?? null,
  });
  return NextResponse.json({ plan: plan as TreasuryPlan });
}
