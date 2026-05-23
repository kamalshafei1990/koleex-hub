#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H4B — Serial Tracking Foundation validator (16 assertions).

     01  serial create
     02  duplicate (tenant, serial_no) blocked
     03  IN movement creates / stamps serials
     04  quantity mismatch (qty ≠ serial count) rejected
     05  transfer changes warehouse on receive (state flow)
     06  sales shipment marks sold + stamps customer_id + sold_date
     07  sold serial cannot ship again
     08  return restores serial (disposition=restock → in_stock)
     09  scrap blocks reuse (scrap disposition or scrap → status=scrapped)
     10  void reverses serial state cleanly
     11  serial traceability — getSerialHistory chronological
     12  tenant isolation (tenant A's serials invisible to tenant B)
     13  validate:inventory-transfers chain
     14  validate:inventory-returns chain
     15  validate:inventory + unification + discipline chain
     16  validate:inventory-variants chain
   ========================================================================== */

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import {
  ensureInventoryItemForProduct,
  updateInventoryItem,
} from "../src/lib/inventory/items";
import {
  createSerial,
  listSerials,
  getSerialCurrentState,
  getSerialHistory,
} from "../src/lib/inventory/serials";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h4b] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_A = "00000000-0000-4000-a000-00000000F4C1";
const TENANT_B = "00000000-0000-4000-a000-00000000F4D1";

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
          slug: `inv-h4b-${id.slice(-4)}`,
          name: `INV-H4B Sandbox ${id.slice(-4)}`,
          is_host: false,
          active: true,
        },
        { onConflict: "id" },
      );
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_audit_log").delete().eq("tenant_id", t);
    await supabase.from("inventory_serials").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_batches").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_variants").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
  await supabase.from("products").delete().like("slug", "inv-h4b-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h4b-sandbox-${slugSuffix}`;
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

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H4B — Serial Tracking Foundation validator (16 assertions)");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whA = await ensureDefaultWarehouse(TENANT_A);
  /* Create a second warehouse on tenant A for transfer flow. */
  const { data: wh2Data } = await supabase
    .from("inventory_warehouses")
    .insert({
      tenant_id: TENANT_A,
      code: "WH2-INV4B",
      name: "Warehouse 2",
      is_default: false,
      is_active: true,
      location_type: "warehouse",
    })
    .select("id")
    .single();
  const whA2 = (wh2Data as { id: string }).id;
  const whB = await ensureDefaultWarehouse(TENANT_B);

  const pA = await createSandboxProduct("a", "Serials Sandbox A");
  const pB = await createSandboxProduct("b", "Serials Sandbox B (isolation)");
  const itemA = await ensureInventoryItemForProduct(TENANT_A, pA);
  const itemB = await ensureInventoryItemForProduct(TENANT_B, pB);
  await updateInventoryItem(TENANT_A, itemA, { track_stock: true, cost_price: 100, track_serials: true } as never);
  await updateInventoryItem(TENANT_B, itemB, { track_stock: true, cost_price: 50, track_serials: true } as never);

  /* Sandbox contact for sales (customer) on tenant A. */
  const { data: ctRow } = await supabase
    .from("contacts")
    .insert({
      tenant_id: TENANT_A,
      name: "Sandbox Customer INV-H4B",
      contact_type: "customer",
    })
    .select("id")
    .single();
  const customerId = (ctRow as { id: string } | null)?.id ?? null;

  /* 01 — serial create */
  const s1 = await createSerial({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    serial_no: "SN-001",
    warehouse_id: whA,
    status: "in_stock",
    condition_status: "new",
  });
  ok("01  serial create", s1.ok && !!s1.serial && s1.serial.status === "in_stock", s1.error ?? "");
  const sn1 = s1.serial!;

  /* 02 — duplicate (tenant, serial_no) blocked */
  const s2 = await createSerial({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    serial_no: "SN-001",
  });
  ok("02  duplicate serial_no blocked", !s2.ok, s2.error ?? "");

  /* 03 — IN movement that carries serial ids updates their state. */
  const s3a = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-002", status: "in_stock" });
  const s3b = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-003", status: "in_stock" });
  const s3c = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-004", status: "in_stock" });
  const inMv = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "opening_balance",
    quantity: 3,
    unit_cost: 100,
    serial_ids: [s3a.serial!.id, s3b.serial!.id, s3c.serial!.id],
  });
  let inPosted = false;
  if (inMv.ok && inMv.movement) {
    const p = await postInventoryMovement(inMv.movement.id, TENANT_A, null);
    inPosted = p.ok;
  }
  /* Verify the serials reference this movement as their current_movement_id. */
  const st3a = await getSerialCurrentState(TENANT_A, s3a.serial!.id);
  ok(
    "03  IN movement stamps serials' current_movement_id",
    inMv.ok && inPosted && st3a?.current_movement_id === inMv.movement!.id && st3a?.warehouse_id === whA,
    inMv.error ?? "",
  );

  /* 04 — quantity mismatch (qty ≠ serial count) rejected */
  const bad4 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 2,
    unit_cost: 100,
    serial_ids: [sn1.id], // only 1 serial but qty=2
    pre_approved: true,
    adjustment_reason: "Quantity mismatch test",
  });
  ok("04  quantity mismatch rejected", !bad4.ok && /serial/i.test(bad4.error ?? ""), bad4.error ?? "");

  /* 05 — transfer flow (out → in). Verify serial moves from whA (in_transit)
         → whA2 (in_stock) via two movements. We post both directly with
         engine calls (transfer engine is exercised by chained validator). */
  const tOut = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "transfer_out",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s3a.serial!.id],
    from_workflow: true,
    source_type: "inventory_transfer",
    source_id: "22222222-2222-2222-2222-222222222222",
  });
  if (tOut.ok && tOut.movement) await postInventoryMovement(tOut.movement.id, TENANT_A, null);
  const after_out = await getSerialCurrentState(TENANT_A, s3a.serial!.id);
  /* Now receive into whA2. */
  const tIn = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA2,
    movement_type: "transfer_in",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s3a.serial!.id],
    from_workflow: true,
    source_type: "inventory_transfer",
    source_id: "22222222-2222-2222-2222-222222222222",
  });
  if (tIn.ok && tIn.movement) await postInventoryMovement(tIn.movement.id, TENANT_A, null);
  const after_in = await getSerialCurrentState(TENANT_A, s3a.serial!.id);
  ok(
    "05  transfer: out → in_transit, in → warehouse=destination + in_stock",
    after_out?.status === "in_transit" && after_in?.warehouse_id === whA2 && after_in?.status === "in_stock",
    `out=${after_out?.status} in_wh=${after_in?.warehouse_id} in_status=${after_in?.status}`,
  );

  /* 06 — sales shipment marks sold + stamps customer_id + sold_date */
  const shipMv = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "sales_shipment",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s3b.serial!.id],
    from_workflow: true,
    source_type: "sales_shipment",
    source_id: "33333333-3333-3333-3333-333333333333",
    metadata: { customer_id: customerId },
  });
  if (shipMv.ok && shipMv.movement) await postInventoryMovement(shipMv.movement.id, TENANT_A, null);
  const { data: ship_state } = await supabase
    .from("inventory_serials")
    .select("status, customer_id, sold_date")
    .eq("id", s3b.serial!.id)
    .maybeSingle();
  const ss = ship_state as { status: string; customer_id: string | null; sold_date: string | null } | null;
  ok(
    "06  sales shipment → sold + customer_id + sold_date",
    ss?.status === "sold" && ss?.customer_id === customerId && !!ss?.sold_date,
    `status=${ss?.status} customer=${ss?.customer_id} sold_date=${ss?.sold_date ?? "null"}`,
  );

  /* 07 — sold serial cannot ship again. */
  const shipAgain = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "sales_shipment",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s3b.serial!.id],
    from_workflow: true,
    source_type: "sales_shipment",
    source_id: "44444444-4444-4444-4444-444444444444",
  });
  ok("07  sold serial cannot ship again", !shipAgain.ok, shipAgain.error ?? "");

  /* 08 — return restores serial: disposition=restock → in_stock. */
  /* Create a fresh serial that is currently sold, then return it with disposition=restock. */
  const s8a = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-008", status: "sold", warehouse_id: whA });
  const retMv = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "return_in",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s8a.serial!.id],
    from_workflow: true,
    source_type: "inventory_return",
    source_id: "55555555-5555-5555-5555-555555555555",
    metadata: { disposition: "restock" },
  });
  /* IN movement validator requires items exist. Sold serial passed by id is
     treated as "update its state" — direction-in path doesn't require in_stock. */
  if (retMv.ok && retMv.movement) await postInventoryMovement(retMv.movement.id, TENANT_A, null);
  const after_return = await getSerialCurrentState(TENANT_A, s8a.serial!.id);
  ok(
    "08  return (restock) restores serial → in_stock",
    after_return?.status === "in_stock",
    `status=${after_return?.status ?? "?"}`,
  );

  /* 09 — scrap blocks reuse: adjustment_out on a serial sets it to scrapped,
         and subsequent ship is refused. */
  const s9 = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-009", status: "in_stock", warehouse_id: whA });
  const scrapMv = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_out",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s9.serial!.id],
    pre_approved: true,
    adjustment_reason: "scrap",
    metadata: { adjustment_reason: "scrap", scrap_intent: true },
  });
  if (scrapMv.ok && scrapMv.movement) await postInventoryMovement(scrapMv.movement.id, TENANT_A, null);
  const after_scrap = await getSerialCurrentState(TENANT_A, s9.serial!.id);
  const reuseScrap = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "sales_shipment",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s9.serial!.id],
    from_workflow: true,
    source_type: "sales_shipment",
    source_id: "66666666-6666-6666-6666-666666666666",
  });
  ok(
    "09  scrap blocks reuse",
    after_scrap?.status === "scrapped" && !reuseScrap.ok,
    `scrapped=${after_scrap?.status} reuse_ok=${reuseScrap.ok}`,
  );

  /* 10 — void reverses serial state cleanly. */
  const s10 = await createSerial({ tenant_id: TENANT_A, inventory_item_id: itemA, serial_no: "SN-010", status: "in_stock", warehouse_id: whA });
  const sellMv = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "sales_shipment",
    quantity: 1,
    unit_cost: 100,
    serial_ids: [s10.serial!.id],
    from_workflow: true,
    source_type: "sales_shipment",
    source_id: "77777777-7777-7777-7777-777777777777",
    metadata: { customer_id: customerId },
  });
  if (sellMv.ok && sellMv.movement) {
    await postInventoryMovement(sellMv.movement.id, TENANT_A, null);
    const before = await getSerialCurrentState(TENANT_A, s10.serial!.id);
    await voidInventoryMovement(sellMv.movement.id, TENANT_A, null, "test void reverses serial");
    const after = await getSerialCurrentState(TENANT_A, s10.serial!.id);
    ok(
      "10  void reverses serial cleanly (sold → in_stock)",
      before?.status === "sold" && after?.status === "in_stock",
      `before=${before?.status} after=${after?.status}`,
    );
  } else {
    ok("10  void reverses serial cleanly", false, sellMv.error ?? "create failed");
  }

  /* 11 — getSerialHistory chronological */
  const hist = await getSerialHistory(TENANT_A, s3a.serial!.id);
  /* s3a went through: opening_balance (IN), transfer_out (OUT), transfer_in (IN). */
  ok(
    "11  serial history chronological",
    hist.length >= 3 &&
      hist[0].direction === "in" &&
      hist[hist.length - 1].direction === "in",
    `events=${hist.length}`,
  );

  /* 12 — Tenant isolation. */
  const listA = await listSerials({ tenantId: TENANT_A, limit: 50 });
  const listB = await listSerials({ tenantId: TENANT_B, limit: 50 });
  ok(
    "12  tenant isolation",
    listA.length >= 4 && listB.length === 0,
    `A=${listA.length} B=${listB.length}`,
  );

  /* 13, 14, 15, 16 — Chained validators. */
  console.log("─".repeat(72));
  console.log("Chained inventory validators");
  console.log("─".repeat(72));
  const transferRes = spawnSync("npm", ["run", "--silent", "validate:inventory-transfers"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  ok("13  validate:inventory-transfers still passes", transferRes.status === 0);

  const returnRes = spawnSync("npm", ["run", "--silent", "validate:inventory-returns"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  ok("14  validate:inventory-returns still passes", returnRes.status === 0);

  let chainOk = true;
  for (const c of ["validate:inventory", "validate:inventory-unification", "validate:inventory-discipline"]) {
    const r = spawnSync("npm", ["run", "--silent", c], {
      stdio: "inherit",
      env: { ...process.env },
    });
    if (r.status !== 0) {
      chainOk = false;
      console.log(`  [FAIL]  ${c} exited ${r.status}`);
    }
  }
  ok("15  inventory + unification + discipline still pass", chainOk);

  const varRes = spawnSync("npm", ["run", "--silent", "validate:inventory-variants"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  ok("16  validate:inventory-variants still passes", varRes.status === 0);

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
