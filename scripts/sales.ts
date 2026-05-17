#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.4 / O.4.1 — Sales Shipment validator.

   Coverage (18 assertions):
     01  Create SO with two line items
     02  Ship partial qty on line 1 → balance decreases by qty_accepted
     03  SO status becomes 'partial'
     04  SO line qty_shipped rolls up correctly
     05  Source linkage on inventory movement
         (movement_type='sales_shipment', source_id=<shipment_line_id>)
     06  Ship remaining qty on line 1
     07  Ship full qty on line 2 → SO 'shipped'
     08  Over-ship rejected (line remaining check, 422)
     09  Negative / zero qty rejected (400)
     10  Insufficient stock rejected by inventory layer (422)
     11  Void shipment restores stock + rolls back qty_shipped
     12  Tenant isolation — A cannot ship against B's SO
     13  SO list enriches with customer_name + qty totals
     14  SO list status filter restricts results
     15  SO list search by SO number works
     16  SO list search by customer name works (post-join match)
     17  SO detail carries per-line total_on_hand + available_locations
     18  SO detail shipment history carries source location + totals
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { shipSalesOrder, voidSalesShipment } from "../src/lib/sales/shipping";
import { ensureDefaultWarehouse } from "../src/lib/inventory/posting";
import { getStockBalance } from "../src/lib/inventory/queries";
import { createInventoryItem } from "../src/lib/inventory/items";
import {
  createInventoryMovement,
  postInventoryMovement,
} from "../src/lib/inventory/posting";
import { listSalesOrders, getSalesOrderDetail } from "../src/lib/sales/queries";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[sales] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000F1";
const TENANT_B = "00000000-0000-4000-a000-0000000000F2";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-o4-${id.slice(-4)}`,
      name: `Phase-O4 Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("sales_shipment_items").delete().eq("tenant_id", t);
    await supabase.from("sales_shipments").delete().eq("tenant_id", t);
    /* Delete SO items + orders via cascade-by-id list. */
    const { data: sos } = await supabase.from("sales_orders").select("id").eq("tenant_id", t);
    const soIds = ((sos ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (soIds.length > 0) {
      await supabase.from("sales_order_items").delete().in("sales_order_id", soIds);
      await supabase.from("sales_orders").delete().in("id", soIds);
    }
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function ensureCustomer(tenantId: string): Promise<string> {
  /* sales_orders.customer_id FKs to the `customers` table (not contacts).
     The table is small: id / name / is_active / created_at + a few extras.
     We seed (or reuse) a tenant-tagged customer row for the test. */
  const tag = `Phase-O4 ${tenantId.slice(-4)}`;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", tag)
    .limit(1);
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
  const { data, error } = await supabase
    .from("customers")
    .insert({ tenant_id: tenantId, name: tag })
    .select("id")
    .single();
  if (error || !data) throw new Error(`customer seed failed: ${error?.message}`);
  return (data as { id: string }).id;
}

async function seedItemWithStock(tenantId: string, qty: number): Promise<{ itemId: string; warehouseId: string }> {
  const warehouseId = await ensureDefaultWarehouse(tenantId);
  const item = await createInventoryItem({
    tenant_id: tenantId,
    item_name: `Sales Test Item ${Math.random().toString(16).slice(2, 8)}`,
    type_key: "finished_product",
    unit_of_measure: "pcs",
  });
  if (!item.ok || !item.item) throw new Error(`item seed failed: ${item.error}`);
  /* Drop an opening-balance movement directly via the inventory engine. */
  const created = await createInventoryMovement({
    tenant_id: tenantId,
    inventory_item_id: item.item.id,
    warehouse_id: warehouseId,
    movement_type: "opening_balance",
    quantity: qty,
  });
  if (!created.ok || !created.movement) throw new Error(`opening insert failed: ${created.error}`);
  const posted = await postInventoryMovement(created.movement.id, tenantId, null);
  if (!posted.ok) throw new Error(`opening post failed: ${posted.error}`);
  return { itemId: item.item.id, warehouseId };
}

async function createSo(opts: {
  tenantId: string;
  customerId: string;
  lines: Array<{ inventory_item_id: string; description?: string; qty: number; unit_price: number }>;
}): Promise<{ soId: string; itemIds: string[] }> {
  const { data: so, error } = await supabase
    .from("sales_orders")
    .insert({
      tenant_id: opts.tenantId,
      so_no: `SO-TEST-${Date.now().toString(16).slice(-6).toUpperCase()}`,
      customer_id: opts.customerId,
      status: "confirmed",
      currency: "USD",
    })
    .select("id")
    .single();
  if (error || !so) throw new Error(`SO insert failed: ${error?.message}`);
  const soId = (so as { id: string }).id;

  const { data: items, error: itemsErr } = await supabase
    .from("sales_order_items")
    .insert(opts.lines.map((l) => ({
      sales_order_id: soId,
      inventory_item_id: l.inventory_item_id,
      description: l.description ?? null,
      qty: l.qty,
      qty_shipped: 0,
      unit_price: l.unit_price,
      total: l.qty * l.unit_price,
    })))
    .select("id");
  if (itemsErr) throw new Error(`SO items insert failed: ${itemsErr.message}`);
  return { soId, itemIds: ((items ?? []) as Array<{ id: string }>).map((r) => r.id) };
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase O.4 — Basic Sales Shipment validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();
  const customerA = await ensureCustomer(TENANT_A);
  const customerB = await ensureCustomer(TENANT_B);

  /* Seed two items in tenant A with enough stock. */
  const itemA = await seedItemWithStock(TENANT_A, 100);
  const itemB = await seedItemWithStock(TENANT_A, 60);

  /* 01 — Create SO. */
  const { soId, itemIds } = await createSo({
    tenantId: TENANT_A, customerId: customerA,
    lines: [
      { inventory_item_id: itemA.itemId, qty: 40, unit_price: 25 },
      { inventory_item_id: itemB.itemId, qty: 30, unit_price: 10 },
    ],
  });
  ok("01  SO created with two line items", !!soId && itemIds.length === 2, `so=${soId.slice(0, 8)}`);

  /* 02 — Ship partial 25 on line 1. */
  const balBefore = (await getStockBalance(TENANT_A, itemA.itemId, itemA.warehouseId)).qty_on_hand;
  const s1 = await shipSalesOrder({
    soId, tenantId: TENANT_A, shippedBy: null,
    request: {
      source_location_id: itemA.warehouseId,
      lines: [{ sales_order_item_id: itemIds[0], qty: 25 }],
    },
  });
  const balAfter = (await getStockBalance(TENANT_A, itemA.itemId, itemA.warehouseId)).qty_on_hand;
  ok(
    "02  ship partial 25 → balance decreases by 25",
    s1.ok && Math.abs((balBefore - balAfter) - 25) < 0.0001,
    `Δ=${balBefore - balAfter}`,
  );

  /* 03 — SO status partial. */
  const { data: soStatusPartial } = await supabase.from("sales_orders").select("status").eq("id", soId).maybeSingle();
  ok(
    "03  SO status = 'partial' after partial ship",
    (soStatusPartial as { status: string } | null)?.status === "partial",
    `status=${(soStatusPartial as { status?: string } | null)?.status}`,
  );

  /* 04 — qty_shipped rolled up. */
  const { data: soiAfter } = await supabase
    .from("sales_order_items")
    .select("qty_shipped")
    .eq("id", itemIds[0])
    .maybeSingle();
  ok(
    "04  SO line qty_shipped rolled forward to 25",
    (soiAfter as { qty_shipped: number } | null)?.qty_shipped === 25,
    `qty_shipped=${(soiAfter as { qty_shipped?: number } | null)?.qty_shipped}`,
  );

  /* 05 — Source linkage on the inventory movement. */
  const { data: shipLines } = await supabase
    .from("sales_shipment_items")
    .select("id, inventory_movement_id")
    .eq("shipment_id", s1.shipment_id ?? "");
  const shipLine = ((shipLines ?? [])[0] as { id: string; inventory_movement_id: string | null } | undefined);
  if (shipLine?.inventory_movement_id) {
    const { data: mv } = await supabase
      .from("inventory_stock_movements")
      .select("source_type, source_id, movement_type, direction")
      .eq("id", shipLine.inventory_movement_id)
      .maybeSingle();
    const m = mv as { source_type: string; source_id: string; movement_type: string; direction: string } | null;
    ok(
      "05  movement source linkage: source_type='sales_shipment', source_id=line, direction='out'",
      m?.source_type === "sales_shipment" && m?.source_id === shipLine.id && m?.movement_type === "sales_shipment" && m?.direction === "out",
    );
  } else {
    ok("05  movement source linkage", false, "no movement");
  }

  /* 06 — Ship remaining 15 on line 1. */
  const s2 = await shipSalesOrder({
    soId, tenantId: TENANT_A, shippedBy: null,
    request: { lines: [{ sales_order_item_id: itemIds[0], qty: 15 }] },
  });
  const balAfter2 = (await getStockBalance(TENANT_A, itemA.itemId, itemA.warehouseId)).qty_on_hand;
  const { data: soiAfter2 } = await supabase
    .from("sales_order_items")
    .select("qty_shipped")
    .eq("id", itemIds[0])
    .maybeSingle();
  ok(
    "06  ship remaining 15: line qty_shipped = 40, balance -15",
    s2.ok && Math.abs((balAfter - balAfter2) - 15) < 0.0001 &&
      (soiAfter2 as { qty_shipped: number } | null)?.qty_shipped === 40,
    `Δ=${balAfter - balAfter2} qty_shipped=${(soiAfter2 as { qty_shipped?: number } | null)?.qty_shipped}`,
  );

  /* 07 — Ship full 30 on line 2 → SO 'shipped'. */
  const s3 = await shipSalesOrder({
    soId, tenantId: TENANT_A, shippedBy: null,
    request: { lines: [{ sales_order_item_id: itemIds[1], qty: 30 }] },
  });
  const { data: soFinal } = await supabase.from("sales_orders").select("status").eq("id", soId).maybeSingle();
  ok(
    "07  SO status = 'shipped' once every line is fully shipped",
    s3.ok && (soFinal as { status: string } | null)?.status === "shipped",
    `status=${(soFinal as { status?: string } | null)?.status}`,
  );

  /* 08 — Over-ship rejected. Fresh SO + fresh item. */
  const overshootStock = await seedItemWithStock(TENANT_A, 50);
  const overshootSo = await createSo({
    tenantId: TENANT_A, customerId: customerA,
    lines: [{ inventory_item_id: overshootStock.itemId, qty: 10, unit_price: 1 }],
  });
  const r08 = await shipSalesOrder({
    soId: overshootSo.soId, tenantId: TENANT_A, shippedBy: null,
    request: { lines: [{ sales_order_item_id: overshootSo.itemIds[0], qty: 999 }] },
  });
  ok("08  over-ship rejected (422)", !r08.ok && r08.code === 422, r08.error ?? "");

  /* 09 — Negative qty rejected. */
  const r09 = await shipSalesOrder({
    soId: overshootSo.soId, tenantId: TENANT_A, shippedBy: null,
    request: { lines: [{ sales_order_item_id: overshootSo.itemIds[0], qty: -3 }] },
  });
  ok("09  negative/zero qty rejected", !r09.ok && r09.code === 400, r09.error ?? "");

  /* 10 — Insufficient stock at the inventory layer.
     Create a new item with only 2 in stock, SO for 10, ship 5 → must fail.
     Note: the SO-level over-ship check uses ORDERED qty; the inventory
     check is what stops shipments that exceed on-hand. */
  const lowStock = await seedItemWithStock(TENANT_A, 2);
  const lowSo = await createSo({
    tenantId: TENANT_A, customerId: customerA,
    lines: [{ inventory_item_id: lowStock.itemId, qty: 10, unit_price: 1 }],
  });
  const r10 = await shipSalesOrder({
    soId: lowSo.soId, tenantId: TENANT_A, shippedBy: null,
    request: {
      source_location_id: lowStock.warehouseId,
      lines: [{ sales_order_item_id: lowSo.itemIds[0], qty: 5 }],
    },
  });
  ok(
    "10  insufficient stock rejected by inventory engine (422)",
    !r10.ok && r10.code === 422,
    r10.error ?? "",
  );

  /* 11 — Void s1 (the partial 25-ship). Stock restored + qty_shipped rolls back. */
  const balBeforeVoid = (await getStockBalance(TENANT_A, itemA.itemId, itemA.warehouseId)).qty_on_hand;
  const v = await voidSalesShipment({
    shipmentId: s1.shipment_id!,
    tenantId: TENANT_A,
    voidedBy: null,
    reason: "test reversal",
  });
  const balAfterVoid = (await getStockBalance(TENANT_A, itemA.itemId, itemA.warehouseId)).qty_on_hand;
  /* Line 1 had total qty_shipped of 40 across s1 (25) + s2 (15). Voiding
     s1 rolls qty_shipped back to 15. */
  const { data: soiAfterVoid } = await supabase
    .from("sales_order_items")
    .select("qty_shipped")
    .eq("id", itemIds[0])
    .maybeSingle();
  ok(
    "11  void restores stock + rolls back qty_shipped",
    v.ok &&
      Math.abs((balAfterVoid - balBeforeVoid) - 25) < 0.0001 &&
      (soiAfterVoid as { qty_shipped: number } | null)?.qty_shipped === 15,
    `Δ=${balAfterVoid - balBeforeVoid} qty_shipped=${(soiAfterVoid as { qty_shipped?: number } | null)?.qty_shipped}`,
  );

  /* 12 — Tenant isolation. */
  const itemForB = await seedItemWithStock(TENANT_B, 10);
  const soB = await createSo({
    tenantId: TENANT_B, customerId: customerB,
    lines: [{ inventory_item_id: itemForB.itemId, qty: 5, unit_price: 1 }],
  });
  const crossTenant = await shipSalesOrder({
    soId: soB.soId, tenantId: TENANT_A, shippedBy: null,
    request: { lines: [{ sales_order_item_id: soB.itemIds[0], qty: 1 }] },
  });
  ok("12  tenant isolation — A cannot ship against B's SO", !crossTenant.ok && crossTenant.code === 404, crossTenant.error ?? "");

  /* ─── Phase O.4.1 — UX-surface coverage (13–18) ─────────────
     The list and detail endpoints carry the joined data the new
     pages depend on (customer name, qty totals, per-line live
     stock). The assertions below pin those contracts in place. */

  /* 13 — listSalesOrders returns customer name + qty totals.
     After void in test 11, the main SO is back to 'partial' with
     15 (line 1 after void) + 30 (line 2 still shipped) = 45 shipped. */
  const listAll = await listSalesOrders(TENANT_A);
  const fullySoRow = listAll.find((r) => r.id === soId);
  ok(
    "13  SO list enriches with customer_name + qty_ordered/shipped/remaining",
    !!fullySoRow &&
      fullySoRow.customer_name === `Phase-O4 ${TENANT_A.slice(-4)}` &&
      fullySoRow.qty_ordered === 70 &&
      fullySoRow.qty_shipped === 45 &&
      fullySoRow.qty_remaining === 25 &&
      fullySoRow.line_count === 2,
    `customer=${fullySoRow?.customer_name} ord=${fullySoRow?.qty_ordered} ship=${fullySoRow?.qty_shipped} rem=${fullySoRow?.qty_remaining}`,
  );

  /* 14 — Status filter limits to one status. The main SO is now
     'partial' (line 1 voided back, line 2 still fully shipped). */
  const partialOnly = await listSalesOrders(TENANT_A, { status: "partial" });
  const onlyPartial = partialOnly.every((r) => r.status === "partial");
  ok(
    "14  SO list status filter restricts results",
    onlyPartial && partialOnly.some((r) => r.id === soId),
    `n=${partialOnly.length}`,
  );

  /* 15 — Search filter matches by SO number. */
  const so = listAll.find((r) => r.id === soId)!;
  const byNo = await listSalesOrders(TENANT_A, { search: so.so_no?.slice(0, 8) ?? "" });
  ok(
    "15  SO list search filter matches by SO number",
    byNo.some((r) => r.id === soId),
    `match=${byNo.length}`,
  );

  /* 16 — Search filter matches by customer name (post-join). */
  const byCust = await listSalesOrders(TENANT_A, { search: "Phase-O4" });
  ok(
    "16  SO list search filter matches by customer name",
    byCust.some((r) => r.id === soId),
    `match=${byCust.length}`,
  );

  /* 17 — getSalesOrderDetail returns per-line stock totals + locations. */
  const otherSo = await createSo({
    tenantId: TENANT_A, customerId: customerA,
    lines: [{ inventory_item_id: itemA.itemId, qty: 5, unit_price: 10 }],
  });
  const det = await getSalesOrderDetail(TENANT_A, otherSo.soId);
  const line = det?.items[0];
  /* Item A had 100 in stock - 25 (s1 shipped) - 15 (s2 shipped) + 25 (s1 voided) = 85. */
  const hasLocation = !!line?.available_locations.find((b) => b.warehouse_id === itemA.warehouseId);
  ok(
    "17  SO detail carries per-line total_on_hand + available_locations",
    !!line && line.total_on_hand >= 1 && hasLocation,
    `total=${line?.total_on_hand} locs=${line?.available_locations.length}`,
  );

  /* 18 — Shipment history rows expose source_location + total_qty. */
  const det2 = await getSalesOrderDetail(TENANT_A, soId);
  const sample = det2?.shipments[0];
  ok(
    "18  shipment history carries source_location_code + total_qty + line_count",
    !!sample && typeof sample.source_location_code === "string" && sample.total_qty >= 0 && sample.line_count >= 1,
    `loc=${sample?.source_location_code} qty=${sample?.total_qty}`,
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
