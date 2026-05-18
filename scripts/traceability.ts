#!/usr/bin/env tsx

/* ===========================================================================
   Traceability + Operations validator.

   Coverage (12 assertions):
     01  getTraceability('so') on a synthetic SO returns the SO event
     02  Timeline events sorted chronologically
     03  Outstanding includes "No shipment yet." for a blank SO
     04  Outstanding flags open AR balance after issuing an invoice
     05  Tenant isolation — A cannot see B's SO traceability
     06  Unknown kind returns NotImplementedError (throws)
     07  buildOpsSnapshot returns 0 alerts for a brand-new tenant
     08  Health flags 'info' across the board when there's no data
     09  Low-stock alert fires when reorder_point ≥ qty_on_hand
     10  AR-overdue alert fires when an invoice's due_date is in the past
     11  buildOpsSnapshot exposes today counters (shipments/receipts/…)
     12  Bottleneck detection picks up draft invoices
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { getTraceability } from "../src/lib/traceability";
import { buildOpsSnapshot } from "../src/lib/operations/alerts";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) { console.warn("[traceability] env not set; skipping."); process.exit(0); }
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000F1";
const TENANT_B = "00000000-0000-4000-a000-0000000000F2";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  await supabase.from("tenants").upsert([
    { id: TENANT_A, slug: "trace-a", name: "Trace A", is_host: false, active: true, default_currency: "CNY" },
    { id: TENANT_B, slug: "trace-b", name: "Trace B", is_host: false, active: true, default_currency: "CNY" },
  ], { onConflict: "id" });
}

async function cleanup() {
  /* Shipments + invoices first because they FK into sales_orders.
     Without this the cascade chokes and the next run fails on
     "duplicate key sales_orders_so_no_key". */
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("sales_shipments").delete().eq("tenant_id", t);
    await supabase.from("invoices").delete().eq("tenant_id", t);
    await supabase.from("sales_orders").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
  }
}

async function makeSalesOrder(tenant: string, so_no: string): Promise<string> {
  const r = await supabase.from("sales_orders").insert({
    tenant_id: tenant, so_no, status: "confirmed", currency: "CNY",
  }).select("id").single();
  if (r.error) throw new Error(r.error.message);
  return (r.data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Traceability + Operations validator");
  console.log("─".repeat(72));
  await ensureTenants();
  await cleanup();

  const soId = await makeSalesOrder(TENANT_A, "SO-T1");
  const trace = await getTraceability(TENANT_A, "so", soId);

  /* 01 */
  ok("01  getTraceability returns the SO event",
     trace.timeline.some((e) => e.kind === "so" && e.ref === "SO-T1"));

  /* 02 */
  const dates = trace.timeline.map((e) => e.occurred_at);
  ok("02  timeline events sorted chronologically",
     dates.every((d, i) => i === 0 || dates[i - 1] <= d));

  /* 03 */
  ok("03  outstanding includes 'No shipment yet.'",
     trace.outstanding.includes("No shipment yet."), trace.outstanding.join(" | "));

  /* 04 — issue an invoice with open balance. */
  const invIns = await supabase.from("invoices").insert({
    tenant_id: TENANT_A, sales_order_id: soId, status: "issued",
    issue_date: new Date().toISOString().slice(0, 10),
    total: 100, amount_paid: 0, balance: 100, currency: "CNY",
  }).select("id").single();
  if (invIns.error) throw new Error(invIns.error.message);
  const trace2 = await getTraceability(TENANT_A, "so", soId);
  ok("04  outstanding flags open AR balance after invoice",
     trace2.outstanding.includes("Open AR balance."),
     trace2.outstanding.join(" | "));

  /* 05 — tenant isolation. */
  let isolated = false;
  try {
    await getTraceability(TENANT_B, "so", soId);
  } catch { isolated = true; }
  ok("05  tenant isolation — B cannot see A's SO", isolated);

  /* 06 — unknown kind throws. */
  let unknownThrew = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getTraceability(TENANT_A, "quotation" as any, soId);
  } catch { unknownThrew = true; }
  ok("06  unknown kind throws", unknownThrew);

  /* 07 — Ops snapshot on a clean tenant. */
  const snapB = await buildOpsSnapshot(TENANT_B);
  ok("07  brand-new tenant has 0 alerts", snapB.alerts.length === 0, `got ${snapB.alerts.length}`);

  /* 08 — Health all info when no data. */
  ok("08  health flags 'info' across the board on empty tenant",
     snapB.health.inventory === "info" && snapB.health.ar === "info" &&
     snapB.health.ap === "info" && snapB.health.workflow === "info");

  /* 09 — Low-stock alert. */
  const itemIns = await supabase.from("inventory_items").insert({
    tenant_id: TENANT_A, item_code: "LOW-001", item_name: "Low-stock test",
    reorder_point: 10, status: "active",
    /* item_type_id is required — pick the first system type. */
    item_type_id: ((await supabase.from("inventory_item_types").select("id").is("tenant_id", null).limit(1).single()).data as { id: string }).id,
  }).select("id").single();
  if (itemIns.error) throw new Error(itemIns.error.message);
  const snapA = await buildOpsSnapshot(TENANT_A);
  ok("09  low-stock alert fires when qty (0) ≤ reorder_point (10)",
     snapA.alerts.some((a) => a.category === "stock_low"));

  /* 10 — AR overdue. */
  await supabase.from("invoices").update({
    due_date: "2020-01-01",
  }).eq("id", (invIns.data as { id: string }).id);
  const snap10 = await buildOpsSnapshot(TENANT_A);
  ok("10  AR overdue alert fires when due_date < today",
     snap10.alerts.some((a) => a.category === "ar_overdue"));

  /* 11 — Today counters present. */
  ok("11  today counters present in snapshot",
     typeof snap10.today.shipments_today === "number"
       && typeof snap10.today.invoices_pending === "number");

  /* 12 — Bottleneck detection picks up draft invoices. */
  await supabase.from("invoices").insert({
    tenant_id: TENANT_A, sales_order_id: soId, status: "draft",
    issue_date: new Date().toISOString().slice(0, 10),
    total: 50, amount_paid: 0, balance: 50, currency: "CNY",
  });
  const snap12 = await buildOpsSnapshot(TENANT_A);
  ok("12  bottleneck detection picks up draft invoices",
     snap12.bottlenecks.some((b) => b.key === "draft_invoices" && b.count > 0));

  await cleanup();

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
