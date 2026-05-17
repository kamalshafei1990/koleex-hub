#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.5 — Inventory Valuation validator.

   Weighted-average cost (WAC). Every IN with a unit_cost re-mixes the
   average; OUT consumes at the current average; value = qty × avg.

   Coverage (13 assertions):
     01  First IN seeds qty + avg + value
     02  Second IN at a different cost recomputes the weighted average
     03  An IN without a unit_cost adds qty but doesn't change the avg
     04  OUT reduces qty + value, avg stays the same
     05  OUT stamps unit_cost = current avg (so future void can restore)
     06  OUT stamps total_cost = qty × avg (future COGS line item)
     07  Void of an OUT restores qty + value back to pre-OUT state
     08  Negative stock still rejected (422) — engine unchanged
     09  qty=0 → value=0 (empty bucket)
     10  Tenant isolation — A's valuation never references B's items
     11  rebuildValuationForItem matches the live stored row
     12  /api/inventory/valuation totals match tenant-wide sum
     13  Posted movement carries total_cost; cannot be mutated post-post
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import { createInventoryItem } from "../src/lib/inventory/items";
import {
  buildValuationSnapshot,
  getItemValuationSummary,
  getTenantValuationTotals,
  rebuildValuationForItem,
} from "../src/lib/inventory/valuation";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[valuation] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-00000000G001".replace(/G/g, "f");
const TENANT_B = "00000000-0000-4000-a000-00000000G002".replace(/G/g, "f");

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

function near(a: number, b: number, tol = 0.0001) { return Math.abs(a - b) < tol; }

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-o5-${id.slice(-4)}`,
      name: `Phase-O5 Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function liveBucket(tenantId: string, itemId: string, whId: string) {
  const { data } = await supabase
    .from("inventory_valuation")
    .select("qty_on_hand, average_cost, inventory_value, last_in_cost")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", itemId)
    .eq("warehouse_id", whId)
    .maybeSingle();
  const r = data as { qty_on_hand: number; average_cost: number; inventory_value: number; last_in_cost: number | null } | null;
  return {
    qty: Number(r?.qty_on_hand ?? 0),
    avg: Number(r?.average_cost ?? 0),
    value: Number(r?.inventory_value ?? 0),
    lastInCost: r?.last_in_cost != null ? Number(r.last_in_cost) : null,
  };
}

async function postIn(opts: {
  tenantId: string; itemId: string; whId: string;
  qty: number; unitCost?: number | null;
}): Promise<string> {
  const c = await createInventoryMovement({
    tenant_id: opts.tenantId,
    inventory_item_id: opts.itemId,
    warehouse_id: opts.whId,
    movement_type: "purchase_receipt",
    quantity: opts.qty,
    unit_cost: opts.unitCost ?? null,
    currency: "USD",
  });
  if (!c.ok || !c.movement) throw new Error(`IN create: ${c.error}`);
  const p = await postInventoryMovement(c.movement.id, opts.tenantId, null);
  if (!p.ok) throw new Error(`IN post: ${p.error}`);
  return c.movement.id;
}

async function postOut(opts: {
  tenantId: string; itemId: string; whId: string; qty: number;
}): Promise<{ id: string; ok: boolean; error?: string; code?: number }> {
  const c = await createInventoryMovement({
    tenant_id: opts.tenantId,
    inventory_item_id: opts.itemId,
    warehouse_id: opts.whId,
    movement_type: "sales_shipment",
    quantity: opts.qty,
  });
  if (!c.ok || !c.movement) return { id: "", ok: false, error: c.error };
  const p = await postInventoryMovement(c.movement.id, opts.tenantId, null);
  return { id: c.movement.id, ok: !!p.ok, error: p.error, code: p.code };
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase O.5 — Inventory Valuation validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whA = await ensureDefaultWarehouse(TENANT_A);
  const whB = await ensureDefaultWarehouse(TENANT_B);
  const itemA = await createInventoryItem({ tenant_id: TENANT_A, item_name: "WAC Item A", type_key: "spare_part" });
  if (!itemA.ok || !itemA.item) throw new Error("seed itemA failed");
  const itemId = itemA.item.id;

  /* 01 — First IN seeds qty + avg + value. */
  await postIn({ tenantId: TENANT_A, itemId, whId: whA, qty: 10, unitCost: 5 });
  const b1 = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "01  first IN seeds: qty=10, avg=5, value=50",
    near(b1.qty, 10) && near(b1.avg, 5) && near(b1.value, 50),
    `qty=${b1.qty} avg=${b1.avg} value=${b1.value}`,
  );

  /* 02 — Second IN at higher cost recomputes WAC.
     (10*5 + 5*8) / 15 = (50 + 40) / 15 = 6 */
  await postIn({ tenantId: TENANT_A, itemId, whId: whA, qty: 5, unitCost: 8 });
  const b2 = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "02  WAC formula: (10×5 + 5×8) / 15 = 6",
    near(b2.qty, 15) && near(b2.avg, 6) && near(b2.value, 90),
    `qty=${b2.qty} avg=${b2.avg.toFixed(4)} value=${b2.value}`,
  );

  /* 03 — IN without unit_cost adds qty, avg unchanged. */
  await postIn({ tenantId: TENANT_A, itemId, whId: whA, qty: 2, unitCost: null });
  const b3 = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "03  IN with no unit_cost: qty+2, avg unchanged",
    near(b3.qty, 17) && near(b3.avg, 6) && near(b3.value, 17 * 6),
    `qty=${b3.qty} avg=${b3.avg.toFixed(4)} value=${b3.value}`,
  );

  /* 04 — OUT 7 → qty=10, avg stays 6, value=60. */
  const out1 = await postOut({ tenantId: TENANT_A, itemId, whId: whA, qty: 7 });
  const b4 = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "04  OUT reduces qty + value at current avg, avg stays",
    out1.ok && near(b4.qty, 10) && near(b4.avg, 6) && near(b4.value, 60),
    `qty=${b4.qty} avg=${b4.avg.toFixed(4)} value=${b4.value}`,
  );

  /* 05 — OUT movement.unit_cost stamped with current avg (6). */
  const { data: outRow } = await supabase
    .from("inventory_stock_movements")
    .select("unit_cost, total_cost")
    .eq("id", out1.id)
    .maybeSingle();
  const outR = outRow as { unit_cost: number; total_cost: number } | null;
  ok(
    "05  OUT stamps unit_cost = consumed avg (6)",
    near(Number(outR?.unit_cost ?? 0), 6),
    `unit_cost=${outR?.unit_cost}`,
  );

  /* 06 — OUT total_cost = qty × avg = 7 × 6 = 42. */
  ok(
    "06  OUT stamps total_cost = qty × avg (42)",
    near(Number(outR?.total_cost ?? 0), 42),
    `total_cost=${outR?.total_cost}`,
  );

  /* 07 — Void the OUT → qty + value restored. */
  const v = await voidInventoryMovement(out1.id, TENANT_A, null, "test reversal");
  const b5 = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "07  void OUT restores qty + value (back to 17 / 102)",
    v.ok && near(b5.qty, 17) && near(b5.avg, 6) && near(b5.value, 102),
    `qty=${b5.qty} avg=${b5.avg.toFixed(4)} value=${b5.value}`,
  );

  /* 08 — Insufficient stock still rejected. */
  const big = await postOut({ tenantId: TENANT_A, itemId, whId: whA, qty: 9999 });
  ok(
    "08  negative stock still rejected (422)",
    !big.ok && big.code === 422,
    big.error ?? "",
  );

  /* 09 — Empty bucket reads as zero / zero / zero.
     New item never moved → either no row or qty=0. */
  const lonely = await createInventoryItem({ tenant_id: TENANT_A, item_name: "Lonely", type_key: "spare_part" });
  const b6 = await liveBucket(TENANT_A, lonely.item!.id, whA);
  ok(
    "09  zero qty → zero value",
    near(b6.qty, 0) && near(b6.avg, 0) && near(b6.value, 0),
    `qty=${b6.qty} value=${b6.value}`,
  );

  /* 10 — Tenant isolation. Seed B with its own item + value. */
  const itemB = await createInventoryItem({ tenant_id: TENANT_B, item_name: "B-item", type_key: "spare_part" });
  if (!itemB.ok || !itemB.item) throw new Error("seed itemB failed");
  await postIn({ tenantId: TENANT_B, itemId: itemB.item.id, whId: whB, qty: 3, unitCost: 99 });
  const aRows = await buildValuationSnapshot({ tenantId: TENANT_A });
  const bLeaked = aRows.some((r) => r.tenant_id.toLowerCase() !== TENANT_A.toLowerCase());
  ok("10  tenant isolation — A snapshot never references B's tenant", !bLeaked);

  /* 11 — Rebuild from history matches stored row. */
  const rebuilt = await rebuildValuationForItem(TENANT_A, itemId, whA);
  const stored = await liveBucket(TENANT_A, itemId, whA);
  ok(
    "11  rebuildValuationForItem matches the stored row",
    near(rebuilt.qty, stored.qty) && near(rebuilt.avg, stored.avg, 0.001) && near(rebuilt.value, stored.value, 0.01),
    `rebuilt=${rebuilt.qty}/${rebuilt.avg.toFixed(4)}/${rebuilt.value.toFixed(2)} stored=${stored.qty}/${stored.avg.toFixed(4)}/${stored.value.toFixed(2)}`,
  );

  /* 12 — Tenant totals sum to the snapshot. */
  const totals = await getTenantValuationTotals(TENANT_A);
  const sumFromRows = aRows.reduce((acc, r) => acc + (r.qty_on_hand > 0 ? r.inventory_value : 0), 0);
  ok(
    "12  /valuation totals match per-row sum",
    near(totals.total_value, sumFromRows, 0.01),
    `totals=${totals.total_value.toFixed(2)} rows=${sumFromRows.toFixed(2)}`,
  );

  /* 13 — Posted movement immutability: server can't UPDATE total_cost.
     out1 was voided in test 7 so the trigger no longer guards it.
     Pick a still-posted movement instead. */
  const { data: anyPosted } = await supabase
    .from("inventory_stock_movements")
    .select("id, status")
    .eq("tenant_id", TENANT_A)
    .eq("inventory_item_id", itemId)
    .eq("status", "posted")
    .limit(1)
    .maybeSingle();
  const stillPostedId = (anyPosted as { id: string } | null)?.id;
  const { error: mutErr } = await supabase
    .from("inventory_stock_movements")
    .update({ total_cost: 99999 })
    .eq("id", stillPostedId ?? "");
  ok(
    "13  posted movement total_cost is immutable",
    !!stillPostedId && !!mutErr,
    mutErr?.message?.slice(0, 60) ?? "no posted movement to test",
  );

  /* Per-item summary smoke test. */
  const sum = await getItemValuationSummary(TENANT_A, itemId);
  ok(
    "14  getItemValuationSummary returns weighted_avg + locations",
    near(sum.total_qty, stored.qty) && near(sum.weighted_avg_cost, stored.avg, 0.001) && sum.locations.length >= 1,
    `qty=${sum.total_qty} avg=${sum.weighted_avg_cost.toFixed(4)} locs=${sum.locations.length}`,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
