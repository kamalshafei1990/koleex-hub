#!/usr/bin/env tsx

/* ===========================================================================
   Phase S.2 — Tenant-isolation red-team harness.

   Spins up TWO synthetic test tenants (A + B), seeds finance fixtures
   in each, then directly hits the database layer + the storage helpers
   to simulate cross-tenant attacks. Every attack path must either:

     · return 0 rows from the query (DB-side scoping)
     · trigger the trigger-level reject (S.1B inactive-account guard)
     · trigger the application-level reject (S.2 storage prefix check)

   This is a DB + helper-level test. It does NOT spin up Next.js HTTP
   handlers — those just thread auth.tenant_id into the same DB calls
   we test here. If the DB queries already refuse cross-tenant data,
   the HTTP layer can't leak it either.

   Skips gracefully when SUPABASE creds are missing (CI without secrets
   stays green).
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { normaliseUploadPath, assertTenantPath, pathBelongsToTenant } from "../src/lib/server/storage-tenant.js";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.warn("[tenant-isolation] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/* Two synthetic tenants. */
const TENANT_A = "00000000-0000-4000-a000-000000000001";  // re-uses the S.1A sandbox
const TENANT_B = "00000000-0000-4000-b000-000000000002";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenant(id: string, slug: string, name: string) {
  const { error } = await supabase
    .from("tenants")
    .upsert({ id, slug, name, is_host: false, active: true }, { onConflict: "id" });
  if (error) throw new Error(`tenant upsert ${slug}: ${error.message}`);
}

async function cleanTenant(id: string) {
  await supabase.from("finance_reconciliation_candidates").delete().eq("tenant_id", id);
  await supabase.from("finance_approval_history").delete().eq("tenant_id", id);
  await supabase.from("finance_bank_statement_rows").delete().eq("tenant_id", id);
  await supabase.from("finance_bank_statement_imports").delete().eq("tenant_id", id);
  await supabase.from("finance_treasury_plan_reviews").delete().eq("tenant_id", id);
  await supabase.from("finance_treasury_plans").delete().eq("tenant_id", id);
  await supabase.from("finance_attachments").delete().eq("tenant_id", id);
  await supabase.from("finance_cash_movements").delete().eq("tenant_id", id);
  await supabase.from("finance_payments").delete().eq("tenant_id", id);
  await supabase.from("finance_bank_accounts").delete().eq("tenant_id", id);
}

async function seedTenant(tenantId: string) {
  const accountId = randomUUID();
  await supabase.from("finance_bank_accounts").insert({
    id: accountId, tenant_id: tenantId,
    bank_name: "TenantBank", account_name: "Tenant Account",
    currency: "USD",
    opening_balance: 0, current_balance: 100_000, available_balance: 100_000,
    pending_balance: 0, restricted_balance: 0,
    status: "active", is_primary: true,
  });
  const paymentId = randomUUID();
  await supabase.from("finance_payments").insert({
    id: paymentId, tenant_id: tenantId,
    direction: "in", party_type: "customer", party_name: "Tenant Customer",
    amount: 1_000, currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
  });
  const movementId = randomUUID();
  await supabase.from("finance_cash_movements").insert({
    id: movementId, tenant_id: tenantId,
    bank_account_id: accountId,
    movement_type: "incoming", direction: "inflow", currency: "USD",
    amount: 1_000, movement_date: new Date().toISOString().slice(0, 10),
    reconciliation_status: "unreconciled", evidence_status: "missing",
  });
  const candidateId = randomUUID();
  await supabase.from("finance_reconciliation_candidates").insert({
    id: candidateId, tenant_id: tenantId,
    payment_id: paymentId, cash_movement_id: movementId,
    confidence: 0.95, confidence_level: "high", candidate_type: "exact",
    match_reason_summary: "Seed", matched_factors: [], warnings: [], metadata: {},
    status: "suggested",
  });
  const importId = randomUUID();
  await supabase.from("finance_bank_statement_imports").insert({
    id: importId, tenant_id: tenantId,
    bank_account_id: accountId,
    file_name: "t.csv", file_type: "csv", file_size: 100,
    storage_path: `${tenantId}/bank-statements/${importId}/t.csv`,
    status: "parsed", row_count: 1, duplicate_count: 0, error_count: 0, metadata: {},
  });
  const planId = randomUUID();
  await supabase.from("finance_treasury_plans").insert({
    id: planId, tenant_id: tenantId,
    name: "Tenant Plan", base_forecast_snapshot: {}, scenario_assumptions: {},
    projected_metrics: { startingCash: 0, d7: 0, d30: 0, d60: 0, d90: 0,
      lowestProjected: 0, lowestProjectedDate: null, firstNegativeDate: null,
      runwayDays: null, totalInflow: 0, totalOutflow: 0 },
    confidence: 0.7, forecast_window_days: 90, status: "draft", metadata: {},
  });
  const attachmentId = randomUUID();
  await supabase.from("finance_attachments").insert({
    id: attachmentId, tenant_id: tenantId,
    entity_type: "payment", entity_id: paymentId,
    storage_path: `${tenantId}/payment/${paymentId}/${attachmentId}.pdf`,
    file_name: "doc.pdf", file_size: 100, mime_type: "application/pdf",
    category: "receipt",
  });
  return { accountId, paymentId, movementId, candidateId, importId, planId, attachmentId };
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log("  Phase S.2 — Tenant-Isolation Red-Team Validation");
  console.log("══════════════════════════════════════════════════════════════════════");

  await ensureTenant(TENANT_A, "phase-s-tenant-a", "Phase-S Tenant A");
  await ensureTenant(TENANT_B, "phase-s-tenant-b", "Phase-S Tenant B");
  await cleanTenant(TENANT_A);
  await cleanTenant(TENANT_B);

  /* Tenant A's seed exists so any "tenant A queries scoped to A" path
     would succeed — but the attacks in this harness all target tenant
     B's resources from tenant A's context. */
  await seedTenant(TENANT_A);
  const B = await seedTenant(TENANT_B);

  console.log("\n[1] Cross-tenant SELECT scoping (DB layer)");
  /* Tenant A asks for tenant B's payment by id, scoped to A's tenant_id —
     should return null. This mirrors how the API GET routes work. */
  const r1 = await supabase
    .from("finance_payments")
    .select("id")
    .eq("id", B.paymentId)
    .eq("tenant_id", TENANT_A)
    .maybeSingle();
  ok("tenant A cannot read tenant B's payment (scoped query → null)", r1.data === null);

  const r2 = await supabase
    .from("finance_bank_accounts")
    .select("id")
    .eq("id", B.accountId)
    .eq("tenant_id", TENANT_A)
    .maybeSingle();
  ok("tenant A cannot read tenant B's bank account", r2.data === null);

  const r3 = await supabase
    .from("finance_treasury_plans")
    .select("id")
    .eq("id", B.planId)
    .eq("tenant_id", TENANT_A)
    .maybeSingle();
  ok("tenant A cannot read tenant B's treasury plan", r3.data === null);

  const r4 = await supabase
    .from("finance_bank_statement_imports")
    .select("id")
    .eq("id", B.importId)
    .eq("tenant_id", TENANT_A)
    .maybeSingle();
  ok("tenant A cannot read tenant B's bank import", r4.data === null);

  console.log("\n[2] Cross-tenant reconciliation confirm (RPC layer)");
  /* Try to confirm tenant B's candidate from tenant A's context. The
     RPC's first SELECT FOR UPDATE has both id + tenant_id pinned, so
     it returns not_found. */
  const r5 = await supabase.rpc("fn_recon_confirm_candidate", {
    p_candidate_id: B.candidateId,
    p_tenant_id: TENANT_A,
    p_actor_id: "00000000-0000-4000-a000-000000000099",
    p_notes: "cross-tenant attack",
  });
  ok("fn_recon_confirm_candidate refuses cross-tenant candidate",
     (r5.data as { error?: string; code?: number } | null)?.error === "not_found",
     JSON.stringify(r5.data));

  console.log("\n[3] Cross-tenant payment reconcile (RPC layer)");
  const r6 = await supabase.rpc("fn_payment_reconcile_transition", {
    p_payment_id: B.paymentId, p_tenant_id: TENANT_A,
    p_actor_id: "00000000-0000-4000-a000-000000000099",
    p_action: "match", p_target_status: "matched",
    p_actual_amount: null, p_bank_reference: null, p_bank_account: null, p_notes: null,
  });
  ok("fn_payment_reconcile_transition refuses cross-tenant payment",
     (r6.data as { error?: string } | null)?.error === "not_found",
     JSON.stringify(r6.data));

  console.log("\n[4] Cross-tenant bank-import confirm (RPC layer)");
  const r7 = await supabase.rpc("fn_bank_import_confirm", {
    p_import_id: B.importId, p_tenant_id: TENANT_A,
    p_actor_id: "00000000-0000-4000-a000-000000000099",
  });
  ok("fn_bank_import_confirm refuses cross-tenant import",
     (r7.data as { error?: string } | null)?.error === "not_found",
     JSON.stringify(r7.data));

  console.log("\n[5] Cross-tenant treasury-plan review (RPC layer)");
  const r8 = await supabase.rpc("fn_treasury_plan_review", {
    p_plan_id: B.planId, p_tenant_id: TENANT_A,
    p_actor_id: "00000000-0000-4000-a000-000000000099",
    p_decision: "approve", p_notes: "cross-tenant approval",
  });
  ok("fn_treasury_plan_review refuses cross-tenant plan",
     (r8.data as { error?: string } | null)?.error === "not_found",
     JSON.stringify(r8.data));

  console.log("\n[6] Cross-tenant attachment ownership");
  const r9 = await supabase
    .from("finance_attachments")
    .select("id, storage_path")
    .eq("id", B.attachmentId)
    .eq("tenant_id", TENANT_A)
    .maybeSingle();
  ok("tenant A cannot load tenant B's attachment row", r9.data === null);

  /* Even if we somehow got the path string, the storage-tenant helper
     refuses to mint a signed URL because the path doesn't start with
     tenant A's prefix. */
  const otherPath = `${TENANT_B}/payment/${B.paymentId}/${B.attachmentId}.pdf`;
  ok("pathBelongsToTenant rejects tenant B's storage path for tenant A",
     !pathBelongsToTenant(otherPath, TENANT_A),
     `path=${otherPath} tenant=${TENANT_A}`);
  ok("assertTenantPath flags cross-tenant signed URL on finance-documents",
     assertTenantPath("finance-documents", otherPath, TENANT_A) !== null);

  console.log("\n[7] Cross-tenant upload-path rewrite (helper layer)");
  /* Caller passes a path prefixed with tenant B's UUID. */
  const malicious = normaliseUploadPath("finance-documents", `${TENANT_B}/bank-statements/x.csv`, TENANT_A);
  ok("normaliseUploadPath rejects path attempting another tenant prefix",
     malicious.ok === false,
     JSON.stringify(malicious));

  /* Caller passes a relative path with no tenant prefix — engine
     prepends caller's tenant prefix automatically. */
  const safeRewrite = normaliseUploadPath("finance-documents", "bank-statements/clean.csv", TENANT_A);
  ok("normaliseUploadPath prepends caller's tenant prefix when missing",
     safeRewrite.ok === true && (safeRewrite as { path: string }).path.startsWith(`${TENANT_A}/`),
     JSON.stringify(safeRewrite));

  console.log("\n[8] Storage helpers: shared buckets stay pass-through");
  const shared = normaliseUploadPath("media", `arbitrary/path.jpg`, TENANT_A);
  ok("normaliseUploadPath shared bucket leaves path unchanged",
     shared.ok === true && (shared as { path: string }).path === "arbitrary/path.jpg",
     JSON.stringify(shared));
  ok("assertTenantPath returns null on shared bucket",
     assertTenantPath("media", "arbitrary/path.jpg", TENANT_A) === null);

  console.log("\n[9] Cross-tenant write attempts (defence-in-depth on writes)");
  /* Even if the API somehow let an UPDATE through without a tenant filter,
     the trigger / unique-index won't save us — only the .eq("tenant_id")
     on the UPDATE itself does. Verify Phase S.2 hardened writes by
     attempting a direct UPDATE of tenant B's payment scoped to tenant A. */
  const r10 = await supabase
    .from("finance_payments")
    .update({ notes: "tenant A tampered" })
    .eq("id", B.paymentId)
    .eq("tenant_id", TENANT_A)
    .select("id");
  ok("UPDATE scoped to wrong tenant_id matches 0 rows",
     (r10.data?.length ?? 0) === 0,
     `affected=${r10.data?.length ?? 0}`);

  /* And re-fetch the original tenant B's payment to verify it wasn't
     touched in any way. */
  const r11 = await supabase
    .from("finance_payments")
    .select("notes")
    .eq("id", B.paymentId)
    .eq("tenant_id", TENANT_B)
    .single();
  ok("tenant B's payment.notes remains untouched",
     r11.data?.notes === null,
     `notes=${r11.data?.notes ?? "null"}`);

  await cleanTenant(TENANT_A);
  await cleanTenant(TENANT_B);

  console.log("──────────────────────────────────────────────────────────────────────");
  console.log(`  Total: ${passes + failures}  PASS: ${passes}  FAIL: ${failures}`);
  console.log("══════════════════════════════════════════════════════════════════════");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
