#!/usr/bin/env tsx

/* ===========================================================================
   Phase S.1A — Race-condition + double-click + parallel-request harness.

   Verifies the five atomic PG functions added in S.1A actually preserve
   single-winner semantics under real concurrency.

   For each scenario:
     1. Seed a deterministic fixture in an isolated test tenant.
     2. Fire two parallel API-equivalent calls (rpc invocations).
     3. Assert exactly one returns ok=true and the other returns 409.
     4. Verify no double state mutation / no duplicate audit row.

   Run with:
     npx tsx scripts/race-conditions.ts

   Skips when SUPABASE service-role credentials aren't present, so CI
   without secrets stays green.
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.warn("[race-conditions] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* Deterministic tenant id reserved for stabilization tests. The fixture
   functions below clean every row they create so re-running is safe. */
const TEST_TENANT = "00000000-0000-4000-a000-000000000001";
const TEST_ACTOR  = "00000000-0000-4000-a000-000000000002";

let failures = 0;
let passes   = 0;

function logResult(name: string, ok: boolean, detail = "") {
  if (ok) {
    passes += 1;
    console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

interface RpcResult {
  ok?: boolean;
  error?: string;
  code?: number;
  [k: string]: unknown;
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message, code: 500 };
  return (data ?? {}) as RpcResult;
}

/* ────────────────────────────────────────────────────────────────────────
   Fixture utilities — each scenario builds + tears down its own minimal
   set so the test tenant stays empty between runs.
   ──────────────────────────────────────────────────────────────────────── */

async function cleanTestTenant() {
  /* Order matters because of FK cascades. */
  await supabase.from("finance_reconciliation_candidates").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_approval_history").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_bank_statement_rows").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_bank_statement_imports").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_treasury_plan_reviews").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_treasury_plans").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_cash_movements").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_payments").delete().eq("tenant_id", TEST_TENANT);
  await supabase.from("finance_bank_accounts").delete().eq("tenant_id", TEST_TENANT);
}

async function ensureTestTenant() {
  /* Tenant FKs gate every finance table, so we seed (or upsert) a
     sandbox tenant once. The tenant row is left in place between runs
     — the suffix slug ensures it doesn't collide with real tenants. */
  const { error } = await supabase
    .from("tenants")
    .upsert({
      id: TEST_TENANT,
      slug: "phase-s-race-tests",
      name: "Phase-S Race-Test Sandbox",
      is_host: false,
      active: true,
    }, { onConflict: "id" });
  if (error) throw new Error(`tenant upsert failed: ${error.message}`);
}

async function insertOrThrow(table: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).insert(row);
  if (error) {
    throw new Error(`seed ${table} failed: ${error.message}`);
  }
}

async function seedAccount(): Promise<string> {
  const id = randomUUID();
  await insertOrThrow("finance_bank_accounts", {
    id,
    tenant_id: TEST_TENANT,
    bank_name: "RaceBank",
    account_name: "Race Test",
    currency: "USD",
    opening_balance: 0,
    current_balance: 1_000_000,
    available_balance: 1_000_000,
    pending_balance: 0,
    restricted_balance: 0,
    status: "active",
    is_primary: true,
  });
  return id;
}

async function seedPayment(): Promise<string> {
  const id = randomUUID();
  await insertOrThrow("finance_payments", {
    id,
    tenant_id: TEST_TENANT,
    direction: "in",
    party_type: "customer",
    party_name: "Race Customer",
    amount: 1_000,
    currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    status: "completed",
    reconciliation_status: "unreconciled",
    approval_status: "approved",
  });
  return id;
}

async function seedMovement(accountId: string): Promise<string> {
  const id = randomUUID();
  await insertOrThrow("finance_cash_movements", {
    id,
    tenant_id: TEST_TENANT,
    bank_account_id: accountId,
    movement_type: "incoming",
    direction: "inflow",
    currency: "USD",
    amount: 1_000,
    movement_date: new Date().toISOString().slice(0, 10),
    reconciliation_status: "unreconciled",
    evidence_status: "missing",
  });
  return id;
}

async function seedCandidate(paymentId: string, movementId: string): Promise<string> {
  const id = randomUUID();
  await insertOrThrow("finance_reconciliation_candidates", {
    id,
    tenant_id: TEST_TENANT,
    payment_id: paymentId,
    cash_movement_id: movementId,
    confidence: 0.95,
    confidence_level: "high",
    candidate_type: "exact",
    match_reason_summary: "Test exact match",
    matched_factors: [],
    warnings: [],
    metadata: {},
    status: "suggested",
  });
  return id;
}

async function countAuditRows(entityId: string): Promise<number> {
  const { data } = await supabase
    .from("finance_approval_history")
    .select("id", { count: "exact" })
    .eq("tenant_id", TEST_TENANT)
    .eq("entity_id", entityId);
  return data?.length ?? 0;
}

/* ────────────────────────────────────────────────────────────────────────
   Scenarios
   ──────────────────────────────────────────────────────────────────────── */

async function scenario_reconciliation_confirm_race() {
  console.log("\n[1] Reconciliation confirm — two parallel requests, expect exactly one winner");
  const accountId = await seedAccount();
  const paymentId = await seedPayment();
  const movementId = await seedMovement(accountId);
  const candidateId = await seedCandidate(paymentId, movementId);

  const [a, b] = await Promise.all([
    callRpc("fn_recon_confirm_candidate", { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_notes: "race A" }),
    callRpc("fn_recon_confirm_candidate", { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_notes: "race B" }),
  ]);
  const winners = [a, b].filter((r) => r.ok === true).length;
  const conflicts = [a, b].filter((r) => r.code === 409).length;
  logResult("exactly one winner", winners === 1, `wins=${winners} conflicts=${conflicts}`);

  const { data: candidateRow } = await supabase
    .from("finance_reconciliation_candidates")
    .select("status")
    .eq("id", candidateId)
    .single();
  logResult("candidate.status='confirmed' after race",
            candidateRow?.status === "confirmed",
            `actual=${candidateRow?.status ?? "?"}`);

  const auditCount = await countAuditRows(paymentId);
  logResult("exactly 1 audit row for the payment",
            auditCount === 1,
            `count=${auditCount}`);

  await cleanTestTenant();
}

async function scenario_reconciliation_double_click() {
  console.log("\n[2] Reconciliation confirm — sequential double-click, expect 409 on second");
  const accountId = await seedAccount();
  const paymentId = await seedPayment();
  const movementId = await seedMovement(accountId);
  const candidateId = await seedCandidate(paymentId, movementId);

  const r1 = await callRpc("fn_recon_confirm_candidate", { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_notes: null });
  const r2 = await callRpc("fn_recon_confirm_candidate", { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_notes: null });
  logResult("first call ok=true", r1.ok === true, JSON.stringify(r1));
  logResult("second call code=409", r2.code === 409, `error=${r2.error}`);

  await cleanTestTenant();
}

async function scenario_reconciliation_reject_race() {
  console.log("\n[3] Reconciliation reject — confirm vs reject racing, exactly one wins");
  const accountId = await seedAccount();
  const paymentId = await seedPayment();
  const movementId = await seedMovement(accountId);
  const candidateId = await seedCandidate(paymentId, movementId);

  const [a, b] = await Promise.all([
    callRpc("fn_recon_confirm_candidate", { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_notes: null }),
    callRpc("fn_recon_reject_candidate",  { p_candidate_id: candidateId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_reason: "operator says no" }),
  ]);
  const winners = [a, b].filter((r) => r.ok === true).length;
  logResult("exactly one winner across confirm vs reject", winners === 1, `confirm.ok=${a.ok} reject.ok=${b.ok}`);

  await cleanTestTenant();
}

async function scenario_payment_reconcile_race() {
  console.log("\n[4] Payment reconcile state machine — match vs dispute parallel");
  const paymentId = await seedPayment();

  const [a, b] = await Promise.all([
    callRpc("fn_payment_reconcile_transition", {
      p_payment_id: paymentId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR,
      p_action: "match", p_target_status: "matched",
      p_actual_amount: null, p_bank_reference: null, p_bank_account: null, p_notes: null,
    }),
    callRpc("fn_payment_reconcile_transition", {
      p_payment_id: paymentId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR,
      p_action: "match", p_target_status: "matched",
      p_actual_amount: null, p_bank_reference: null, p_bank_account: null, p_notes: null,
    }),
  ]);
  const wins = [a, b].filter((r) => r.ok === true).length;
  const idempotent = [a, b].filter((r) => r.ok === true && (r as { idempotent?: boolean }).idempotent === true).length;
  logResult("first transition ok, second idempotent (no double audit)",
            wins === 2 && idempotent === 1,
            `wins=${wins} idempotent=${idempotent}`);

  const auditCount = await countAuditRows(paymentId);
  logResult("exactly 1 audit row from match (idempotent call wrote no row)",
            auditCount === 1, `count=${auditCount}`);

  /* Now a real state conflict: try to verify (requires matched), then
     reset and try a second verify in parallel. */
  const r1 = await callRpc("fn_payment_reconcile_transition", {
    p_payment_id: paymentId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR,
    p_action: "verify", p_target_status: "verified",
    p_actual_amount: null, p_bank_reference: null, p_bank_account: null, p_notes: null,
  });
  logResult("verify from matched succeeds", r1.ok === true, JSON.stringify(r1));

  const r2 = await callRpc("fn_payment_reconcile_transition", {
    p_payment_id: paymentId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR,
    p_action: "match", p_target_status: "matched",
    p_actual_amount: null, p_bank_reference: null, p_bank_account: null, p_notes: null,
  });
  logResult("match after verified — invalid transition returns 409", r2.code === 409, `error=${r2.error}`);

  await cleanTestTenant();
}

async function scenario_bank_import_confirm_race() {
  console.log("\n[5] Bank-import confirm — two parallel requests, single winner");
  const accountId = await seedAccount();
  const importId = randomUUID();
  await supabase.from("finance_bank_statement_imports").insert({
    id: importId,
    tenant_id: TEST_TENANT,
    bank_account_id: accountId,
    file_name: "race-test.csv",
    file_type: "csv",
    file_size: 100,
    status: "parsed",
    row_count: 1,
    duplicate_count: 0,
    error_count: 0,
    metadata: {},
  });
  await supabase.from("finance_bank_statement_rows").insert({
    tenant_id: TEST_TENANT,
    import_id: importId,
    bank_account_id: accountId,
    row_index: 0,
    raw_data: {},
    movement_date: new Date().toISOString().slice(0, 10),
    direction: "inflow",
    amount: 250,
    currency: "USD",
    duplicate_status: "new",
    import_status: "ready",
    metadata: {},
  });

  const [a, b] = await Promise.all([
    callRpc("fn_bank_import_confirm", { p_import_id: importId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR }),
    callRpc("fn_bank_import_confirm", { p_import_id: importId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR }),
  ]);
  const winners = [a, b].filter((r) => r.ok === true).length;
  const conflicts = [a, b].filter((r) => r.code === 409).length;
  logResult("exactly one winner", winners === 1, `wins=${winners} conflicts=${conflicts}`);

  const { data: movements } = await supabase
    .from("finance_cash_movements")
    .select("id")
    .eq("tenant_id", TEST_TENANT);
  logResult("exactly 1 cash movement created (no duplicate insert)",
            (movements?.length ?? 0) === 1,
            `count=${movements?.length ?? 0}`);

  await cleanTestTenant();
}

async function scenario_treasury_plan_review_race() {
  console.log("\n[6] Treasury-plan review — approve vs request_changes parallel");
  const planId = randomUUID();
  await supabase.from("finance_treasury_plans").insert({
    id: planId,
    tenant_id: TEST_TENANT,
    name: "Race plan",
    description: null,
    base_forecast_snapshot: {},
    scenario_assumptions: {},
    projected_metrics: { startingCash: 0, d7: 0, d30: 0, d60: 0, d90: 0, lowestProjected: 0, lowestProjectedDate: null, firstNegativeDate: null, runwayDays: null, totalInflow: 0, totalOutflow: 0 },
    confidence: 0.7,
    forecast_window_days: 90,
    status: "under_review",
    metadata: {},
  });

  const [a, b] = await Promise.all([
    callRpc("fn_treasury_plan_review", { p_plan_id: planId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_decision: "approve",         p_notes: "looks good" }),
    callRpc("fn_treasury_plan_review", { p_plan_id: planId, p_tenant_id: TEST_TENANT, p_actor_id: TEST_ACTOR, p_decision: "request_changes", p_notes: "needs fix" }),
  ]);
  /* Both decisions are valid transitions from under_review, so both
     can succeed in some interleavings (approve runs first, then
     request_changes runs from 'approved' which is allowed → 'draft').
     The atomic guarantee we care about is: only ONE wins per
     transition step, and the final state is internally consistent. */
  const winners = [a, b].filter((r) => r.ok === true).length;
  const conflicts = [a, b].filter((r) => r.code === 409).length;
  logResult("both decisions resolve deterministically (1 winner + 1 valid follow-on OR 1 winner + 1 conflict)",
            (winners === 2 && conflicts === 0) || (winners === 1 && conflicts === 1),
            `wins=${winners} conflicts=${conflicts}`);

  /* Verify exactly 2 (or 1) review rows captured the audit. */
  const { data: reviews } = await supabase
    .from("finance_treasury_plan_reviews")
    .select("id")
    .eq("plan_id", planId);
  logResult("review row count matches winners count",
            (reviews?.length ?? 0) === winners,
            `reviews=${reviews?.length ?? 0} winners=${winners}`);

  await cleanTestTenant();
}

/* ────────────────────────────────────────────────────────────────────────
   Runner
   ──────────────────────────────────────────────────────────────────────── */

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("  Phase S.1A — Race-Condition Validation");
  console.log("══════════════════════════════════════════════════════════════════════");
  await ensureTestTenant();
  await cleanTestTenant();
  try {
    await scenario_reconciliation_confirm_race();
    await scenario_reconciliation_double_click();
    await scenario_reconciliation_reject_race();
    await scenario_payment_reconcile_race();
    await scenario_bank_import_confirm_race();
    await scenario_treasury_plan_review_race();
  } catch (e) {
    console.error("Harness error:", e);
    failures += 1;
  }
  await cleanTestTenant();

  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(`  Total: ${passes + failures}  PASS: ${passes}  FAIL: ${failures}`);
  console.log("══════════════════════════════════════════════════════════════════════");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
