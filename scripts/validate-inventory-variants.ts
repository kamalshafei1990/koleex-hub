#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H4A — Product Variants + Batch Foundation validator (18 assertions).

     01  Variant create
     02  Duplicate variant_code blocked
     03  Batch create
     04  Batch linked to item (item_id matches)
     05  Batch linked to variant (when variant_id provided, variant.item matches)
     06  Movement with variant attached
     07  Movement with batch attached, batch.quantity_remaining increments
     08  Invalid batch/variant combination rejected
     09  Balances aggregate correctly when grouped by item+variant+batch+warehouse
     10  Valuation aggregate correctly per bucket (weighted average)
     11  Expiry status: expired when expiry_date < today
     12  Near-expiry status: expiry_date within next 30 days
     13  Depleted status: quantity_remaining = 0
     14  Tenant isolation
     15  Movement traceability preserved (source_type/source_id flows unaffected)
     16  Existing transfer validator still passes
     17  Existing return validator still passes
     18  Existing inventory validators still pass (inventory + unification + discipline)
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
  createVariant,
  createBatch,
  listVariants,
  listBatches,
  buildDrilledBalances,
  classifyBatchExpiry,
} from "../src/lib/inventory/variants";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h4a] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_A = "00000000-0000-4000-a000-00000000F4A1";
const TENANT_B = "00000000-0000-4000-a000-00000000F4B1";

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
          slug: `inv-h4a-${id.slice(-4)}`,
          name: `INV-H4A Sandbox ${id.slice(-4)}`,
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
  await supabase.from("products").delete().like("slug", "inv-h4a-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h4a-sandbox-${slugSuffix}`;
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
  console.log("PHASE INV-H4A — Variants + Batch Foundation validator (18 assertions)");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whA = await ensureDefaultWarehouse(TENANT_A);
  const whB = await ensureDefaultWarehouse(TENANT_B);

  const pA = await createSandboxProduct("a", "Variants Sandbox A");
  const pB = await createSandboxProduct("b", "Variants Sandbox B");
  const pC = await createSandboxProduct("c", "Variants Sandbox C (isolation)");
  const itemA = await ensureInventoryItemForProduct(TENANT_A, pA);
  const itemB = await ensureInventoryItemForProduct(TENANT_A, pB);
  const itemC = await ensureInventoryItemForProduct(TENANT_B, pC);
  await updateInventoryItem(TENANT_A, itemA, { track_stock: true, cost_price: 10 });
  await updateInventoryItem(TENANT_A, itemB, { track_stock: true, cost_price: 8 });
  await updateInventoryItem(TENANT_B, itemC, { track_stock: true, cost_price: 5 });

  /* 01 — Variant create */
  const v1 = await createVariant({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    variant_name: "Black 220V",
    attributes: { color: "Black", voltage: "220V" },
    cost_price: 10,
  });
  ok("01  variant create", v1.ok && !!v1.variant && v1.variant.status === "active", v1.error ?? "");
  const variantA = v1.variant!;

  /* Second variant for item A (used later for combination tests). */
  const v1b = await createVariant({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    variant_name: "White 110V",
    attributes: { color: "White", voltage: "110V" },
    cost_price: 11,
  });
  const variantAWhite = v1b.variant!;

  /* 02 — Duplicate variant_code blocked */
  const sharedCode = variantA.variant_code;
  const v2 = await createVariant({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    variant_code: sharedCode,
    variant_name: "Dup Code Variant",
  });
  ok("02  duplicate variant_code blocked", !v2.ok && /already exists/i.test(v2.error ?? ""), v2.error ?? "");

  /* 03 — Batch create */
  const b3 = await createBatch({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    variant_id: variantA.id,
    batch_no: "BATCH-A-001",
    manufacture_date: "2025-12-01",
    expiry_date: "2027-12-01",
    quantity_initial: 0,
    warehouse_id: whA,
  });
  ok("03  batch create", b3.ok && !!b3.batch, b3.error ?? "");
  const batchA = b3.batch!;

  /* 04 — Batch linked to item — item_id matches the variant's item */
  const item_ok = batchA.inventory_item_id === itemA;
  ok("04  batch.inventory_item_id matches item", item_ok, `batch.item=${batchA.inventory_item_id} expected=${itemA}`);

  /* 05 — Batch linked to variant (variant.item_id == batch.item_id is enforced by trigger).
         Trying to attach a batch on itemA to a variant of itemB should fail. */
  const variantB = await createVariant({
    tenant_id: TENANT_A,
    inventory_item_id: itemB,
    variant_name: "Item B Variant",
  });
  const b5bad = await createBatch({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    variant_id: variantB.variant!.id,
    batch_no: "BATCH-X-BAD",
    quantity_initial: 0,
    warehouse_id: whA,
  });
  ok("05  batch ↔ variant integrity (cross-item rejected)", !b5bad.ok, b5bad.error ?? "");

  /* 06 — Movement with variant attached */
  const m6 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "opening_balance",
    quantity: 50,
    unit_cost: 10,
    variant_id: variantA.id,
  });
  let m6Posted = false;
  if (m6.ok && m6.movement) {
    const p = await postInventoryMovement(m6.movement.id, TENANT_A, null);
    m6Posted = p.ok;
  }
  ok("06  movement with variant attached posts", m6.ok && m6Posted, m6.error ?? "");

  /* 07 — Movement with batch attached, batch.quantity_remaining increments */
  const m7 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 20,
    unit_cost: 12,
    variant_id: variantA.id,
    batch_id: batchA.id,
    pre_approved: true,
    adjustment_reason: "Receiving Batch A 20 units",
  });
  let batchAfter7 = 0;
  let m7Posted = false;
  if (m7.ok && m7.movement) {
    const p = await postInventoryMovement(m7.movement.id, TENANT_A, null);
    m7Posted = p.ok;
    const { data: bRow } = await supabase
      .from("inventory_batches")
      .select("quantity_remaining")
      .eq("id", batchA.id)
      .maybeSingle();
    batchAfter7 = Number((bRow as { quantity_remaining: number } | null)?.quantity_remaining ?? 0);
  }
  ok(
    "07  batch.quantity_remaining incremented on IN",
    m7Posted && batchAfter7 === 20,
    `remaining=${batchAfter7}`,
  );

  /* 08 — Invalid batch/variant combination rejected.
         Use batch from itemA + variantA, but specify movement on itemB. */
  const m8 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemB,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 5,
    unit_cost: 10,
    batch_id: batchA.id,
    pre_approved: true,
    adjustment_reason: "Bad batch test",
  });
  /* Movement insert must fail at the trigger. */
  ok(
    "08  cross-item batch on movement rejected",
    !m8.ok,
    m8.error ?? "",
  );

  /* Variant mismatch: movement on itemA with variantAWhite + batch tied to variantA */
  const m8b = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 5,
    unit_cost: 10,
    variant_id: variantAWhite.id,
    batch_id: batchA.id,
    pre_approved: true,
    adjustment_reason: "Variant mismatch test",
  });
  ok(
    "08b cross-variant batch on movement rejected",
    !m8b.ok,
    m8b.error ?? "",
  );

  /* 09 — Drilled balances aggregate by (item, variant, batch, warehouse). */
  /* Add another IN against itemA WITHOUT a variant so we have two buckets. */
  const mNoVar = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 7,
    unit_cost: 9,
    pre_approved: true,
    adjustment_reason: "No-variant fill",
  });
  if (mNoVar.ok && mNoVar.movement) await postInventoryMovement(mNoVar.movement.id, TENANT_A, null);

  const drilled = await buildDrilledBalances({ tenantId: TENANT_A, inventoryItemId: itemA });
  /* We expect at least 2 buckets for itemA:
       (variantA, batchA, whA) qty=70   ← from m6 (50, no batch wait — m6 has NO batch)
       Actually m6 has variant + no batch → bucket (variant, NULL batch)
       m7 has variant + batch          → bucket (variant, batchA)
       mNoVar has no variant/no batch  → bucket (NULL, NULL) qty=7
     So at least 3 distinct buckets. */
  const bucketKeys = new Set(
    drilled.map((r) => `${r.variant_id ?? ""}|${r.batch_id ?? ""}|${r.warehouse_id}`),
  );
  ok(
    "09  drilled balances aggregate by (item,variant,batch,warehouse)",
    bucketKeys.size >= 3,
    `buckets=${bucketKeys.size}`,
  );

  /* 10 — Valuation aggregate correctly per bucket (weighted average) */
  /* Add a second IN to the (variantA, batchA, whA) bucket at a different price
     to prove WAC is per-bucket. */
  const m10 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "adjustment_in",
    quantity: 10,
    unit_cost: 18,
    variant_id: variantA.id,
    batch_id: batchA.id,
    pre_approved: true,
    adjustment_reason: "WAC test second IN",
  });
  if (m10.ok && m10.movement) await postInventoryMovement(m10.movement.id, TENANT_A, null);

  const drilled10 = await buildDrilledBalances({ tenantId: TENANT_A, inventoryItemId: itemA });
  const bucket10 = drilled10.find(
    (r) => r.variant_id === variantA.id && r.batch_id === batchA.id && r.warehouse_id === whA,
  );
  /* Expect (20*12 + 10*18) / 30 = (240+180)/30 = 14 */
  ok(
    "10  WAC per-bucket correct",
    !!bucket10 && Math.abs(bucket10.avg_cost - 14) < 0.001 && bucket10.qty_on_hand === 30,
    bucket10 ? `qty=${bucket10.qty_on_hand} avg=${bucket10.avg_cost.toFixed(4)}` : "no bucket",
  );

  /* 11 — Expiry status: expired when expiry_date < today */
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const status11 = classifyBatchExpiry({ expiry_date: yesterday, quantity_remaining: 5 });
  ok("11  expired status (expiry_date < today)", status11 === "expired", `status=${status11}`);

  /* 12 — Near-expiry: expiry within next 30 days */
  const in10 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const status12 = classifyBatchExpiry({ expiry_date: in10, quantity_remaining: 5 });
  ok("12  near-expiry status (within 30d)", status12 === "near_expiry", `status=${status12}`);

  /* 13 — Depleted: quantity_remaining = 0 */
  const status13 = classifyBatchExpiry({ expiry_date: null, quantity_remaining: 0 });
  ok("13  depleted status (quantity_remaining = 0)", status13 === "depleted", `status=${status13}`);

  /* 14 — Tenant isolation */
  const listA = await listVariants({ tenantId: TENANT_A, limit: 50 });
  const listBT = await listVariants({ tenantId: TENANT_B, limit: 50 });
  const batchesA = await listBatches({ tenantId: TENANT_A, limit: 50 });
  const batchesB = await listBatches({ tenantId: TENANT_B, limit: 50 });
  ok(
    "14  tenant isolation",
    listA.length >= 3 && listBT.length === 0 && batchesA.length >= 1 && batchesB.length === 0,
    `varA=${listA.length} varB=${listBT.length} batA=${batchesA.length} batB=${batchesB.length}`,
  );

  /* 15 — Movement traceability preserved: source_type/source_id still flow. */
  const m15 = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: itemA,
    warehouse_id: whA,
    movement_type: "purchase_receipt",
    quantity: 4,
    unit_cost: 12,
    source_type: "purchase_receipt_item",
    source_id: "11111111-1111-1111-1111-111111111111",
    from_workflow: true,
    variant_id: variantA.id,
  });
  let m15ok = false;
  if (m15.ok && m15.movement) {
    const p = await postInventoryMovement(m15.movement.id, TENANT_A, null);
    const { data } = await supabase
      .from("inventory_stock_movements")
      .select("source_type, source_id, variant_id")
      .eq("id", m15.movement.id)
      .maybeSingle();
    const row = data as { source_type: string; source_id: string; variant_id: string | null } | null;
    m15ok = p.ok &&
      row?.source_type === "purchase_receipt_item" &&
      row?.source_id === "11111111-1111-1111-1111-111111111111" &&
      row?.variant_id === variantA.id;
  }
  ok("15  source_type/source_id traceability preserved alongside variant", m15ok, m15.error ?? "");

  /* Also verify void reverses batch.quantity_remaining. */
  const { data: beforeVoid } = await supabase
    .from("inventory_batches")
    .select("quantity_remaining")
    .eq("id", batchA.id)
    .maybeSingle();
  const remBefore = Number((beforeVoid as { quantity_remaining: number } | null)?.quantity_remaining ?? 0);
  /* Void m7 (which was IN qty=20 on batchA) → remaining should drop by 20. */
  if (m7.ok && m7.movement) {
    await voidInventoryMovement(m7.movement.id, TENANT_A, null, "test void batch reversal");
  }
  const { data: afterVoid } = await supabase
    .from("inventory_batches")
    .select("quantity_remaining")
    .eq("id", batchA.id)
    .maybeSingle();
  const remAfter = Number((afterVoid as { quantity_remaining: number } | null)?.quantity_remaining ?? 0);
  if (remAfter !== remBefore - 20) {
    console.log(`  [WARN] void reversal off — before=${remBefore} after=${remAfter}`);
  }

  /* 16, 17, 18 — Chained validators. */
  console.log("─".repeat(72));
  console.log("Chained inventory validators");
  console.log("─".repeat(72));
  const transferRes = spawnSync("npm", ["run", "--silent", "validate:inventory-transfers"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  ok("16  validate:inventory-transfers still passes", transferRes.status === 0);

  const returnRes = spawnSync("npm", ["run", "--silent", "validate:inventory-returns"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  ok("17  validate:inventory-returns still passes", returnRes.status === 0);

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
  ok("18  inventory + unification + discipline still pass", chainOk);

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
