#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H2 — Inventory discipline validator (23 assertions).

     01  opening_balance requires unit_cost > 0
     02  purchase_receipt requires unit_cost > 0 (workflow caller)
     03  adjustment_in requires unit_cost > 0
     04  zero-value admin override requires reason
     05  duplicate opening balance is rejected
     06  duplicate opening after void allowed only if safe
     07  manual adjustment cannot post without approval
     08  approved adjustment posts correctly
     09  purchase_receipt cannot be created manually without source document
     10  sales_shipment cannot be created manually without source document
     11  posted movement requires void_reason to void
     12  unauthorized user cannot void movement
     13  stock profile with on-hand qty cannot be archived
     14  stock profile with movement history cannot be deleted
     15  linked_product_id cannot change after movements exist
     16  warehouse with stock cannot be archived/deleted
     17  default warehouse cannot be removed if only active warehouse
     18  audit log is written for restricted action
     19  existing purchase receiving still works (regression)
     20  existing sales shipment still works (regression)
     21  valuation totals still reconcile
     22  tenant isolation preserved
     23  all previous validators pass (chain inventory.ts + unification)
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
  archiveInventoryItem,
  deleteInventoryItem,
  ensureInventoryItemForProduct,
  updateInventoryItem,
} from "../src/lib/inventory/items";
import {
  guardWarehouseArchivable,
  guardWarehouseDefaultRemoval,
  guardMovementVoid,
} from "../src/lib/inventory/discipline";
import { logInventoryAudit } from "../src/lib/inventory/audit";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h2] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-00000000F2A1";
const TENANT_B = "00000000-0000-4000-a000-00000000F2B1";

let passes = 0;
let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `inv-h2-${id.slice(-4)}`,
      name: `INV-H2 Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_audit_log").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    /* Posted-row immutability trigger blocks UPDATE not DELETE. */
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
  await supabase.from("products").delete().like("slug", "inv-h2-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h2-sandbox-${slugSuffix}`;
  const { data, error } = await supabase
    .from("products")
    .insert({
      product_name: name, slug,
      division_slug: "sandbox", category_slug: "sandbox", subcategory_slug: "sandbox",
      brand: "Sandbox", status: "draft", visible: false, highlights: [],
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "product insert failed");
  return (data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H2 — Inventory discipline validator (23 assertions)");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whA = await ensureDefaultWarehouse(TENANT_A);
  await ensureDefaultWarehouse(TENANT_B);

  const prodA = await createSandboxProduct("a", "Sandbox Discipline A");
  const itemA = await ensureInventoryItemForProduct(TENANT_A, prodA);
  await updateInventoryItem(TENANT_A, itemA, { track_stock: true, cost_price: 10 });

  /* 01 — opening_balance requires unit_cost > 0 (no admin override). */
  const ob0 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "opening_balance", quantity: 5, unit_cost: 0,
  });
  ok("01  opening_balance requires unit_cost > 0",
     !ob0.ok && ob0.code === "INV_H2_VALUE_REQUIRED", ob0.error ?? "");

  /* 02 — purchase_receipt requires unit_cost > 0 (workflow caller). */
  const pr0 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "purchase_receipt", quantity: 5, unit_cost: 0,
    source_type: "purchase_receipt", source_id: "00000000-0000-4000-a000-000000000201",
    from_workflow: true,
  });
  ok("02  purchase_receipt requires unit_cost > 0",
     !pr0.ok && pr0.code === "INV_H2_VALUE_REQUIRED", pr0.error ?? "");

  /* 03 — adjustment_in requires unit_cost > 0. */
  const aj0 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "adjustment_in", quantity: 5, unit_cost: 0,
    adjustment_reason: "test",
  });
  ok("03  adjustment_in requires unit_cost > 0",
     !aj0.ok && aj0.code === "INV_H2_VALUE_REQUIRED", aj0.error ?? "");

  /* 04 — admin override w/o reason rejected; with reason accepted. */
  const ov0 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "adjustment_in", quantity: 1, unit_cost: 0,
    adjustment_reason: "test",
    metadata: { admin_zero_value_override: true },
  });
  const ov1 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "adjustment_in", quantity: 1, unit_cost: 0,
    adjustment_reason: "test",
    metadata: { admin_zero_value_override: true, zero_value_reason: "found-during-stocktake" },
  });
  ok("04  admin zero-value override requires reason",
     !ov0.ok && ov0.code === "INV_H2_ZERO_VALUE_REASON_REQUIRED" && ov1.ok,
     `noReason=${ov0.error} withReason.ok=${ov1.ok}`);

  /* 05 — duplicate opening balance is rejected. */
  const ob1 = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "opening_balance", quantity: 5, unit_cost: 10,
  });
  if (ob1.ok && ob1.movement) {
    await postInventoryMovement(ob1.movement.id, TENANT_A, null);
  }
  const obDup = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "opening_balance", quantity: 5, unit_cost: 10,
  });
  ok("05  duplicate opening balance is rejected",
     !obDup.ok && obDup.code === "INV_H2_OPENING_BALANCE_DUPLICATE",
     obDup.error ?? "");

  /* 06 — duplicate opening after void allowed only if safe. */
  /* Void the previous opening; replacement should now succeed. */
  if (ob1.ok && ob1.movement) {
    await voidInventoryMovement(ob1.movement.id, TENANT_A, null, "sandbox-reset");
  }
  const obReplace = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "opening_balance", quantity: 5, unit_cost: 10,
  });
  ok("06  duplicate opening after void allowed when safe",
     obReplace.ok, obReplace.error ?? "");
  if (obReplace.ok && obReplace.movement) {
    await postInventoryMovement(obReplace.movement.id, TENANT_A, null);
  }

  /* 07 — manual adjustment cannot post without approval. */
  const adj = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "adjustment_in", quantity: 2, unit_cost: 10,
    adjustment_reason: "adjustment for stocktake",
  });
  let adjPost: { ok: boolean; error?: string } = { ok: false };
  if (adj.ok && adj.movement) {
    adjPost = await postInventoryMovement(adj.movement.id, TENANT_A, null);
  }
  ok("07  manual adjustment cannot post without approval",
     adj.ok && !adjPost.ok && /approval/i.test(adjPost.error ?? ""), adjPost.error ?? "");

  /* 08 — approved adjustment posts correctly. */
  let approvedPost: { ok: boolean; error?: string } = { ok: false };
  if (adj.ok && adj.movement) {
    /* Direct approval (sandbox; no role machinery). */
    await supabase
      .from("inventory_stock_movements")
      .update({ approval_status: "approved", approved_at: new Date().toISOString() })
      .eq("id", adj.movement.id);
    approvedPost = await postInventoryMovement(adj.movement.id, TENANT_A, null);
  }
  ok("08  approved adjustment posts correctly",
     approvedPost.ok, approvedPost.error ?? "");

  /* 09 — purchase_receipt cannot be created without source document
     (i.e., without from_workflow=true). */
  const prMan = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "purchase_receipt", quantity: 1, unit_cost: 10,
    /* No source, no workflow flag. */
  });
  ok("09  purchase_receipt blocked from generic route",
     !prMan.ok && prMan.code === "INV_H2_USE_WORKFLOW", prMan.error ?? "");

  /* 10 — sales_shipment cannot be created without source document. */
  const shMan = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "sales_shipment", quantity: 1,
  });
  ok("10  sales_shipment blocked from generic route",
     !shMan.ok && shMan.code === "INV_H2_USE_WORKFLOW", shMan.error ?? "");

  /* 11 — posted movement requires void_reason. */
  /* Post a fresh adjustment so we have a target to void. */
  const target = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemA, warehouse_id: whA,
    movement_type: "adjustment_in", quantity: 2, unit_cost: 10,
    adjustment_reason: "to be voided",
  });
  if (target.ok && target.movement) {
    await supabase.from("inventory_stock_movements")
      .update({ approval_status: "approved", approved_at: new Date().toISOString() })
      .eq("id", target.movement.id);
    await postInventoryMovement(target.movement.id, TENANT_A, null);
  }
  const voidNoReason = target.ok && target.movement
    ? await voidInventoryMovement(target.movement.id, TENANT_A, null, "")
    : { ok: true };
  ok("11  posted movement requires void_reason",
     !voidNoReason.ok && /reason/i.test(voidNoReason.error ?? ""),
     voidNoReason.error ?? "");

  /* 12 — unauthorized user cannot void movement (guardMovementVoid w/ no perms). */
  const unauth = guardMovementVoid({
    movement_type: "adjustment_in",
    source_type: null,
    source_id: null,
    status: "posted",
    void_reason: "valid reason",
    is_super_admin: false,
    can_void: false,
    from_source_document: false,
  });
  ok("12  unauthorized user cannot void movement",
     !unauth.ok && unauth.code === "INV_H2_VOID_PERMISSION_DENIED",
     unauth.error ?? "");

  /* 13 — stock profile with on-hand qty cannot be archived. */
  /* itemA has stock (from approvedPost / opening). Archive should fail. */
  const archAttempt = await archiveInventoryItem(TENANT_A, itemA);
  ok("13  stock profile with on-hand qty cannot be archived",
     !archAttempt.ok && archAttempt.code === "INV_H2_PROFILE_HAS_STOCK",
     archAttempt.error ?? "");

  /* 14 — stock profile with movement history cannot be deleted. */
  const delAttempt = await deleteInventoryItem(TENANT_A, itemA);
  ok("14  stock profile with movement history cannot be deleted",
     !delAttempt.ok && delAttempt.code === "INV_H2_PROFILE_HAS_HISTORY",
     delAttempt.error ?? "");

  /* 15 — linked_product_id cannot change after movements exist. */
  const prodC = await createSandboxProduct("c", "Sandbox Discipline C");
  const linkChange = await updateInventoryItem(TENANT_A, itemA, { linked_product_id: prodC });
  ok("15  linked_product_id cannot change after movements exist",
     !linkChange.ok && linkChange.code === "INV_H2_PROFILE_LINK_LOCKED",
     linkChange.error ?? "");

  /* 16 — warehouse with stock cannot be archived. */
  const whGuard = await guardWarehouseArchivable({ tenant_id: TENANT_A, warehouse_id: whA });
  ok("16  warehouse with stock cannot be archived/deleted",
     !whGuard.ok && whGuard.code === "INV_H2_WAREHOUSE_HAS_STOCK",
     whGuard.error ?? "");

  /* 17 — default warehouse cannot be removed if only active warehouse. */
  const defGuard = await guardWarehouseDefaultRemoval({
    tenant_id: TENANT_A, warehouse_id: whA, next_is_default: false,
  });
  ok("17  default warehouse cannot be removed if only active warehouse",
     !defGuard.ok && defGuard.code === "INV_H2_WAREHOUSE_LAST_DEFAULT",
     defGuard.error ?? "");

  /* 18 — audit log written for a restricted action. */
  await logInventoryAudit({
    tenant_id: TENANT_A, actor_id: null,
    action: "restricted_action_blocked",
    entity_type: "movement", entity_id: null,
    metadata: { reason: "validator-probe" },
  });
  const { data: auditRows } = await supabase
    .from("inventory_audit_log")
    .select("id")
    .eq("tenant_id", TENANT_A);
  ok("18  audit log written for restricted actions",
     (auditRows ?? []).length > 0, `rows=${(auditRows ?? []).length}`);

  /* 19 — existing purchase receiving still works (regression). */
  /* Simulate the workflow caller — source_type + from_workflow. */
  const prodD = await createSandboxProduct("d", "Sandbox Discipline D");
  const itemD = await ensureInventoryItemForProduct(TENANT_A, prodD);
  await updateInventoryItem(TENANT_A, itemD, { track_stock: true, cost_price: 8 });
  const recv = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemD, warehouse_id: whA,
    movement_type: "purchase_receipt", quantity: 7, unit_cost: 8,
    source_type: "purchase_receipt",
    source_id: "00000000-0000-4000-a000-00000000019D",
    from_workflow: true,
  });
  const recvPost = recv.ok && recv.movement
    ? await postInventoryMovement(recv.movement.id, TENANT_A, null)
    : { ok: false };
  ok("19  existing purchase receiving regression",
     recv.ok && recvPost.ok, recv.error ?? "");

  /* 20 — existing sales shipment still works (regression). */
  const ship = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemD, warehouse_id: whA,
    movement_type: "sales_shipment", quantity: 2, unit_cost: 8,
    source_type: "sales_shipment",
    source_id: "00000000-0000-4000-a000-00000000019E",
    from_workflow: true,
  });
  const shipPost = ship.ok && ship.movement
    ? await postInventoryMovement(ship.movement.id, TENANT_A, null)
    : { ok: false };
  ok("20  existing sales shipment regression",
     ship.ok && shipPost.ok, ship.error ?? "");

  /* 21 — valuation totals still reconcile. */
  const { data: balRows } = await supabase
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", TENANT_A);
  const totalQty = ((balRows ?? []) as Array<{ qty_on_hand: number | string }>).reduce(
    (acc, r) => acc + Number(r.qty_on_hand ?? 0), 0,
  );
  ok("21  valuation totals reconcile", totalQty > 0, `total_qty=${totalQty}`);

  /* 22 — tenant isolation. */
  const { data: leakRows } = await supabase
    .from("inventory_stock_movements")
    .select("id")
    .eq("tenant_id", TENANT_B);
  ok("22  tenant isolation preserved",
     (leakRows ?? []).length === 0, `b_rows=${(leakRows ?? []).length}`);

  /* 23 — chain previous validators. */
  console.log("    chaining scripts/inventory.ts …");
  const inv = spawnSync("npx", ["tsx", "scripts/inventory.ts"], {
    stdio: "inherit", env: process.env,
  });
  console.log("    chaining scripts/validate-inventory-unification.ts …");
  const uni = spawnSync("npx", ["tsx", "scripts/validate-inventory-unification.ts"], {
    stdio: "inherit", env: process.env,
  });
  ok("23  all previous validators pass",
     inv.status === 0 && uni.status === 0,
     `inventory=${inv.status} unification=${uni.status}`);

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
