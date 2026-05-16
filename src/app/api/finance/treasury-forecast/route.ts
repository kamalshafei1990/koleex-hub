import "server-only";

/* ===========================================================================
   POST /api/finance/treasury-forecast

   Server-side forecast endpoint. Pulls every input the engine needs
   (accounts, orders, payments, cash movements, expenses) in one
   round-trip, then runs the deterministic forecast engine with the
   operator's scenario assumptions.

   Returns the full base + (optional) stress result so the UI can
   render the trajectory, the diff, the drivers, and the risk
   ranking without a second call.

   Tenant-scoped, Finance-module gated. No DB writes.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  BankAccount,
  CashMovement,
  FinanceExpense,
  FinanceOrder,
  FinancePayment,
} from "@/lib/finance/types";
import {
  buildTreasuryForecast,
  compareForecasts,
  rankLiquidityRisks,
  type ScenarioAssumptions,
} from "@/lib/intelligence/treasury-forecast";

interface Body {
  assumptions?: ScenarioAssumptions | null;
  horizonDays?: number;
}

const LOOKBACK_DAYS = 60;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;

  /* Pull a wider window than the horizon — overdue items in
     ar/ap need to be visible to the engine. */
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  const [accountsRes, movementsRes, ordersRes, paymentsRes, expensesRes] = await Promise.all([
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .is("deleted_at", null),
    supabaseServer
      .from("finance_cash_movements")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .gte("movement_date", sinceIso)
      .limit(500),
    supabaseServer
      .from("finance_orders")
      .select("*, suppliers:finance_order_suppliers(*)")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_payments")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .not("status", "in", "(cancelled,bounced)"),
    supabaseServer
      .from("finance_expenses")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .neq("payment_status", "paid")
      .limit(200),
  ]);

  if (accountsRes.error) return NextResponse.json({ error: accountsRes.error.message }, { status: 500 });

  const inputs = {
    bankAccounts: (accountsRes.data ?? []) as BankAccount[],
    cashMovements: (movementsRes.data ?? []) as CashMovement[],
    orders: (ordersRes.data ?? []) as FinanceOrder[],
    payments: (paymentsRes.data ?? []) as FinancePayment[],
    expenses: (expensesRes.data ?? []) as FinanceExpense[],
    horizonDays: body.horizonDays ?? 90,
  };

  const base = buildTreasuryForecast(inputs);
  let stress = null;
  let diff = null;
  if (body.assumptions) {
    stress = buildTreasuryForecast(inputs, body.assumptions);
    diff = compareForecasts(base, stress);
  }
  const risks = rankLiquidityRisks(stress ?? base);

  return NextResponse.json({
    base,
    stress,
    diff,
    risks,
    assumptions: body.assumptions ?? null,
  });
}
