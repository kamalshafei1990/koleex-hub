#!/usr/bin/env tsx

/* ===========================================================================
   Approvals validator.

   Coverage (10 assertions):
     01  Approving from 'draft' is rejected (must submit first)
     02  Submitting expense moves draft → submitted (+ stamps submitted_at)
     03  Approving a submitted expense moves it → approved (+ stamps approved_at)
     04  Submitting again from approved is rejected
     05  Rejecting from submitted requires a reason (≥ 3 chars)
     06  Rejection persists reason + rejected_at
     07  Activity log captures each transition (submit + approve + reject)
     08  canApprove enforces role gate (CEO + accountant + super_admin only)
     09  listPending excludes approved + rejected entries
     10  Tenant isolation — A's pending queue never contains B's items
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  transitionApproval, listPending, listActivity, canApprove,
} from "../src/lib/approvals";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[approvals] env not set; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000B1";
const TENANT_B = "00000000-0000-4000-a000-0000000000B2";
const ACTOR    = "00000000-0000-4000-a000-0000000000B9";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensure() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `approvals-${id.slice(-4)}`,
      name: `Approvals Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
  /* Ensure ACTOR account exists so the activity log FK is satisfiable.
     finance_activity_log.actor_id → accounts(id). */
  const exist = await supabase.from("accounts").select("id").eq("id", ACTOR).maybeSingle();
  if (!exist.data) {
    const personIns = await supabase.from("people")
      .insert({ full_name: "approvals-actor" }).select("id").single();
    const personId = (personIns.data as { id: string }).id;
    await supabase.from("accounts").insert({
      id: ACTOR, tenant_id: TENANT_A,
      username: "approvals-actor",
      login_email: "approvals-actor@test.local",
      status: "active", user_type: "internal",
      person_id: personId,
    });
  }
}

async function cleanup() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("finance_activity_log").delete().eq("tenant_id", t);
    await supabase.from("finance_expenses").delete().eq("tenant_id", t);
  }
}

async function makeExpense(tenant: string, title: string): Promise<string> {
  const r = await supabase.from("finance_expenses").insert({
    tenant_id: tenant, title, amount: 100, currency: "CNY",
    expense_date: new Date().toISOString().slice(0, 10),
    approval_status: "draft",
  }).select("id").single();
  if (r.error) throw new Error(`expense insert: ${r.error.message}`);
  return (r.data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Approvals validator");
  console.log("─".repeat(72));
  await ensure();
  await cleanup();

  /* 01 — Approve from draft must fail. */
  const e1 = await makeExpense(TENANT_A, "approve-from-draft");
  const r1 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e1, action: "approve",
  });
  ok("01  Approve from draft is rejected", !r1.ok && r1.code === 409, r1.error ?? "");

  /* 02 — Submit moves draft → submitted. */
  const e2 = await makeExpense(TENANT_A, "submit-flow");
  const r2 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e2, action: "submit",
  });
  const row2 = await supabase.from("finance_expenses").select("approval_status, submitted_at").eq("id", e2).single();
  ok(
    "02  Submit moves draft → submitted (+ stamps submitted_at)",
    r2.ok
      && (row2.data as { approval_status: string; submitted_at: string }).approval_status === "submitted"
      && !!(row2.data as { submitted_at: string }).submitted_at,
    `status=${(row2.data as { approval_status: string }).approval_status}`,
  );

  /* 03 — Approve submitted → approved. */
  const r3 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e2, action: "approve",
  });
  const row3 = await supabase.from("finance_expenses").select("approval_status, approved_at").eq("id", e2).single();
  ok(
    "03  Approve submitted → approved (+ stamps approved_at)",
    r3.ok
      && (row3.data as { approval_status: string; approved_at: string }).approval_status === "approved"
      && !!(row3.data as { approved_at: string }).approved_at,
  );

  /* 04 — Submit again from approved must fail. */
  const r4 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e2, action: "submit",
  });
  ok("04  Submit from approved is rejected", !r4.ok && r4.code === 409, r4.error ?? "");

  /* 05 — Reject without reason must fail. */
  const e5 = await makeExpense(TENANT_A, "reject-no-reason");
  await transitionApproval({ tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e5, action: "submit" });
  const r5 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e5, action: "reject", reason: "  ",
  });
  ok("05  Reject without reason rejected (422)", !r5.ok && r5.code === 422, r5.error ?? "");

  /* 06 — Reject with reason persists. */
  const r6 = await transitionApproval({
    tenantId: TENANT_A, actorId: ACTOR, entity: "expense", entityId: e5,
    action: "reject", reason: "Missing receipt",
  });
  const row6 = await supabase.from("finance_expenses")
    .select("approval_status, rejection_reason, rejected_at").eq("id", e5).single();
  ok(
    "06  Reject persists reason + rejected_at",
    r6.ok
      && (row6.data as { approval_status: string }).approval_status === "rejected"
      && (row6.data as { rejection_reason: string }).rejection_reason === "Missing receipt"
      && !!(row6.data as { rejected_at: string }).rejected_at,
  );

  /* 07 — Activity log has submitted + approved + rejected rows. */
  const activity = await listActivity(TENANT_A, { limit: 50 });
  const actions = new Set(activity.map((a) => a.action));
  ok(
    "07  Activity log captures submit + approve + reject",
    actions.has("submitted") && actions.has("approved") && actions.has("rejected"),
    `actions=${Array.from(actions).join(",")}`,
  );

  /* 08 — canApprove gate. */
  ok(
    "08  canApprove gate (CEO + accountant + SA only)",
    canApprove("ceo", false) === true
      && canApprove("accountant", false) === true
      && canApprove("sales", false) === false
      && canApprove("warehouse", false) === false
      && canApprove("marketing", true) === true,   // super-admin bypass
  );

  /* 09 — listPending excludes terminal states. */
  const eOpen = await makeExpense(TENANT_A, "pending-open");
  const pending = await listPending(TENANT_A);
  const ids = new Set(pending.filter((p) => p.kind === "expense").map((p) => p.id));
  ok(
    "09  listPending excludes approved + rejected; includes drafts",
    ids.has(eOpen) && !ids.has(e2) && !ids.has(e5),
    `pending count=${pending.length}`,
  );

  /* 10 — Tenant isolation. */
  await makeExpense(TENANT_B, "b-only");
  const pendingA = await listPending(TENANT_A);
  const pendingB = await listPending(TENANT_B);
  const aHasBOnly = pendingA.some((p) => p.ref === "b-only");
  const bHasAItems = pendingB.some((p) => p.ref === "approve-from-draft" || p.ref === "pending-open");
  ok(
    "10  tenant isolation — A and B do not see each other's pending items",
    !aHasBOnly && !bHasAItems,
    `A.count=${pendingA.length} B.count=${pendingB.length}`,
  );

  await cleanup();

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
