#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H3A — Warehouse Transfer Workflow validator (15 assertions).

     01  Draft create
     02  Submit (draft → pending)
     03  Approve (pending → approved)
     04  Ship creates transfer_out movements (one per item)
     05  Stock deducted from source after ship
     06  Cannot over-ship (qty > source stock rejected; stays approved)
     07  Receive creates transfer_in movements
     08  Stock appears in destination after receive
     09  Bridge row links transfer_item → both movement ids
     10  Atomic rollback: zero-stock line aborts whole ship (no partial inserts)
     11  Void after ship preserves audit + reverses stock correctly
     12  Tenant isolation
     13  Movement → transfer link resolves
     14  Humanized errors (no raw Postgres / 22P codes)
     15  Existing inventory validators still pass (chain: inventory.ts +
         validate-inventory-unification.ts + validate-inventory-discipline.ts)
   ========================================================================== */

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  createInventoryMovement,
  postInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import {
  ensureInventoryItemForProduct,
  updateInventoryItem,
} from "../src/lib/inventory/items";
import {
  createTransfer,
  transitionTransfer,
  shipTransfer,
  receiveTransfer,
  voidTransfer,
  getTransferDetail,
  listTransfers,
  resolveTransferLinkForMovement,
} from "../src/lib/inventory/transfers";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h3a] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_A = "00000000-0000-4000-a000-00000000F3A1";
const TENANT_B = "00000000-0000-4000-a000-00000000F3B1";

let passes = 0;
let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passes += 1;
    console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase
      .from("tenants")
      .upsert(
        {
          id,
          slug: `inv-h3a-${id.slice(-4)}`,
          name: `INV-H3A Sandbox ${id.slice(-4)}`,
          is_host: false,
          active: true,
        },
        { onConflict: "id" },
      );
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_transfer_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_transfer_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_transfers").delete().eq("tenant_id", t);
    await supabase.from("inventory_audit_log").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
  await supabase.from("products").delete().like("slug", "inv-h3a-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h3a-sandbox-${slugSuffix}`;
  const { data, error } = await supabase
    .from("products")
    .insert({
      product_name: name,
      slug,
      division_slug: "sandbox",
      category_slug: "sandbox",
      subcategory_slug: "sandbox",
      brand: "Sandbox",
      status: "draft",
      visible: false,
      highlights: [],
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "product insert failed");
  return (data as { id: string }).id;
}

async function ensureSecondWarehouse(tenantId: string, defaultWh: string): Promise<string> {
  const { data: existing } = await supabase
    .from("inventory_warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("id", defaultWh)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data, error } = await supabase
    .from("inventory_warehouses")
    .insert({
      tenant_id: tenantId,
      code: `WH-DEST-${tenantId.slice(-4)}`,
      name: "Sandbox Destination",
      location_type: "warehouse",
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "wh insert failed");
  return (data as { id: string }).id;
}

async function openingStock(
  tenantId: string,
  itemId: string,
  warehouseId: string,
  qty: number,
  unitCost = 10,
): Promise<void> {
  const r = await createInventoryMovement({
    tenant_id: tenantId,
    inventory_item_id: itemId,
    warehouse_id: warehouseId,
    movement_type: "opening_balance",
    quantity: qty,
    unit_cost: unitCost,
  });
  if (!r.ok || !r.movement) throw new Error(`opening stock failed: ${r.error}`);
  const p = await postInventoryMovement(r.movement.id, tenantId, null);
  if (!p.ok) throw new Error(`opening post failed: ${p.error}`);
}

async function qtyAt(tenantId: string, itemId: string, warehouseId: string): Promise<number> {
  const { data } = await supabase
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  if (!data) return 0;
  return Number((data as { qty_on_hand: number }).qty_on_hand) || 0;
}

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H3A — Warehouse Transfer validator (15 assertions)");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whSrc = await ensureDefaultWarehouse(TENANT_A);
  const whDest = await ensureSecondWarehouse(TENANT_A, whSrc);
  const whSrcB = await ensureDefaultWarehouse(TENANT_B);
  await ensureSecondWarehouse(TENANT_B, whSrcB);

  const pA = await createSandboxProduct("a", "Transfer Sandbox A");
  const pB = await createSandboxProduct("b", "Transfer Sandbox B");
  const itemA = await ensureInventoryItemForProduct(TENANT_A, pA);
  const itemB = await ensureInventoryItemForProduct(TENANT_A, pB);
  await updateInventoryItem(TENANT_A, itemA, { track_stock: true, cost_price: 10 });
  await updateInventoryItem(TENANT_A, itemB, { track_stock: true, cost_price: 10 });

  await openingStock(TENANT_A, itemA, whSrc, 100, 10);
  await openingStock(TENANT_A, itemB, whSrc, 50, 10);

  /* 01 — Draft create */
  const c1 = await createTransfer({
    tenant_id: TENANT_A,
    source_warehouse_id: whSrc,
    destination_warehouse_id: whDest,
    notes: "Test",
    items: [
      { inventory_item_id: itemA, quantity: 10, unit_of_measure: "pcs" },
      { inventory_item_id: itemB, quantity: 5, unit_of_measure: "pcs" },
    ],
  });
  ok("01  draft create", c1.ok && !!c1.transfer && c1.transfer.status === "draft", c1.error ?? "");
  const tr1 = c1.transfer!;

  /* 02 — Submit (draft → pending) */
  const s2 = await transitionTransfer(TENANT_A, tr1.id, "pending", null);
  ok("02  submit (draft → pending)", s2.ok && s2.transfer?.status === "pending", s2.error ?? "");

  /* 03 — Approve (pending → approved) */
  const s3 = await transitionTransfer(TENANT_A, tr1.id, "approved", null);
  ok("03  approve (pending → approved)", s3.ok && s3.transfer?.status === "approved", s3.error ?? "");

  /* 04 — Ship creates transfer_out movements (one per item) */
  const srcBefore = await qtyAt(TENANT_A, itemA, whSrc);
  const s4 = await shipTransfer(TENANT_A, tr1.id, null);
  const det4 = await getTransferDetail(TENANT_A, tr1.id);
  const outCount =
    det4?.bridges.filter((b) => !!b.transfer_out_movement_id).length ?? 0;
  ok(
    "04  ship creates transfer_out movements",
    s4.ok && det4?.transfer.status === "shipped" && outCount === 2,
    `outCount=${outCount} err=${s4.error ?? ""}`,
  );

  /* 05 — Stock deducted from source after ship */
  const srcAfter = await qtyAt(TENANT_A, itemA, whSrc);
  ok(
    "05  source stock deducted after ship",
    srcAfter === srcBefore - 10,
    `before=${srcBefore} after=${srcAfter}`,
  );

  /* 06 — Cannot over-ship (qty > source stock rejected; stays approved) */
  /* Build a transfer with an item that has zero source stock. */
  const pC = await createSandboxProduct("c", "Transfer Sandbox C");
  const itemC = await ensureInventoryItemForProduct(TENANT_A, pC);
  await updateInventoryItem(TENANT_A, itemC, { track_stock: true, cost_price: 5 });
  /* itemC has 0 stock at whSrc. */
  const c6 = await createTransfer({
    tenant_id: TENANT_A,
    source_warehouse_id: whSrc,
    destination_warehouse_id: whDest,
    items: [{ inventory_item_id: itemC, quantity: 5, unit_of_measure: "pcs" }],
  });
  if (c6.ok && c6.transfer) {
    await transitionTransfer(TENANT_A, c6.transfer.id, "pending", null);
    await transitionTransfer(TENANT_A, c6.transfer.id, "approved", null);
    const s6 = await shipTransfer(TENANT_A, c6.transfer.id, null);
    const det6 = await getTransferDetail(TENANT_A, c6.transfer.id);
    ok(
      "06  cannot over-ship",
      !s6.ok && det6?.transfer.status === "approved",
      `error=${s6.error ?? ""} status=${det6?.transfer.status}`,
    );
  } else {
    ok("06  cannot over-ship", false, "setup failed");
  }

  /* 07 — Receive creates transfer_in movements */
  const destBeforeA = await qtyAt(TENANT_A, itemA, whDest);
  const s7 = await receiveTransfer(TENANT_A, tr1.id, null);
  const det7 = await getTransferDetail(TENANT_A, tr1.id);
  const inCount = det7?.bridges.filter((b) => !!b.transfer_in_movement_id).length ?? 0;
  ok(
    "07  receive creates transfer_in movements",
    s7.ok && det7?.transfer.status === "received" && inCount === 2,
    `inCount=${inCount} err=${s7.error ?? ""}`,
  );

  /* 08 — Stock appears in destination after receive */
  const destAfterA = await qtyAt(TENANT_A, itemA, whDest);
  ok(
    "08  destination stock increased after receive",
    destAfterA === destBeforeA + 10,
    `before=${destBeforeA} after=${destAfterA}`,
  );

  /* 09 — Bridge row links transfer_item → both movement ids */
  const det9 = det7!;
  const allPaired = det9.bridges.every(
    (b) => !!b.transfer_out_movement_id && !!b.transfer_in_movement_id,
  );
  ok("09  bridge row pairs OUT + IN movements", allPaired);

  /* 10 — Atomic rollback: zero-stock line aborts whole ship (no partial inserts).
         Build a fresh transfer with TWO items: itemB (stock=enough,
         pre-approved adjustment top-up) and a brand-new itemD with zero
         stock. After ship attempt, NO transfer_out should exist for
         either item. */
  const topUpB = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemB,
    warehouse_id: whSrc,
    movement_type: "adjustment_in",
    quantity: 50,
    unit_cost: 10,
    adjustment_reason: "Sandbox topup for atomic rollback test",
    pre_approved: true,
    created_by: null,
  });
  if (topUpB.ok && topUpB.movement) {
    await postInventoryMovement(topUpB.movement.id, TENANT_A, null);
  }
  const pD = await createSandboxProduct("d", "Transfer Sandbox D");
  const itemD = await ensureInventoryItemForProduct(TENANT_A, pD);
  await updateInventoryItem(TENANT_A, itemD, { track_stock: true, cost_price: 8 });
  const c10 = await createTransfer({
    tenant_id: TENANT_A,
    source_warehouse_id: whSrc,
    destination_warehouse_id: whDest,
    items: [
      { inventory_item_id: itemB, quantity: 3, unit_of_measure: "pcs" },
      { inventory_item_id: itemD, quantity: 1, unit_of_measure: "pcs" } /* zero stock */,
    ],
  });
  let atomicOk = false;
  if (c10.ok && c10.transfer) {
    await transitionTransfer(TENANT_A, c10.transfer.id, "pending", null);
    await transitionTransfer(TENANT_A, c10.transfer.id, "approved", null);
    const s10 = await shipTransfer(TENANT_A, c10.transfer.id, null);
    /* Now inspect: NO transfer_out movements for this transfer should
       have been created (pre-flight catches before any post). */
    const det10 = await getTransferDetail(TENANT_A, c10.transfer.id);
    const anyPosted = (det10?.bridges ?? []).some((b) => !!b.transfer_out_movement_id);
    /* Also peek stock-movements directly. */
    const { data: linkedMv } = await supabase
      .from("inventory_stock_movements")
      .select("id")
      .eq("tenant_id", TENANT_A)
      .eq("source_type", "inventory_transfer")
      .in("source_id", (det10?.items ?? []).map((i) => i.id));
    atomicOk = !s10.ok && !anyPosted && (linkedMv ?? []).length === 0;
  }
  ok("10  atomic rollback on partial-stock ship", atomicOk);

  /* 11 — Void after ship preserves audit + reverses stock correctly */
  const destBeforeVoid = await qtyAt(TENANT_A, itemA, whDest);
  const srcBeforeVoid = await qtyAt(TENANT_A, itemA, whSrc);
  const v11 = await voidTransfer(TENANT_A, tr1.id, null, "test void rollback");
  const det11 = await getTransferDetail(TENANT_A, tr1.id);
  const destAfterVoid = await qtyAt(TENANT_A, itemA, whDest);
  const srcAfterVoid = await qtyAt(TENANT_A, itemA, whSrc);
  /* Void should reverse both transfer_in (dest −10) and transfer_out (src +10). */
  const auditCount = await supabase
    .from("inventory_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_A)
    .eq("entity_type", "transfer")
    .eq("entity_id", tr1.id);
  ok(
    "11  void after ship reverses stock + audit",
    v11.ok &&
      det11?.transfer.status === "voided" &&
      destAfterVoid === destBeforeVoid - 10 &&
      srcAfterVoid === srcBeforeVoid + 10 &&
      (auditCount.count ?? 0) > 0,
    `dest:${destBeforeVoid}→${destAfterVoid} src:${srcBeforeVoid}→${srcAfterVoid} status=${det11?.transfer.status}`,
  );

  /* 12 — Tenant isolation */
  const listA = await listTransfers({ tenantId: TENANT_A, limit: 50 });
  const listB = await listTransfers({ tenantId: TENANT_B, limit: 50 });
  /* TENANT_A has at least 3 transfers; TENANT_B should have 0. */
  ok(
    "12  tenant isolation",
    listA.length >= 3 && listB.length === 0,
    `A=${listA.length} B=${listB.length}`,
  );

  /* 13 — Movement → transfer link resolves */
  /* Pick any transfer_out movement from det9 (the received transfer). */
  const sampleOut = det9.bridges.find((b) => !!b.transfer_out_movement_id)?.transfer_out_movement_id;
  let linkOk = false;
  if (sampleOut) {
    const link = await resolveTransferLinkForMovement(TENANT_A, sampleOut);
    linkOk = !!link && link.transfer_id === det9.transfer.id;
  }
  ok("13  movement → transfer link resolves", linkOk);

  /* 14 — Humanized errors (no raw 22P / Postgres codes in user-facing responses).
     Build a same-source/destination transfer (CHECK constraint violation
     in raw SQL → must surface a human message). */
  const c14 = await createTransfer({
    tenant_id: TENANT_A,
    source_warehouse_id: whSrc,
    destination_warehouse_id: whSrc,
    items: [{ inventory_item_id: itemA, quantity: 1, unit_of_measure: "pcs" }],
  });
  const human14 =
    !c14.ok &&
    typeof c14.error === "string" &&
    !/22P\d{2}|^P\d{4}|violates check constraint/i.test(c14.error);
  ok("14  humanized errors (no raw PG codes)", human14, c14.error ?? "");

  /* 15 — Existing inventory validators still pass */
  console.log("─".repeat(72));
  console.log("15  Chained inventory validators");
  console.log("─".repeat(72));
  const chains = [
    "validate:inventory",
    "validate:inventory-unification",
    "validate:inventory-discipline",
  ];
  let chainOk = true;
  for (const c of chains) {
    const r = spawnSync("npm", ["run", "--silent", c], {
      stdio: "inherit",
      env: { ...process.env },
    });
    if (r.status !== 0) {
      chainOk = false;
      console.log(`  [FAIL]  ${c} exited ${r.status}`);
    }
  }
  ok("15  existing inventory validators still pass", chainOk);

  console.log("─".repeat(72));
  console.log(`Total: ${passes} pass · ${failures} fail`);
  console.log("─".repeat(72));

  await clean();
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
