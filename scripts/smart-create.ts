#!/usr/bin/env tsx

/* ===========================================================================
   SmartCreate validator.

   Coverage (8 assertions):
     01  resolveSmartDefaults seeds base_currency from tenants.default_currency
     02  resolveSmartDefaults falls back to CNY when tenant default is null
     03  resolveSmartDefaults exposes default_warehouse_id when one exists
     04  resolveSmartDefaults exposes default_expense_category_id when one exists
     05  /api/create/defaults endpoint imports resolveSmartDefaults (smoke)
     06  buildWorkflowSteps marks current step for SO status='confirmed'
     07  buildWorkflowSteps marks "done" for steps preceding the current one
     08  buildWorkflowSteps handles unknown status without crash
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { resolveSmartDefaults } from "../src/lib/create/defaults";
import { buildWorkflowSteps } from "../src/lib/workflow/document-workflow";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) { console.warn("[smart-create] env not set; skipping."); process.exit(0); }
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_FULL = "00000000-0000-4000-a000-0000000000D1";
const TENANT_NULL = "00000000-0000-4000-a000-0000000000D2";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensure() {
  await supabase.from("tenants").upsert([
    { id: TENANT_FULL, slug: "smart-full", name: "SmartCreate Full",
      is_host: false, active: true, default_currency: "USD" },
    { id: TENANT_NULL, slug: "smart-null", name: "SmartCreate Null",
      is_host: false, active: true, default_currency: null },
  ], { onConflict: "id" });
  await supabase.from("inventory_warehouses").upsert({
    tenant_id: TENANT_FULL, code: "MAIN", name: "Main Warehouse", warehouse_type: "physical",
  }, { onConflict: "tenant_id,code" });
  /* Categories don't have a (tenant,name) unique constraint, so
     delete + insert keeps reruns clean. */
  await supabase.from("finance_expense_categories")
    .delete().eq("tenant_id", TENANT_FULL).eq("name", "Office rent");
  await supabase.from("finance_expense_categories").insert({
    tenant_id: TENANT_FULL, name: "Office rent", is_system: false, sort_order: 1,
  });
}

async function main() {
  console.log("─".repeat(72));
  console.log("  SmartCreate validator");
  console.log("─".repeat(72));
  await ensure();

  /* 01 */
  const dFull = await resolveSmartDefaults(TENANT_FULL);
  ok("01  base_currency from tenants.default_currency", dFull.base_currency === "USD", `got=${dFull.base_currency}`);

  /* 02 */
  const dNull = await resolveSmartDefaults(TENANT_NULL);
  ok("02  base_currency falls back to CNY when null", dNull.base_currency === "CNY", `got=${dNull.base_currency}`);

  /* 03 */
  ok("03  default_warehouse_id present when a warehouse exists",
     dFull.default_warehouse_id !== null && (dFull.default_warehouse_label ?? "").includes("MAIN"),
     dFull.default_warehouse_label ?? "");

  /* 04 */
  ok("04  default_expense_category_id present when a category exists",
     dFull.default_expense_category_id !== null && dFull.default_expense_category_label === "Office rent");

  /* 05 — smoke check that the route module is importable. */
  let routeOk = false;
  try {
    const mod = await import("../src/app/api/create/defaults/route");
    routeOk = typeof mod.GET === "function";
  } catch { routeOk = false; }
  ok("05  /api/create/defaults exports GET", routeOk);

  /* 06 */
  const stepsConfirmed = buildWorkflowSteps({ kind: "so", status: "confirmed" });
  const currentSO = stepsConfirmed.find((s) => s.state === "current");
  ok("06  SO confirmed → current step is 'so'", currentSO?.key === "so", `got=${currentSO?.key}`);

  /* 07 */
  const stepsPaid = buildWorkflowSteps({ kind: "po", status: "paid" });
  const doneKeys = stepsPaid.filter((s) => s.state === "done").map((s) => s.key);
  ok("07  PO paid → preceding steps marked done",
     doneKeys.includes("supplier") && doneKeys.includes("po") && doneKeys.includes("receive") && doneKeys.includes("bill"),
     `done=${doneKeys.join(",")}`);

  /* 08 */
  let crashed = false;
  try { buildWorkflowSteps({ kind: "invoice", status: "wat" }); } catch { crashed = true; }
  ok("08  unknown status does not crash", !crashed);

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
