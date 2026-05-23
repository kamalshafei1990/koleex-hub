#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H3B — Customer & Supplier Returns validator (17 assertions).

     01  Customer return draft create
     02  Supplier return draft create
     03  Submit (draft → pending) — both flows
     04  Approve (pending → approved) — both flows
     05  Customer receive creates `return_in` movement
     06  Supplier ship creates `return_out` movement
     07  Restock disposition increases sellable stock at chosen warehouse
     08  Scrap disposition does NOT increase sellable stock (lands in SCRAP)
     09  QUARANTINE warehouse auto-created when first quarantine return processed
     10  Negative stock on supplier ship is forbidden
     11  Movement traceability: movement → return resolves; return → movements resolves
     12  Source document linkage stored (source_document_type / source_document_id)
     13  Audit rows created for submit/approve/receive/ship/complete/cancel/void
     14  Void preserves audit trail; stock changes reversed correctly
     15  Tenant isolation (tenant A's returns invisible to tenant B)
     16  Humanized errors (no raw Postgres codes leaked)
     17  Chained validators still pass (inventory + unification + discipline + transfers)
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
  createReturn,
  transitionReturn,
  receiveReturn,
  shipReturn,
  voidReturn,
  getReturnDetail,
  listReturns,
  resolveReturnLinkForMovement,
} from "../src/lib/inventory/returns";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h3b] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_A = "00000000-0000-4000-a000-00000000F3C1";
const TENANT_B = "00000000-0000-4000-a000-00000000F3D1";

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
          slug: `inv-h3b-${id.slice(-4)}`,
          name: `INV-H3B Sandbox ${id.slice(-4)}`,
          is_host: false,
          active: true,
        },
        { onConflict: "id" },
      );
  }
}

async function ensureContact(tenantId: string, entityType: "customer" | "supplier", suffix: string): Promise<string> {
  /* Use contacts table directly; contact_type='customer'/'supplier'. */
  const slug = `inv-h3b-${entityType}-${tenantId.slice(-4)}-${suffix}`;
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_type", entityType)
    .eq("display_name", slug)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      contact_type: entityType,
      entity_type: "company",
      display_name: slug,
      company_name: `${slug} Co.`,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "contact insert failed");
  return (data as { id: string }).id;
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_return_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_return_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_returns").delete().eq("tenant_id", t);
    await supabase.from("inventory_audit_log").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
    await supabase.from("contacts").delete().eq("tenant_id", t).like("display_name", "inv-h3b-%");
  }
  await supabase.from("products").delete().like("slug", "inv-h3b-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h3b-sandbox-${slugSuffix}`;
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

async function findSpecialWarehouse(tenantId: string, code: string): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? (data as { id: string }).id : null;
}

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H3B — Returns workflow validator (17 assertions)");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const whA = await ensureDefaultWarehouse(TENANT_A);
  await ensureDefaultWarehouse(TENANT_B);

  const customerId = await ensureContact(TENANT_A, "customer", "1");
  const supplierId = await ensureContact(TENANT_A, "supplier", "1");

  const pA = await createSandboxProduct("a", "Returns Sandbox A");
  const pB = await createSandboxProduct("b", "Returns Sandbox B");
  const pC = await createSandboxProduct("c", "Returns Sandbox C");
  const pD = await createSandboxProduct("d", "Returns Sandbox D");
  const itemA = await ensureInventoryItemForProduct(TENANT_A, pA);
  const itemB = await ensureInventoryItemForProduct(TENANT_A, pB);
  const itemC = await ensureInventoryItemForProduct(TENANT_A, pC);
  const itemD = await ensureInventoryItemForProduct(TENANT_A, pD);
  await updateInventoryItem(TENANT_A, itemA, { track_stock: true, cost_price: 10 });
  await updateInventoryItem(TENANT_A, itemB, { track_stock: true, cost_price: 10 });
  await updateInventoryItem(TENANT_A, itemC, { track_stock: true, cost_price: 5 });
  await updateInventoryItem(TENANT_A, itemD, { track_stock: true, cost_price: 8 });

  /* Pre-load stock for supplier-return flows + item-B for cancellation tests. */
  await openingStock(TENANT_A, itemB, whA, 50, 10);
  await openingStock(TENANT_A, itemD, whA, 20, 8);

  /* 01 — Customer return draft create */
  const c1 = await createReturn({
    tenant_id: TENANT_A,
    return_type: "customer_return",
    customer_id: customerId,
    warehouse_id: whA,
    reason_code: "damaged",
    source_document_type: "sales_shipment",
    source_document_id: "11111111-1111-1111-1111-111111111111",
    items: [
      { inventory_item_id: itemA, quantity: 6, unit_of_measure: "pcs", condition_status: "good", disposition: "restock" },
      { inventory_item_id: itemB, quantity: 4, unit_of_measure: "pcs", condition_status: "damaged", disposition: "scrap" },
    ],
  });
  ok("01  customer return draft create", c1.ok && !!c1.return_ && c1.return_.status === "draft", c1.error ?? "");
  const ret1 = c1.return_!;

  /* 02 — Supplier return draft create */
  const c2 = await createReturn({
    tenant_id: TENANT_A,
    return_type: "supplier_return",
    supplier_id: supplierId,
    warehouse_id: whA,
    reason_code: "defective",
    items: [
      { inventory_item_id: itemD, quantity: 3, unit_of_measure: "pcs", condition_status: "defective", disposition: "vendor_return" },
    ],
  });
  ok("02  supplier return draft create", c2.ok && !!c2.return_ && c2.return_.status === "draft", c2.error ?? "");
  const ret2 = c2.return_!;

  /* 03 — Submit (both flows) */
  const s3a = await transitionReturn(TENANT_A, ret1.id, "pending", null);
  const s3b = await transitionReturn(TENANT_A, ret2.id, "pending", null);
  ok(
    "03  submit (draft → pending) — both flows",
    s3a.ok && s3a.return_?.status === "pending" && s3b.ok && s3b.return_?.status === "pending",
    `cust=${s3a.error ?? ""} supp=${s3b.error ?? ""}`,
  );

  /* 04 — Approve (both flows) */
  const s4a = await transitionReturn(TENANT_A, ret1.id, "approved", null);
  const s4b = await transitionReturn(TENANT_A, ret2.id, "approved", null);
  ok(
    "04  approve (pending → approved) — both flows",
    s4a.ok && s4a.return_?.status === "approved" && s4b.ok && s4b.return_?.status === "approved",
    `cust=${s4a.error ?? ""} supp=${s4b.error ?? ""}`,
  );

  /* 05 — Customer receive creates return_in movement */
  const stockBeforeRestock = await qtyAt(TENANT_A, itemA, whA);
  const r5 = await receiveReturn(TENANT_A, ret1.id, null);
  const det5 = await getReturnDetail(TENANT_A, ret1.id);
  const inMovementsCount = det5?.bridges.length ?? 0;
  /* Inspect the movement types via direct query. */
  const { data: mv5Rows } = await supabase
    .from("inventory_stock_movements")
    .select("movement_type, direction")
    .in("id", (det5?.bridges ?? []).map((b) => b.movement_id));
  const allIn = (mv5Rows ?? []).every((m) => (m as { movement_type: string; direction: string }).movement_type === "return_in" && (m as { direction: string }).direction === "in");
  ok(
    "05  customer receive creates return_in",
    r5.ok && det5?.return_.status === "received" && inMovementsCount === 2 && allIn,
    `inCount=${inMovementsCount} allIn=${allIn} err=${r5.error ?? ""}`,
  );

  /* 06 — Supplier ship creates return_out movement */
  const stockBeforeShip = await qtyAt(TENANT_A, itemD, whA);
  const r6 = await shipReturn(TENANT_A, ret2.id, null);
  const det6 = await getReturnDetail(TENANT_A, ret2.id);
  const outCount = det6?.bridges.length ?? 0;
  const { data: mv6Rows } = await supabase
    .from("inventory_stock_movements")
    .select("movement_type, direction")
    .in("id", (det6?.bridges ?? []).map((b) => b.movement_id));
  const allOut = (mv6Rows ?? []).every((m) => (m as { movement_type: string; direction: string }).movement_type === "return_out" && (m as { direction: string }).direction === "out");
  ok(
    "06  supplier ship creates return_out",
    r6.ok && det6?.return_.status === "shipped" && outCount === 1 && allOut,
    `outCount=${outCount} allOut=${allOut} err=${r6.error ?? ""}`,
  );

  /* 07 — Restock disposition increases sellable stock at chosen warehouse */
  const stockAfterRestock = await qtyAt(TENANT_A, itemA, whA);
  ok(
    "07  restock disposition increases stock",
    stockAfterRestock === stockBeforeRestock + 6,
    `before=${stockBeforeRestock} after=${stockAfterRestock}`,
  );

  /* 08 — Scrap disposition does NOT increase sellable stock (lands in SCRAP) */
  const scrapWh = await findSpecialWarehouse(TENANT_A, "SCRAP");
  const stockAtScrap = scrapWh ? await qtyAt(TENANT_A, itemB, scrapWh) : 0;
  const stockAtMain = await qtyAt(TENANT_A, itemB, whA); /* itemB started at 50, scrap line was 4 to SCRAP */
  ok(
    "08  scrap disposition lands in SCRAP, not main warehouse",
    !!scrapWh && stockAtScrap === 4 && stockAtMain === 50,
    `scrapWh=${!!scrapWh} qtyScrap=${stockAtScrap} qtyMain=${stockAtMain}`,
  );

  /* 09 — QUARANTINE warehouse auto-created when first quarantine return processed */
  const cQ = await createReturn({
    tenant_id: TENANT_A,
    return_type: "customer_return",
    customer_id: customerId,
    warehouse_id: whA,
    reason_code: "defective",
    items: [
      { inventory_item_id: itemC, quantity: 2, unit_of_measure: "pcs", condition_status: "defective", disposition: "quarantine" },
    ],
  });
  let qOk = false;
  if (cQ.ok && cQ.return_) {
    await transitionReturn(TENANT_A, cQ.return_.id, "pending", null);
    await transitionReturn(TENANT_A, cQ.return_.id, "approved", null);
    const rQ = await receiveReturn(TENANT_A, cQ.return_.id, null);
    const qWh = await findSpecialWarehouse(TENANT_A, "QUARANTINE");
    const qty = qWh ? await qtyAt(TENANT_A, itemC, qWh) : 0;
    qOk = rQ.ok && !!qWh && qty === 2;
  }
  ok("09  QUARANTINE warehouse auto-created", qOk);

  /* 10 — Negative stock on supplier ship is forbidden */
  const cNeg = await createReturn({
    tenant_id: TENANT_A,
    return_type: "supplier_return",
    supplier_id: supplierId,
    warehouse_id: whA,
    reason_code: "supplier_error",
    items: [
      /* itemA has 0 at whA — we never opening-balanced it. */
      { inventory_item_id: itemA, quantity: 100, unit_of_measure: "pcs", condition_status: "defective", disposition: "vendor_return" },
    ],
  });
  let negOk = false;
  if (cNeg.ok && cNeg.return_) {
    await transitionReturn(TENANT_A, cNeg.return_.id, "pending", null);
    await transitionReturn(TENANT_A, cNeg.return_.id, "approved", null);
    const sNeg = await shipReturn(TENANT_A, cNeg.return_.id, null);
    const detNeg = await getReturnDetail(TENANT_A, cNeg.return_.id);
    /* Inspect: no movements should exist for this return. */
    negOk = !sNeg.ok && detNeg?.return_.status === "approved" && (detNeg?.bridges.length ?? 0) === 0;
  }
  ok("10  negative stock on supplier ship is forbidden", negOk);

  /* 11 — Movement traceability: movement → return + return → movements */
  const sampleMovementId = det5?.bridges[0]?.movement_id;
  let traceOk = false;
  if (sampleMovementId) {
    const link = await resolveReturnLinkForMovement(TENANT_A, sampleMovementId);
    traceOk = !!link && link.return_id === ret1.id && link.return_no === ret1.return_no;
  }
  /* Return → movements: getReturnDetail should already include bridge rows. */
  const det11 = await getReturnDetail(TENANT_A, ret1.id);
  const reverseTrace = (det11?.bridges.length ?? 0) > 0;
  ok("11  movement → return + return → movements", traceOk && reverseTrace);

  /* 12 — Source document linkage stored */
  const det12 = await getReturnDetail(TENANT_A, ret1.id);
  ok(
    "12  source document linkage stored",
    det12?.return_.source_document_type === "sales_shipment" &&
      det12?.return_.source_document_id === "11111111-1111-1111-1111-111111111111",
    `type=${det12?.return_.source_document_type} id=${det12?.return_.source_document_id}`,
  );

  /* 13 — Audit rows created for submit/approve/receive/ship/complete/cancel/void */
  /* Complete ret1 (customer received → completed). Cancel a fresh draft. */
  const compR1 = await transitionReturn(TENANT_A, ret1.id, "completed", null);
  const cancelDraft = await createReturn({
    tenant_id: TENANT_A,
    return_type: "customer_return",
    customer_id: customerId,
    warehouse_id: whA,
    reason_code: "other",
    items: [
      { inventory_item_id: itemA, quantity: 1, unit_of_measure: "pcs", condition_status: "good", disposition: "restock" },
    ],
  });
  if (cancelDraft.ok && cancelDraft.return_) {
    await transitionReturn(TENANT_A, cancelDraft.return_.id, "cancelled", null);
  }

  const { data: auditRows } = await supabase
    .from("inventory_audit_log")
    .select("action")
    .eq("tenant_id", TENANT_A)
    .eq("entity_type", "return");
  const actions = new Set((auditRows ?? []).map((a) => (a as { action: string }).action));
  const required = [
    "return_submitted", "return_approved", "return_received",
    "return_shipped", "return_completed", "return_cancelled",
  ];
  const missing = required.filter((a) => !actions.has(a));
  ok(
    "13  audit rows created for major actions",
    compR1.ok && missing.length === 0,
    missing.length > 0 ? `missing=${missing.join(",")}` : "",
  );

  /* 14 — Void preserves audit + reverses stock correctly */
  const stockBeforeVoid = await qtyAt(TENANT_A, itemA, whA);
  const v14 = await voidReturn(TENANT_A, ret1.id, null, "test void rollback");
  const det14 = await getReturnDetail(TENANT_A, ret1.id);
  const stockAfterVoid = await qtyAt(TENANT_A, itemA, whA);
  /* ret1 had a restock line for itemA of qty 6. Void should remove that. */
  const { data: voidAudit } = await supabase
    .from("inventory_audit_log")
    .select("id")
    .eq("tenant_id", TENANT_A)
    .eq("entity_type", "return")
    .eq("entity_id", ret1.id)
    .eq("action", "return_voided");
  ok(
    "14  void preserves audit + reverses stock",
    v14.ok &&
      det14?.return_.status === "voided" &&
      stockAfterVoid === stockBeforeVoid - 6 &&
      (voidAudit?.length ?? 0) > 0,
    `before=${stockBeforeVoid} after=${stockAfterVoid} status=${det14?.return_.status}`,
  );

  /* 15 — Tenant isolation */
  const listA = await listReturns({ tenantId: TENANT_A, limit: 50 });
  const listB = await listReturns({ tenantId: TENANT_B, limit: 50 });
  ok(
    "15  tenant isolation",
    listA.length >= 4 && listB.length === 0,
    `A=${listA.length} B=${listB.length}`,
  );

  /* 16 — Humanized errors (no raw PG codes in user-facing responses) */
  const cBad = await createReturn({
    tenant_id: TENANT_A,
    return_type: "customer_return",
    /* No customer_id -> CHECK constraint kicks in if engine didn't pre-validate. */
    customer_id: null,
    warehouse_id: whA,
    reason_code: "other",
    items: [
      { inventory_item_id: itemA, quantity: 1, unit_of_measure: "pcs", condition_status: "good", disposition: "restock" },
    ],
  });
  const humanOk =
    !cBad.ok &&
    typeof cBad.error === "string" &&
    !/22P\d{2}|^P\d{4}|violates check constraint/i.test(cBad.error);
  ok("16  humanized errors (no raw PG codes)", humanOk, cBad.error ?? "");

  /* 17 — Chained validators still pass */
  console.log("─".repeat(72));
  console.log("17  Chained inventory validators");
  console.log("─".repeat(72));
  const chains = [
    "validate:inventory",
    "validate:inventory-unification",
    "validate:inventory-discipline",
    "validate:inventory-transfers",
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
  ok("17  existing inventory validators still pass", chainOk);

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
