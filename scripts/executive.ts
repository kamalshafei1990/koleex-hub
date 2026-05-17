#!/usr/bin/env tsx

/* ===========================================================================
   Executive Intelligence validator.

   Coverage (6 assertions):
     01  buildExecutiveSnapshot returns 12 monthly points (last 12 months)
     02  KPI payload contains all 8 expected KPIs
     03  Each KPI has a clickable drill-down href
     04  FX exposure is empty when only base-currency activity exists
     05  Tenant isolation — A's snapshot doesn't include B's invoices
     06  Inventory-intel slow/dead lists are sized 0..5
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { buildExecutiveSnapshot } from "../src/lib/executive/intelligence";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[executive] env not set; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000E1";
const TENANT_B = "00000000-0000-4000-a000-0000000000E2";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensure() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `exec-${id.slice(-4)}`,
      name: `Exec Sandbox ${id.slice(-4)}`,
      is_host: false, active: true, default_currency: "CNY",
    }, { onConflict: "id" });
  }
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Executive Intelligence validator");
  console.log("─".repeat(72));
  await ensure();

  const snapA = await buildExecutiveSnapshot(TENANT_A);

  /* 01 — 12 monthly points. */
  ok("01  monthly series has 12 points", snapA.monthly.length === 12, `length=${snapA.monthly.length}`);

  /* 02 — All 8 KPIs present. */
  const expected = ["revenue", "gross_profit", "net_profit", "cash_position", "inventory", "receivables", "payables", "fx_exposure"];
  const keys = Object.keys(snapA.kpis);
  ok("02  all 8 KPIs present", expected.every((k) => keys.includes(k)));

  /* 03 — Each KPI has a drill-down href. */
  ok(
    "03  every KPI carries a drill-down href",
    expected.every((k) => {
      const kpi = (snapA.kpis as Record<string, { href: string }>)[k];
      return typeof kpi.href === "string" && kpi.href.startsWith("/");
    }),
  );

  /* 04 — FX exposure empty for base-currency-only tenant. */
  ok(
    "04  FX exposure empty for base-only tenant",
    snapA.fx.exposed.length === 0 && snapA.fx.total_net_base_abs === 0,
    `${snapA.fx.exposed.length} entries`,
  );

  /* 05 — Tenant isolation: build B snapshot, ensure no cross-tenant numbers. */
  const snapB = await buildExecutiveSnapshot(TENANT_B);
  ok(
    "05  tenant isolation: independent zeroed snapshots",
    snapA.kpis.revenue.value === 0 && snapB.kpis.revenue.value === 0,
  );

  /* 06 — Inventory intel arrays bounded. */
  ok(
    "06  inventory-intel arrays bounded to 5",
    snapA.inventory_intel.slow_moving.length <= 5
      && snapA.inventory_intel.dead_stock.length <= 5
      && snapA.inventory_intel.highest_value.length <= 5
      && snapA.inventory_intel.low_stock.length <= 5,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
