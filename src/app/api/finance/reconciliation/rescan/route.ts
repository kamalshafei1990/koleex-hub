import "server-only";

/* ===========================================================================
   POST /api/finance/reconciliation/rescan

   Recomputes the reconciliation queue:

     1. Load every unreconciled or partially-matched movement (last 180 d)
     2. Load every candidate payment (any reconciliation status except
        'verified', any non-cancelled / non-bounced)
     3. Skip pairs that already have an active or recently-rejected
        candidate row (rejected pairs are skipped until either the
        payment or the movement is updated after rejection — implemented
        as "skip if rejected_at >= max(payment.updated_at, movement.updated_at)")
     4. Run planCandidates() and insert one row per new suggestion
     5. Mark any "suggested" rows whose payment or movement changed
        materially as "expired"

   Body (optional):
     dry_run: boolean  — when true, returns the plan without writing.

   The route is idempotent — calling it twice yields the same set of
   active candidates.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  CashMovement,
  FinancePayment,
  FinanceReconciliationCandidate,
} from "@/lib/finance/types";
import { planCandidates } from "@/lib/finance/reconciliation-engine";

interface Body {
  dry_run?: boolean;
}

const LOOKBACK_DAYS = 180;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  const dryRun = body?.dry_run === true;

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

  /* ── 1. Pull inputs ── */
  const [movementsRes, paymentsRes, candidatesRes] = await Promise.all([
    supabaseServer
      .from("finance_cash_movements")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .gte("movement_date", sinceIso)
      .in("reconciliation_status", ["unreconciled", "matched", "partially_matched"])
      .order("movement_date", { ascending: false })
      .limit(500),
    supabaseServer
      .from("finance_payments")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .gte("payment_date", sinceIso)
      .not("status", "in", "(cancelled,bounced)")
      .order("payment_date", { ascending: false })
      .limit(500),
    /* Phase S.4 — rescan needs candidates that can affect the skip
       set: suggested (might be re-expired), confirmed (always skip),
       rejected (may re-skip if neither side changed since rejection).
       Expired candidates are truly historical and never re-enter the
       plan, so we exclude them. Slimmed columns: the rescan only
       reads ids + status + the two timestamps used by the
       skip-set logic. The (tenant_id, status, suggested_at DESC)
       index turns this into an index range scan. */
    supabaseServer
      .from("finance_reconciliation_candidates")
      .select("id, tenant_id, payment_id, cash_movement_id, status, suggested_at, rejected_at, updated_at")
      .eq("tenant_id", auth.tenant_id)
      .in("status", ["suggested", "confirmed", "rejected"]),
  ]);

  if (movementsRes.error || paymentsRes.error || candidatesRes.error) {
    const err =
      movementsRes.error?.message ??
      paymentsRes.error?.message ??
      candidatesRes.error?.message ??
      "Rescan input load failed";
    console.error("[recon rescan load]", err);
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const movements = (movementsRes.data ?? []) as CashMovement[];
  const payments = (paymentsRes.data ?? []) as FinancePayment[];
  const candidates = (candidatesRes.data ?? []) as FinanceReconciliationCandidate[];

  /* ── 2. Expire candidates whose underlying entities changed since
        suggested_at. Cheap, deterministic — keeps the queue honest. */
  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const movementById = new Map(movements.map((m) => [m.id, m]));
  const toExpireIds: string[] = [];
  for (const c of candidates) {
    if (c.status !== "suggested") continue;
    const p = paymentById.get(c.payment_id);
    const m = movementById.get(c.cash_movement_id);
    if (!p || !m) {
      toExpireIds.push(c.id);
      continue;
    }
    const suggestedMs = new Date(c.suggested_at).getTime();
    const pChanged = new Date(p.updated_at).getTime() > suggestedMs;
    const mChanged = new Date(m.updated_at).getTime() > suggestedMs;
    /* If the payment is now verified, also expire. */
    if (pChanged || mChanged || p.reconciliation_status === "verified") {
      toExpireIds.push(c.id);
    }
  }
  if (!dryRun && toExpireIds.length) {
    await supabaseServer
      .from("finance_reconciliation_candidates")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", toExpireIds)
      .eq("tenant_id", auth.tenant_id);
  }

  /* ── 3. Build the active-pair skip set.

        We skip pairs that are:
          · currently suggested (would dup-conflict on the unique index)
          · currently confirmed (already reconciled)
          · rejected AFTER both entities were last updated — i.e. the
            operator has already said "no" to this exact data shape.
        If either entity has been updated since the rejection, the pair
        is eligible again. */
  const skipPairs = new Set<string>();
  for (const c of candidates) {
    const key = `${c.payment_id}::${c.cash_movement_id}`;
    if (c.status === "suggested" && !toExpireIds.includes(c.id)) {
      skipPairs.add(key);
      continue;
    }
    if (c.status === "confirmed") {
      skipPairs.add(key);
      continue;
    }
    if (c.status === "rejected" && c.rejected_at) {
      const p = paymentById.get(c.payment_id);
      const m = movementById.get(c.cash_movement_id);
      if (!p || !m) continue;
      const rejectedMs = new Date(c.rejected_at).getTime();
      const pUpdatedMs = new Date(p.updated_at).getTime();
      const mUpdatedMs = new Date(m.updated_at).getTime();
      if (pUpdatedMs <= rejectedMs && mUpdatedMs <= rejectedMs) {
        skipPairs.add(key);
      }
    }
  }

  /* ── 4. Plan the candidates. */
  const planned = planCandidates({
    movements,
    payments,
    excludeActivePairs: skipPairs,
  });

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      expired_count: toExpireIds.length,
      planned_count: planned.length,
      planned,
    });
  }

  /* ── 5. Insert rows. The unique partial index protects against races. */
  if (planned.length === 0) {
    return NextResponse.json({
      ok: true,
      expired_count: toExpireIds.length,
      inserted_count: 0,
    });
  }

  const rows = planned.map((p) => ({
    tenant_id: auth.tenant_id,
    payment_id: p.payment_id,
    cash_movement_id: p.cash_movement_id,
    confidence: p.confidence,
    confidence_level: p.confidence_level,
    candidate_type: p.candidate_type,
    match_reason_summary: p.match_reason_summary,
    matched_factors: p.matched_factors,
    warnings: p.warnings,
    metadata: p.metadata,
    status: "suggested" as const,
    suggested_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseServer
    .from("finance_reconciliation_candidates")
    .insert(rows)
    .select("id");
  if (error) {
    console.error("[recon rescan insert]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    expired_count: toExpireIds.length,
    inserted_count: (data ?? []).length,
  });
}
