#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.3 — Purchase Receiving Integration validator.

   Coverage (13 assertions):
     01  Create PO with two line items (server-side path)
     02  Receive FULL quantity on first line
            · inventory balance increases by qty_accepted
            · receipt is status='posted'
            · receipt line records inventory_movement_id
     03  PO line qty_received is rolled up
     04  Source linkage exists: inventory movement has
            source_type='purchase_receipt', source_id=<receipt_line_id>
     05  Receive PARTIAL on second line  → PO status = 'partial'
     06  Receive REMAINING on second line → PO status = 'received'
     07  Rejected quantity does NOT increase stock (only qty_accepted does)
     08  Duplicate receipt posting does NOT double stock
            (re-issuing the same payload creates a new receipt but the
             inventory layer rejects re-using the same source_id)
            We test the underlying invariant directly: posting a fresh
            inventory movement with the SAME source_id is rejected.
     09  Over-receipt rejected (qty_accepted > PO line remaining)
     10  Negative qty rejected
     11  Tenant isolation: receiving on tenant B's PO from tenant A fails
     12  Void receipt reverses stock + PO line qty_received rolls back
     13  Posted receipts cannot be voided twice (idempotent)
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { receivePurchaseOrder, voidPurchaseReceipt } from "../src/lib/purchase/receiving";
import { ensureDefaultWarehouse } from "../src/lib/inventory/posting";
import { getStockBalance } from "../src/lib/inventory/queries";
import { ensureInventoryItemForProduct } from "../src/lib/inventory/items";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[purchases] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000E1";
const TENANT_B = "00000000-0000-4000-a000-0000000000E2";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-o3-${id.slice(-4)}`,
      name: `Phase-O3 Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("purchase_receipt_items").delete().eq("tenant_id", t);
    /* Receipts on null tenant_id leftover from old data could exist;
       scope clean tightly to tenant. */
    const { data: receipts } = await supabase.from("purchase_receipts").select("id").eq("tenant_id", t);
    if (receipts && receipts.length > 0) {
      await supabase.from("purchase_receipts").delete().eq("tenant_id", t);
    }
    const { data: pos } = await supabase.from("purchase_orders").select("id").eq("tenant_id", t);
    if (pos && pos.length > 0) {
      await supabase.from("purchase_order_items").delete().in("po_id", pos.map((p) => (p as { id: string }).id));
      await supabase.from("purchase_orders").delete().eq("tenant_id", t);
    }
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function pickTwoProducts(): Promise<[string, string]> {
  const { data } = await supabase
    .from("products")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(2);
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length < 2) throw new Error("Need at least 2 products for test");
  return [rows[0].id, rows[1].id];
}

async function ensureSupplier(tenantId: string): Promise<string> {
  /* contacts has a `supplier_type` column that flags it as a supplier.
     For the test we just need a row that satisfies the FK; create one
     if no supplier exists for this tenant. */
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .not("supplier_type", "is", null)
    .limit(1);
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      entity_type: "company",
      display_name: `Test Supplier ${tenantId.slice(-4)}`,
      company_name: `Test Supplier ${tenantId.slice(-4)}`,
      supplier_type: "vendor",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not seed supplier: ${error?.message}`);
  return (data as { id: string }).id;
}

async function createPo(opts: {
  tenantId: string;
  supplierId: string;
  lines: Array<{ product_id: string; qty: number; unit_cost: number }>;
}): Promise<{ poId: string; itemIds: string[] }> {
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: opts.tenantId,
      po_no: `PO-TEST-${Date.now().toString(16).slice(-6).toUpperCase()}`,
      supplier_id: opts.supplierId,
      status: "confirmed",
      order_date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      subtotal: opts.lines.reduce((acc, l) => acc + l.qty * l.unit_cost, 0),
      total: opts.lines.reduce((acc, l) => acc + l.qty * l.unit_cost, 0),
    })
    .select("id")
    .single();
  if (error || !po) throw new Error(`PO insert failed: ${error?.message}`);
  const poId = (po as { id: string }).id;

  const { data: items } = await supabase
    .from("purchase_order_items")
    .insert(opts.lines.map((l, idx) => ({
      po_id: poId,
      product_id: l.product_id,
      qty: l.qty,
      qty_received: 0,
      qty_billed: 0,
      unit: "pc",
      unit_cost: l.unit_cost,
      line_total: l.qty * l.unit_cost,
      sort_order: idx,
    })))
    .select("id");
  return { poId, itemIds: ((items ?? []) as Array<{ id: string }>).map((r) => r.id) };
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase O.3 — Purchase Receiving Integration validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();
  const [pidA, pidB] = await pickTwoProducts();
  const supplierA = await ensureSupplier(TENANT_A);
  const supplierB = await ensureSupplier(TENANT_B);
  const whA = await ensureDefaultWarehouse(TENANT_A);
  await ensureDefaultWarehouse(TENANT_B);

  /* Phase O.2.1: the inventory ledger is keyed on inventory_item_id.
     Resolve the auto-created (or existing) inventory item for each
     product so balance assertions query the right key. */
  const itemA = await ensureInventoryItemForProduct(TENANT_A, pidA);

  /* 01 — Create PO. */
  const { poId, itemIds } = await createPo({
    tenantId: TENANT_A,
    supplierId: supplierA,
    lines: [
      { product_id: pidA, qty: 50, unit_cost: 12.5 },
      { product_id: pidB, qty: 80, unit_cost: 7.0 },
    ],
  });
  ok("01  PO created with two line items", !!poId && itemIds.length === 2, `po=${poId.slice(0, 8)}`);

  /* 02 — Receive FULL on line 1. */
  const r1 = await receivePurchaseOrder({
    poId,
    tenantId: TENANT_A,
    receivedBy: null,
    request: {
      warehouse_id: whA,
      lines: [{ po_item_id: itemIds[0], qty_received: 50, qty_accepted: 50 }],
    },
  });
  const balA = await getStockBalance(TENANT_A, itemA, whA);
  const { data: rcptRow } = await supabase
    .from("purchase_receipts")
    .select("status, posted_at")
    .eq("id", r1.receipt_id ?? "")
    .maybeSingle();
  const { data: rcptLines } = await supabase
    .from("purchase_receipt_items")
    .select("inventory_movement_id, qty_accepted, id")
    .eq("receipt_id", r1.receipt_id ?? "");
  const line1 = (rcptLines ?? [])[0] as { inventory_movement_id: string | null; qty_accepted: number; id: string } | undefined;
  ok(
    "02  receive full qty: balance increases + receipt posted",
    r1.ok &&
      balA.qty_on_hand === 50 &&
      (rcptRow as { status: string } | null)?.status === "posted" &&
      !!line1?.inventory_movement_id,
    `bal=${balA.qty_on_hand} status=${(rcptRow as { status?: string } | null)?.status}`,
  );

  /* 03 — PO line qty_received rolled up. */
  const { data: poiRow } = await supabase
    .from("purchase_order_items")
    .select("qty_received")
    .eq("id", itemIds[0])
    .maybeSingle();
  ok(
    "03  PO line qty_received rolled forward",
    (poiRow as { qty_received: number } | null)?.qty_received === 50,
    `qty_received=${(poiRow as { qty_received?: number } | null)?.qty_received}`,
  );

  /* 04 — Source linkage. */
  if (line1?.inventory_movement_id) {
    const { data: mv } = await supabase
      .from("inventory_stock_movements")
      .select("source_type, source_id, movement_type, direction")
      .eq("id", line1.inventory_movement_id)
      .maybeSingle();
    const mvRow = mv as {
      source_type: string | null;
      source_id: string | null;
      movement_type: string;
      direction: string;
    } | null;
    ok(
      "04  movement source linkage points back to receipt line",
      mvRow?.source_type === "purchase_receipt" &&
        mvRow?.source_id === line1.id &&
        mvRow?.movement_type === "purchase_receipt" &&
        mvRow?.direction === "in",
    );
  } else {
    ok("04  movement source linkage points back to receipt line", false, "no movement created");
  }

  /* 05 — Partial on line 2 → PO status 'partial'. */
  const r2 = await receivePurchaseOrder({
    poId,
    tenantId: TENANT_A,
    receivedBy: null,
    request: { lines: [{ po_item_id: itemIds[1], qty_received: 30, qty_accepted: 30 }] },
  });
  const { data: poAfterPartial } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .maybeSingle();
  ok(
    "05  partial receipt: PO status = 'partial'",
    r2.ok && (poAfterPartial as { status: string } | null)?.status === "partial",
    `po.status=${(poAfterPartial as { status?: string } | null)?.status}`,
  );

  /* 06 — Receive remaining 50 of line 2 → PO 'received'. */
  const r3 = await receivePurchaseOrder({
    poId,
    tenantId: TENANT_A,
    receivedBy: null,
    request: { lines: [{ po_item_id: itemIds[1], qty_received: 50, qty_accepted: 50 }] },
  });
  const { data: poFinal } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .maybeSingle();
  ok(
    "06  remaining receipt: PO status = 'received'",
    r3.ok && (poFinal as { status: string } | null)?.status === "received",
    `po.status=${(poFinal as { status?: string } | null)?.status}`,
  );

  /* 07 — Rejected qty does not increase stock. Build a fresh PO. */
  const fresh = await createPo({
    tenantId: TENANT_A, supplierId: supplierA,
    lines: [{ product_id: pidA, qty: 20, unit_cost: 5 }],
  });
  const balBefore = (await getStockBalance(TENANT_A, itemA, whA)).qty_on_hand;
  await receivePurchaseOrder({
    poId: fresh.poId, tenantId: TENANT_A, receivedBy: null,
    request: { lines: [{ po_item_id: fresh.itemIds[0], qty_received: 10, qty_accepted: 3, qty_rejected: 7 }] },
  });
  const balAfter = (await getStockBalance(TENANT_A, itemA, whA)).qty_on_hand;
  ok(
    "07  rejected qty does not increase stock (only accepted moves)",
    Math.abs((balAfter - balBefore) - 3) < 0.0001,
    `Δ=${balAfter - balBefore} expected=3`,
  );

  /* 08 — Source idempotency: re-using the same source_id is rejected. */
  /* Posting the same inventory source twice for an active row is
     prevented at the index level (uq_inv_mv_source). We exercise it
     directly through the inventory create path so this is a deterministic
     test of the invariant the receipt engine relies on. */
  const sharedSourceId = randomUUID();
  const m1 = await supabase.from("inventory_stock_movements").insert({
    tenant_id: TENANT_A, movement_no: `IM-DUP-${Date.now()}`,
    movement_date: new Date().toISOString().slice(0, 10),
    inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "purchase_receipt", direction: "in",
    quantity: 1, unit: "pc", currency: "USD",
    source_type: "purchase_receipt", source_id: sharedSourceId,
    status: "draft",
  }).select("id").maybeSingle();
  const m2 = await supabase.from("inventory_stock_movements").insert({
    tenant_id: TENANT_A, movement_no: `IM-DUP2-${Date.now()}`,
    movement_date: new Date().toISOString().slice(0, 10),
    inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "purchase_receipt", direction: "in",
    quantity: 1, unit: "pc", currency: "USD",
    source_type: "purchase_receipt", source_id: sharedSourceId,
    status: "draft",
  }).select("id").maybeSingle();
  ok(
    "08  duplicate source_id rejected by partial unique index",
    !m1.error && !!m2.error && m2.error.code === "23505",
    m2.error?.code ?? "",
  );
  /* Clean up the draft m1 so it doesn't affect later balance assertions. */
  if (m1.data) await supabase.from("inventory_stock_movements").delete().eq("id", (m1.data as { id: string }).id);

  /* 09 — Over-receipt rejected. */
  const overshoot = await receivePurchaseOrder({
    poId: fresh.poId, tenantId: TENANT_A, receivedBy: null,
    request: { lines: [{ po_item_id: fresh.itemIds[0], qty_received: 500, qty_accepted: 500 }] },
  });
  ok(
    "09  over-receipt rejected (cumulative > ordered)",
    !overshoot.ok && overshoot.code === 422,
    overshoot.error ?? "",
  );

  /* 10 — Negative qty rejected. */
  const negative = await receivePurchaseOrder({
    poId: fresh.poId, tenantId: TENANT_A, receivedBy: null,
    request: { lines: [{ po_item_id: fresh.itemIds[0], qty_received: 5, qty_accepted: -1, qty_rejected: 0 }] },
  });
  ok(
    "10  negative qty_accepted rejected",
    !negative.ok && negative.code === 400,
    negative.error ?? "",
  );

  /* 11 — Tenant isolation. Create PO under B, attempt to receive from A. */
  const poB = await createPo({
    tenantId: TENANT_B, supplierId: supplierB,
    lines: [{ product_id: pidA, qty: 10, unit_cost: 1 }],
  });
  const crossTenant = await receivePurchaseOrder({
    poId: poB.poId, tenantId: TENANT_A, receivedBy: null,
    request: { lines: [{ po_item_id: poB.itemIds[0], qty_received: 5, qty_accepted: 5 }] },
  });
  ok(
    "11  tenant isolation — A cannot receive against B's PO",
    !crossTenant.ok && crossTenant.code === 404,
    crossTenant.error ?? "",
  );

  /* 12 — Void receipt reverses stock + rolls back PO line qty_received. */
  const balBeforeVoid = (await getStockBalance(TENANT_A, itemA, whA)).qty_on_hand;
  const voidR = await voidPurchaseReceipt({
    receiptId: r1.receipt_id!,
    tenantId: TENANT_A,
    voidedBy: null,
    reason: "test reversal",
  });
  const balAfterVoid = (await getStockBalance(TENANT_A, itemA, whA)).qty_on_hand;
  const { data: poiAfterVoid } = await supabase
    .from("purchase_order_items")
    .select("qty_received")
    .eq("id", itemIds[0])
    .maybeSingle();
  ok(
    "12  void receipt reverses stock + PO line qty_received rolls back",
    voidR.ok &&
      Math.abs((balBeforeVoid - balAfterVoid) - 50) < 0.0001 &&
      (poiAfterVoid as { qty_received: number } | null)?.qty_received === 0,
    `Δ=${balBeforeVoid - balAfterVoid} poi.qty_received=${(poiAfterVoid as { qty_received?: number } | null)?.qty_received}`,
  );

  /* 13 — Double void idempotent. */
  const voidAgain = await voidPurchaseReceipt({
    receiptId: r1.receipt_id!,
    tenantId: TENANT_A,
    voidedBy: null,
    reason: "second void",
  });
  ok("13  re-voiding a voided receipt is a no-op", voidAgain.ok);

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
