import "server-only";

/* ===========================================================================
   /api/finance/treasury-plans/[id]

   GET   — plan envelope + versions + reviews (full executive view)
   PATCH — edit assumptions, name, description, status; writes a
           version row capturing previous_metrics + diff_summary so
           the timeline can replay every change.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  TreasuryPlan,
  TreasuryPlanMetrics,
  TreasuryPlanReview,
  TreasuryPlanStatus,
  TreasuryPlanVersion,
} from "@/lib/finance/types";
import type { ForecastResult } from "@/lib/intelligence/treasury-forecast";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const [planRes, versionsRes, reviewsRes] = await Promise.all([
    supabaseServer
      .from("finance_treasury_plans")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabaseServer
      .from("finance_treasury_plan_versions")
      .select("*")
      .eq("plan_id", id)
      .eq("tenant_id", auth.tenant_id)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("finance_treasury_plan_reviews")
      .select("*")
      .eq("plan_id", id)
      .eq("tenant_id", auth.tenant_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!planRes.data) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  return NextResponse.json({
    plan: planRes.data as TreasuryPlan,
    versions: (versionsRes.data ?? []) as TreasuryPlanVersion[],
    reviews: (reviewsRes.data ?? []) as TreasuryPlanReview[],
  });
}

interface PatchBody {
  name?: string;
  description?: string | null;
  status?: TreasuryPlanStatus;
  forecast?: ForecastResult;                         // optional new snapshot
  assumptions?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  review_notes?: string | null;
  /** Phase S.2 — optimistic concurrency token. When supplied, the
   *  UPDATE pins to the loaded row's `updated_at`; any concurrent edit
   *  invalidates this value and the API returns 409. */
  expected_updated_at?: string;
}

function diffMetrics(prev: TreasuryPlanMetrics, next: TreasuryPlanMetrics): Record<string, unknown> {
  return {
    d7Delta:  next.d7  - prev.d7,
    d30Delta: next.d30 - prev.d30,
    d60Delta: next.d60 - prev.d60,
    d90Delta: next.d90 - prev.d90,
    lowestDelta: next.lowestProjected - prev.lowestProjected,
    runwayDelta:
      prev.runwayDays != null && next.runwayDays != null
        ? next.runwayDays - prev.runwayDays
        : null,
    negativeDateChange:
      prev.firstNegativeDate !== next.firstNegativeDate
        ? { from: prev.firstNegativeDate, to: next.firstNegativeDate }
        : null,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { data: existingRow } = await supabaseServer
    .from("finance_treasury_plans")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existingRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  const existing = existingRow as TreasuryPlan;
  if (existing.status === "archived" && body.status !== undefined) {
    return NextResponse.json({ error: "Cannot edit an archived plan" }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name        != null) patch.name        = body.name.trim();
  if (body.description !== undefined) patch.description = body.description ?? null;
  if (body.status      != null) patch.status      = body.status;
  if (body.assumptions !== undefined) patch.scenario_assumptions = body.assumptions ?? {};
  if (body.metadata    != null) patch.metadata    = body.metadata;
  if (body.review_notes !== undefined) patch.review_notes = body.review_notes ?? null;

  /* Snapshot update — re-locks the forecast metrics + records a version row. */
  const prevMetrics: TreasuryPlanMetrics = existing.projected_metrics;
  let nextMetrics: TreasuryPlanMetrics | null = null;
  if (body.forecast) {
    nextMetrics = {
      startingCash:        body.forecast.startingCash,
      d7:                  body.forecast.d7,
      d30:                 body.forecast.d30,
      d60:                 body.forecast.d60,
      d90:                 body.forecast.d90,
      lowestProjected:     body.forecast.lowestProjected,
      lowestProjectedDate: body.forecast.lowestProjectedDate,
      firstNegativeDate:   body.forecast.firstNegativeDate,
      runwayDays:          body.forecast.runwayDays,
      totalInflow:         body.forecast.totalInflow,
      totalOutflow:        body.forecast.totalOutflow,
    };
    patch.base_forecast_snapshot = body.forecast;
    patch.projected_metrics = nextMetrics;
    patch.confidence = body.forecast.confidence ?? null;
    patch.forecast_window_days = body.forecast.horizonDays ?? 90;
  }

  /* Write a version row only when something material changed. */
  const hasAssumptionChange = body.assumptions !== undefined;
  const hasForecastChange = !!body.forecast && nextMetrics != null;
  if (hasAssumptionChange || hasForecastChange) {
    const diff = nextMetrics ? diffMetrics(prevMetrics, nextMetrics) : {};
    await supabaseServer.from("finance_treasury_plan_versions").insert({
      plan_id: id,
      tenant_id: auth.tenant_id,
      previous_assumptions: existing.scenario_assumptions,
      previous_metrics: prevMetrics,
      diff_summary: diff,
      changed_by: auth.account_id,
    });
  }
  void prevMetrics;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ plan: existing });
  }

  /* Phase S.2 — optimistic concurrency. If the client supplied the
     row's loaded updated_at, pin the UPDATE to it. A concurrent edit
     between SELECT and UPDATE invalidates this token; RETURNING is
     empty and we surface 409. Clients that don't supply the token
     keep the legacy last-write-wins behaviour for compatibility. */
  let query = supabaseServer
    .from("finance_treasury_plans")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (body.expected_updated_at) {
    query = query.eq("updated_at", body.expected_updated_at);
  }
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data && body.expected_updated_at) {
    return NextResponse.json(
      { error: "stale_update", details: "plan was modified by another operator" },
      { status: 409 },
    );
  }
  return NextResponse.json({ plan: (data ?? existing) as TreasuryPlan });
}
