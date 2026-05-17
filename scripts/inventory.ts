#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.2.1 — Universal Inventory validator.

   The ledger is now keyed on inventory_item_id, and the module owns its
   own master data: items, types (system + custom), and warehouses.

   Coverage (20 assertions):
     01  System item types seeded
     02  Custom item type creation (icon, color)
     03  Duplicate custom-type name rejected
     04  System type cannot be deleted
     05  Custom item type tenant isolation
     06  Default warehouse seeder idempotent
     07  Custom warehouse creation
     08  createInventoryItem — auto code (MC-000001 / SP-000001 / …)
     09  Create different item TYPES (machine, spare, packaging, exhibition,
         office, damaged, consumable, no linked product)
     10  Item without linked product works (independent of products table)
     11  Quick add with initial_quantity posts opening_balance movement
     12  Stock movement created from item uses inventory_item_id
     13  Post IN increases stock to 100
     14  Post OUT decreases stock 100 → 60
     15  Negative stock rejected (422)
     16  Posted movement immutable
     17  Double post idempotent
     18  Void posts reversing entry; balance moves back
     19  Tenant isolation — A cannot see B's movements
     20  rebuildStockBalance matches movement history
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
  ensureDefaultWarehouse,
  rebuildStockBalance,
} from "../src/lib/inventory/posting";
import {
  buildMovementHistory,
  getStockBalance,
  listItemTypes,
} from "../src/lib/inventory/queries";
import {
  createInventoryItem,
  createItemType,
  archiveItemType,
} from "../src/lib/inventory/items";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inventory] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000D1";
const TENANT_B = "00000000-0000-4000-a000-0000000000D2";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-o21-${id.slice(-4)}`,
      name: `Phase-O2.1 Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase O.2.1 — Universal Inventory validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  /* 01 — System item types seeded. */
  const typesA = await listItemTypes(TENANT_A);
  const systemTypes = typesA.filter((t) => t.is_system);
  const expectedKeys = new Set([
    "finished_product","machine","machine_part","spare_part","accessory","attachment",
    "raw_material","semi_finished","packaging_material","printed_material","consumable",
    "tool","maintenance_item","office_supply","exhibition_material","marketing_material",
    "sample","returned_goods","damaged_goods","refurbished_goods","obsolete_stock",
    "service_item","other",
  ]);
  const seededKeys = new Set(systemTypes.map((t) => t.type_key));
  const allSeeded = Array.from(expectedKeys).every((k) => seededKeys.has(k));
  ok("01  system item types seeded (23 default types)", systemTypes.length >= 23 && allSeeded, `seeded=${systemTypes.length}`);

  /* 02 — Custom item type. */
  const custom = await createItemType({
    tenant_id: TENANT_A,
    type_name: "CEO Office Items",
    icon: "office",
    color: "purple",
    description: "Things assigned to the CEO's office",
  });
  ok(
    "02  custom item type created with icon + color",
    custom.ok && custom.type?.is_system === false && custom.type?.icon === "office" && custom.type?.color === "purple",
    custom.error ?? "",
  );

  /* 03 — Duplicate name rejected. */
  const dup = await createItemType({
    tenant_id: TENANT_A,
    type_name: "CEO Office Items",  // same name
    icon: "box", color: "slate",
  });
  ok("03  duplicate custom-type name rejected", !dup.ok, dup.error ?? "");

  /* 04 — System type cannot be deleted. */
  const sysOther = systemTypes.find((t) => t.type_key === "other")!;
  const delSys = await archiveItemType(TENANT_A, sysOther.id);
  ok("04  system type cannot be deleted", !delSys.ok, delSys.error ?? "");

  /* 05 — Custom type tenant isolation. */
  const customB = await createItemType({
    tenant_id: TENANT_B,
    type_name: "B Special",
    icon: "star", color: "rose",
  });
  /* List types for A; the B-custom must not appear. */
  const typesAagain = await listItemTypes(TENANT_A);
  const bLeaked = typesAagain.some((t) => t.id === customB.type?.id);
  ok("05  custom item type tenant isolation", customB.ok && !bLeaked);

  /* 06 — Default warehouse idempotent. */
  const wh1 = await ensureDefaultWarehouse(TENANT_A);
  const wh1again = await ensureDefaultWarehouse(TENANT_A);
  ok("06  default warehouse seeder idempotent", wh1 === wh1again, `wh=${wh1.slice(0, 8)}`);

  /* 07 — Custom warehouse creation. */
  const customWh = await supabase
    .from("inventory_warehouses")
    .insert({ tenant_id: TENANT_A, code: "WH-OVERFLOW", name: "Overflow" })
    .select("id")
    .single();
  ok("07  custom warehouse created", !customWh.error, customWh.error?.message ?? "");

  /* 08 — Auto code (MC-000001 / SP-000001 / …) — create one machine
     and one spare part item and verify the code prefix + sequence. */
  const m1 = await createInventoryItem({
    tenant_id: TENANT_A, item_name: "Lockstitch Machine LX-9000",
    type_key: "machine", unit_of_measure: "set",
  });
  const sp1 = await createInventoryItem({
    tenant_id: TENANT_A, item_name: "Needle Bar Assembly",
    type_key: "spare_part", unit_of_measure: "pcs",
  });
  ok(
    "08  auto item code: machine → MC-000001, spare part → SP-000001",
    m1.ok && sp1.ok &&
      m1.item?.item_code === "MC-000001" &&
      sp1.item?.item_code === "SP-000001",
    `mc=${m1.item?.item_code} sp=${sp1.item?.item_code}`,
  );

  /* 09 — Create items across many types. */
  const created = await Promise.all([
    createInventoryItem({ tenant_id: TENANT_A, item_name: "Export Carton 60×40×40", type_key: "packaging_material", unit_of_measure: "carton" }),
    createInventoryItem({ tenant_id: TENANT_A, item_name: "Booth LED Backdrop",     type_key: "exhibition_material", unit_of_measure: "pcs" }),
    createInventoryItem({ tenant_id: TENANT_A, item_name: "Printer Toner — Black",  type_key: "office_supply",      unit_of_measure: "pcs" }),
    createInventoryItem({ tenant_id: TENANT_A, item_name: "Damaged Carton Stock",   type_key: "damaged_goods",      unit_of_measure: "pcs" }),
    createInventoryItem({ tenant_id: TENANT_A, item_name: "Sewing Machine Oil",     type_key: "consumable",         unit_of_measure: "liter", is_consumable: true }),
  ]);
  ok(
    "09  create items of types packaging/exhibition/office/damaged/consumable",
    created.every((r) => r.ok && r.item),
    created.map((r) => r.item?.item_code).join(" · "),
  );

  /* 10 — Item without linked product works (the items we just created
     have no linked_product_id and they were created cleanly). */
  ok(
    "10  inventory item works without a linked product",
    m1.item?.linked_product_id == null && sp1.item?.linked_product_id == null,
  );

  /* 11 — Quick add with initial_quantity posts opening_balance. */
  const seeded = await createInventoryItem({
    tenant_id: TENANT_A, item_name: "Office Chair",
    type_key: "office_supply", unit_of_measure: "pcs",
    initial_quantity: 6, initial_warehouse_id: wh1,
  });
  const seededBal = seeded.item ? await getStockBalance(TENANT_A, seeded.item.id, wh1) : null;
  ok(
    "11  quick-add with initial_quantity posts opening_balance",
    seeded.ok && !!seeded.opening_movement_id && seededBal?.qty_on_hand === 6,
    `bal=${seededBal?.qty_on_hand}`,
  );

  /* 12 — Stock movement uses inventory_item_id. */
  const mvCheck = await supabase
    .from("inventory_stock_movements")
    .select("id, inventory_item_id, source_type, source_id, movement_type")
    .eq("id", seeded.opening_movement_id ?? "")
    .maybeSingle();
  const mv = mvCheck.data as { id: string; inventory_item_id: string; source_type: string; source_id: string; movement_type: string } | null;
  ok(
    "12  movement carries inventory_item_id + opening_balance source",
    !!mv && mv.inventory_item_id === seeded.item!.id && mv.movement_type === "opening_balance" && mv.source_type === "inventory_item_opening_balance",
  );

  /* 13 — Post IN +100 on m1. */
  const inCreate = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: m1.item!.id,
    warehouse_id: wh1, movement_type: "opening_balance", quantity: 100,
  });
  await postInventoryMovement(inCreate.movement!.id, TENANT_A, null);
  const bal0 = await getStockBalance(TENANT_A, m1.item!.id, wh1);
  ok("13  post IN increases stock to 100", bal0.qty_on_hand === 100, `on_hand=${bal0.qty_on_hand}`);

  /* 14 — Post OUT 40. */
  const outCreate = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: m1.item!.id,
    warehouse_id: wh1, movement_type: "sales_shipment", quantity: 40,
  });
  await postInventoryMovement(outCreate.movement!.id, TENANT_A, null);
  const bal1 = await getStockBalance(TENANT_A, m1.item!.id, wh1);
  ok("14  post OUT decreases stock 100 → 60", bal1.qty_on_hand === 60, `on_hand=${bal1.qty_on_hand}`);

  /* 15 — Negative rejected. */
  const over = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: m1.item!.id,
    warehouse_id: wh1, movement_type: "adjustment_out", quantity: 500,
  });
  const overPost = await postInventoryMovement(over.movement!.id, TENANT_A, null);
  ok("15  negative stock rejected (422)", !overPost.ok && overPost.code === 422, overPost.error ?? "");

  /* 16 — Posted immutable. */
  const updTry = await supabase
    .from("inventory_stock_movements")
    .update({ quantity: 999 })
    .eq("id", inCreate.movement!.id);
  ok("16  posted movement immutable", !!updTry.error, updTry.error?.message?.slice(0, 60) ?? "");

  /* 17 — Double post idempotent. */
  const dbl = await postInventoryMovement(inCreate.movement!.id, TENANT_A, null);
  ok("17  double post idempotent", dbl.ok && dbl.already_posted === true);

  /* 18 — Void OUT shipment, balance returns to 100. */
  const voided = await voidInventoryMovement(outCreate.movement!.id, TENANT_A, null, "test reversal");
  const bal2 = await getStockBalance(TENANT_A, m1.item!.id, wh1);
  ok(
    "18  void reverses stock 60 → 100",
    voided.ok && !!voided.reverse_movement_id && bal2.qty_on_hand === 100,
    `on_hand=${bal2.qty_on_hand}`,
  );

  /* 19 — Tenant isolation. */
  const whB = await ensureDefaultWarehouse(TENANT_B);
  const itemB = await createInventoryItem({
    tenant_id: TENANT_B, item_name: "B-side item",
    type_key: "machine", unit_of_measure: "pcs",
  });
  const bMove = await createInventoryMovement({
    tenant_id: TENANT_B, inventory_item_id: itemB.item!.id,
    warehouse_id: whB, movement_type: "opening_balance", quantity: 9,
  });
  await postInventoryMovement(bMove.movement!.id, TENANT_B, null);
  const aSees = await buildMovementHistory({ tenantId: TENANT_A });
  const aId = TENANT_A.toLowerCase();
  const leaked = aSees.some((m) => m.tenant_id.toLowerCase() !== aId);
  ok("19  tenant isolation — A cannot see B's movements", !leaked, `rows=${aSees.length}`);

  /* 20 — rebuildStockBalance matches history. */
  const rebuilt = await rebuildStockBalance(TENANT_A, m1.item!.id, wh1);
  const after = await getStockBalance(TENANT_A, m1.item!.id, wh1);
  const hist = await buildMovementHistory({ tenantId: TENANT_A, inventoryItemId: m1.item!.id });
  const expected = hist
    .filter((m) => m.status !== "draft" && m.warehouse_id === wh1)
    .reduce((acc, m) => acc + (m.direction === "in" ? m.quantity : -m.quantity), 0);
  ok(
    "20  rebuildStockBalance matches movement history",
    rebuilt.ok &&
      Math.abs(rebuilt.qty_on_hand - expected) < 0.0001 &&
      Math.abs(after.qty_on_hand - expected) < 0.0001,
    `rebuilt=${rebuilt.qty_on_hand} stored=${after.qty_on_hand} expected=${expected}`,
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
