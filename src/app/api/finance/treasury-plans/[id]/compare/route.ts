import "server-only";

/* ===========================================================================
   POST /api/finance/treasury-plans/[id]/compare

   Body: { against: "current" | "plan", planId?: string }

   "current" — compare this plan against the live treasury state
               (re-runs the engine with no assumptions).
   "plan"    — compare this plan against another saved plan.

   Returns a structured diff with runway, negative-cash, and
   liquidity drivers so the UI can render the calm comparison panel
   without re-running the engine in-browser.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type {
  BankAccount,
  CashMovement,
  FinanceExpense,
  FinanceOrder,
  FinancePayment,
  TreasuryPlan,
  TreasuryPlanMetrics,
} from "@/lib/finance/types";
import {
  buildTreasuryForecast,
  type ForecastResult,
} from "@/lib/intelligence/treasury-forecast";

interface Body {
  against: "current" | "plan";
  planId?: string;
}

const LOOKBACK_DAYS = 60;

async function loadCurrentForecast(tenantId: string): Promise<ForecastResult> {
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [accountsRes, movementsRes, ordersRes, paymentsRes, expensesRes] = await Promise.all([
    supabaseServer.from("finance_bank_accounts").select("*").eq("tenant_id", tenantId).is("deleted_at", null),
    supabaseServer.from("finance_cash_movements").select("*").eq("tenant_id", tenantId).gte("movement_date", sinceIso).limit(500),
    supabaseServer.from("finance_orders").select("*, suppliers:finance_order_suppliers(*)").eq("tenant_id", tenantId),
    supabaseServer.from("finance_payments").select("*").eq("tenant_id", tenantId).not("status", "in", "(cancelled,bounced)"),
    supabaseServer.from("finance_expenses").select("*").eq("tenant_id", tenantId).neq("payment_status", "paid").limit(200),
  ]);
  return buildTreasuryForecast({
    bankAccounts:   (accountsRes.data ?? []) as BankAccount[],
    cashMovements:  (movementsRes.data ?? []) as CashMovement[],
    orders:         (ordersRes.data ?? []) as FinanceOrder[],
    payments:       (paymentsRes.data ?? []) as FinancePayment[],
    expenses:       (expensesRes.data ?? []) as FinanceExpense[],
  });
}

interface DiffShape {
  d7Delta: number;
  d30Delta: number;
  d60Delta: number;
  d90Delta: number;
  lowestDelta: number;
  runwayDelta: number | null;
  firstNegativeDateChange: { from: string | null; to: string | null } | null;
  direction: "improves" | "neutral" | "deteriorates";
}

function buildDiff(prev: TreasuryPlanMetrics, next: TreasuryPlanMetrics): DiffShape {
  const d90Delta = next.d90 - prev.d90;
  const runwayDelta =
    prev.runwayDays != null && next.runwayDays != null
      ? next.runwayDays - prev.runwayDays
      : prev.runwayDays == null && next.runwayDays != null
        ? -next.runwayDays
        : prev.runwayDays != null && next.runwayDays == null
          ? +999
          : null;
  const firstNegativeDateChange =
    prev.firstNegativeDate !== next.firstNegativeDate
      ? { from: prev.firstNegativeDate, to: next.firstNegativeDate }
      : null;
  return {
    d7Delta:   next.d7  - prev.d7,
    d30Delta:  next.d30 - prev.d30,
    d60Delta:  next.d60 - prev.d60,
    d90Delta,
    lowestDelta: next.lowestProjected - prev.lowestProjected,
    runwayDelta,
    firstNegativeDateChange,
    direction:
      Math.abs(d90Delta) < 1 ? "neutral" :
      d90Delta < 0 ? "deteriorates" : "improves",
  };
}

function planMetrics(plan: TreasuryPlan): TreasuryPlanMetrics {
  return plan.projected_metrics;
}

function forecastMetrics(f: ForecastResult): TreasuryPlanMetrics {
  return {
    startingCash:        f.startingCash,
    d7:                  f.d7,
    d30:                 f.d30,
    d60:                 f.d60,
    d90:                 f.d90,
    lowestProjected:     f.lowestProjected,
    lowestProjectedDate: f.lowestProjectedDate,
    firstNegativeDate:   f.firstNegativeDate,
    runwayDays:          f.runwayDays,
    totalInflow:         f.totalInflow,
    totalOutflow:        f.totalOutflow,
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (body.against !== "current" && body.against !== "plan")) {
    return NextResponse.json({ error: "against must be 'current' or 'plan'" }, { status: 400 });
  }

  const { data: planRow } = await supabaseServer
    .from("finance_treasury_plans")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!planRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  const plan = planRow as TreasuryPlan;
  const planM = planMetrics(plan);

  if (body.against === "current") {
    const current = await loadCurrentForecast(auth.tenant_id);
    const diff = buildDiff(planM, forecastMetrics(current));
    return NextResponse.json({ mode: "current", plan, current, diff });
  }

  /* against === "plan" */
  if (!body.planId) {
    return NextResponse.json({ error: "planId required for plan-vs-plan compare" }, { status: 400 });
  }
  const { data: otherRow } = await supabaseServer
    .from("finance_treasury_plans")
    .select("*")
    .eq("id", body.planId)
    .eq("tenant_id", auth.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!otherRow) return NextResponse.json({ error: "Other plan not found" }, { status: 404 });
  const other = otherRow as TreasuryPlan;
  const diff = buildDiff(planM, planMetrics(other));
  return NextResponse.json({ mode: "plan", plan, otherPlan: other, diff });
}
