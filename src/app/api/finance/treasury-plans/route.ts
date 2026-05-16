import "server-only";

/* ===========================================================================
   /api/finance/treasury-plans

   GET  — list treasury plans for the tenant (newest updated first)
   POST — save a new treasury plan from a forecast snapshot

   Tenant-scoped, Finance-module gated.

   The POST handler stores the FULL ForecastResult in
   base_forecast_snapshot so the plan stays reproducible — the operator
   can reopen it months later and replay the exact trajectory + drivers
   that drove their decision.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { TreasuryPlan, TreasuryPlanMetrics, TreasuryPlanStatus } from "@/lib/finance/types";
import type { ForecastResult, ScenarioAssumptions } from "@/lib/intelligence/treasury-forecast";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  /* Phase S.4 — list-payload bound. The list endpoint NEVER returns
     `base_forecast_snapshot` (the 90-day trajectory + drivers + events
     blob, hundreds of KB per plan) or `scenario_assumptions`. Those
     live behind the detail endpoint. A 100-plan tenant used to ship a
     ~10 MB JSON; this drops it to <100 KB. Headline metrics + status
     + review state stay so cards render identically. */
  const { data, error } = await supabaseServer
    .from("finance_treasury_plans")
    .select(
      "id, tenant_id, name, description, projected_metrics, confidence, " +
      "forecast_window_days, status, created_by, reviewed_by, approved_by, " +
      "approved_at, review_notes, metadata, created_at, updated_at, deleted_at",
    )
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  /* Stamp the two omitted jsonb columns with empty objects so the
     existing TreasuryPlan shape on the client stays satisfied. */
  const plans = (data ?? []).map((row) => ({
    ...(row as unknown as Record<string, unknown>),
    base_forecast_snapshot: {},
    scenario_assumptions: {},
  })) as unknown as TreasuryPlan[];
  return NextResponse.json({ plans });
}

interface CreateBody {
  name: string;
  description?: string;
  status?: TreasuryPlanStatus;     // optional; defaults to 'draft'
  forecast: ForecastResult;        // the snapshot to lock in
  assumptions?: ScenarioAssumptions | null;
  metadata?: Record<string, unknown>;
}

function extractMetrics(forecast: ForecastResult): TreasuryPlanMetrics {
  return {
    startingCash:        forecast.startingCash,
    d7:                  forecast.d7,
    d30:                 forecast.d30,
    d60:                 forecast.d60,
    d90:                 forecast.d90,
    lowestProjected:     forecast.lowestProjected,
    lowestProjectedDate: forecast.lowestProjectedDate,
    firstNegativeDate:   forecast.firstNegativeDate,
    runwayDays:          forecast.runwayDays,
    totalInflow:         forecast.totalInflow,
    totalOutflow:        forecast.totalOutflow,
  };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name?.trim() || !body.forecast) {
    return NextResponse.json({ error: "name + forecast are required" }, { status: 400 });
  }

  const metrics = extractMetrics(body.forecast);
  const status: TreasuryPlanStatus = body.status === "under_review" ? "under_review" : "draft";

  const { data, error } = await supabaseServer
    .from("finance_treasury_plans")
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name.trim(),
      description: body.description ?? null,
      base_forecast_snapshot: body.forecast,
      scenario_assumptions: body.assumptions ?? {},
      projected_metrics: metrics,
      confidence: body.forecast.confidence ?? null,
      forecast_window_days: body.forecast.horizonDays ?? 90,
      status,
      created_by: auth.account_id,
      metadata: body.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data as TreasuryPlan });
}
