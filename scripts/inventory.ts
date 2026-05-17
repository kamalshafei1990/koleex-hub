#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.2 — Inventory Movement Core validator.

   Coverage (13 assertions):
     01  Default warehouse seeder is idempotent
     02  Creating a custom (non-default) warehouse succeeds
     03  createInventoryMovement(draft) inserts a draft row
     04  Post IN increases stock (on-hand goes 0 → 100)
     05  Post OUT decreases stock (on-hand goes 100 → 60)
     06  Negative stock rejected: OUT > on_hand returns ok=false / code 422
     07  Posted movement immutable: UPDATE on operational columns rejected
     08  Double post is a no-op (idempotent — returns already_posted)
     09  voidInventoryMovement creates reversing entry and updates balance
     10  Tenant isolation: A cannot read B's movements
     11  Source idempotency: two creates with same (source_type, source_id)
         do NOT produce two non-voided movements
     12  getStockBalance returns live (product, warehouse) row
     13  rebuildStockBalance reconciles to the movement history
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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
} from "../src/lib/inventory/queries";

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
      id,
      slug: `phase-o2-${id.slice(-4)}`,
      name: `Phase-O2 Sandbox ${id.slice(-4)}`,
      is_host: false,
      active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function pickAnyProductId(): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) throw new Error("No product available to test");
  return (data[0] as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase O.2 — Inventory Movement Core validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const productId = await pickAnyProductId();

  /* 01 — Default warehouse idempotent. */
  const wh1 = await ensureDefaultWarehouse(TENANT_A);
  const wh1again = await ensureDefaultWarehouse(TENANT_A);
  ok("01  default warehouse seeder idempotent", wh1 === wh1again, `wh=${wh1.slice(0, 8)}`);

  /* 02 — Create custom warehouse. */
  const custom = await supabase
    .from("inventory_warehouses")
    .insert({ tenant_id: TENANT_A, code: "WH-OVERFLOW", name: "Overflow", is_default: false })
    .select("id")
    .single();
  ok(
    "02  custom warehouse created",
    !custom.error && !!custom.data,
    custom.error?.message ?? `id=${(custom.data as { id: string } | null)?.id?.slice(0, 8) ?? "?"}`,
  );

  /* 03 — Create draft. */
  const draft = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "opening_balance",
    quantity: 100,
    notes: "Phase O.2 test seed",
  });
  ok("03  createInventoryMovement inserts draft", !!(draft.ok && draft.movement && draft.movement.status === "draft"));

  /* 04 — Post IN increases stock. */
  const post1 = await postInventoryMovement(draft.movement!.id, TENANT_A, null);
  const bal0 = await getStockBalance(TENANT_A, productId, wh1);
  ok(
    "04  post IN increases stock to 100",
    post1.ok && bal0.qty_on_hand === 100,
    `on_hand=${bal0.qty_on_hand}`,
  );

  /* 05 — Post OUT decreases stock. */
  const outDraft = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "sales_shipment",
    quantity: 40,
  });
  const outPost = await postInventoryMovement(outDraft.movement!.id, TENANT_A, null);
  const bal1 = await getStockBalance(TENANT_A, productId, wh1);
  ok(
    "05  post OUT decreases stock 100 → 60",
    outPost.ok && bal1.qty_on_hand === 60,
    `on_hand=${bal1.qty_on_hand}`,
  );

  /* 06 — Negative stock rejected. */
  const overdraw = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "adjustment_out",
    quantity: 500,                 // > 60 on hand
  });
  const overdrawPost = await postInventoryMovement(overdraw.movement!.id, TENANT_A, null);
  ok(
    "06  negative stock rejected (code=422)",
    !overdrawPost.ok && overdrawPost.code === 422,
    overdrawPost.error ?? "",
  );

  /* 07 — Posted movement immutable. */
  const updTry = await supabase
    .from("inventory_stock_movements")
    .update({ quantity: 999 })
    .eq("id", draft.movement!.id);
  ok(
    "07  posted movement immutable (UPDATE on quantity rejected)",
    !!updTry.error,
    updTry.error?.message ? updTry.error.message.slice(0, 60) : "",
  );

  /* 08 — Double post is a no-op (idempotent). */
  const post2 = await postInventoryMovement(draft.movement!.id, TENANT_A, null);
  const bal2 = await getStockBalance(TENANT_A, productId, wh1);
  ok(
    "08  double post idempotent — balance unchanged",
    post2.ok === true && post2.already_posted === true && bal2.qty_on_hand === 60,
    `on_hand=${bal2.qty_on_hand}`,
  );

  /* 09 — Void produces a reversing entry that updates balance. */
  const voided = await voidInventoryMovement(draft.movement!.id, TENANT_A, null, "test reversal");
  /* original was +100; reverse subtracts 100 from 60 → would go -40.
     The reverse fires through fn_inventory_post_movement which rejects
     negatives, so the void RAISES. We're testing the happy path: void
     the OUT shipment instead (40 was deducted; reverse adds 40 → 100). */
  const voidedOut = await voidInventoryMovement(outDraft.movement!.id, TENANT_A, null, "test reversal");
  const bal3 = await getStockBalance(TENANT_A, productId, wh1);
  ok(
    "09  void posts reversing entry and adjusts balance",
    !voided.ok && voidedOut.ok && !!voidedOut.reverse_movement_id && bal3.qty_on_hand === 100,
    `on_hand=${bal3.qty_on_hand} void-of-in=${voided.ok ? "ok" : "rejected"} void-of-out=${voidedOut.ok ? "ok" : "rejected"}`,
  );

  /* 10 — Tenant isolation. Seed a movement in B, ensure A can't see it. */
  const whB = await ensureDefaultWarehouse(TENANT_B);
  const bDraft = await createInventoryMovement({
    tenant_id: TENANT_B,
    product_id: productId,
    warehouse_id: whB,
    movement_type: "opening_balance",
    quantity: 7,
  });
  await postInventoryMovement(bDraft.movement!.id, TENANT_B, null);
  const aSees = await buildMovementHistory({ tenantId: TENANT_A });
  const aId = TENANT_A.toLowerCase();
  const bLeaked = aSees.some((m) => m.tenant_id.toLowerCase() !== aId);
  ok("10  tenant isolation — A cannot see B's movements", !bLeaked, `rows=${aSees.length}`);

  /* 11 — Source idempotency. */
  const sourceId = randomUUID();
  const s1 = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "purchase_receipt",
    quantity: 12,
    source_type: "purchase_receipt",
    source_id: sourceId,
  });
  const s2 = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "purchase_receipt",
    quantity: 12,
    source_type: "purchase_receipt",
    source_id: sourceId,
  });
  ok(
    "11  source idempotency — two creates with same source return same row",
    !!(s1.ok && s2.ok && s1.movement && s2.movement && s1.movement.id === s2.movement.id),
  );

  /* 12 — getStockBalance returns live row. */
  await postInventoryMovement(s1.movement!.id, TENANT_A, null);          // post the +12
  const singleBal = await getStockBalance(TENANT_A, productId, wh1);
  ok(
    "12  getStockBalance returns live (product, warehouse) row",
    singleBal.exists && singleBal.qty_on_hand === 112,
    `on_hand=${singleBal.qty_on_hand}`,
  );

  /* 13 — rebuildStockBalance reconciles to the movement history.
     Voided rows had their original delta applied at posting time;
     the matching reverse (status='posted') undoes them. So the
     rebuild sums over BOTH posted and voided rows — together they
     equal the live balance. */
  const rebuild = await rebuildStockBalance(TENANT_A, productId, wh1);
  const after = await getStockBalance(TENANT_A, productId, wh1);
  const history = await buildMovementHistory({ tenantId: TENANT_A, productId });
  const expected = history
    .filter((m) => m.status !== "draft" && m.warehouse_id === wh1)
    .reduce((acc, m) => acc + (m.direction === "in" ? m.quantity : -m.quantity), 0);
  ok(
    "13  rebuildStockBalance matches movement history",
    rebuild.ok &&
      Math.abs(rebuild.qty_on_hand - expected) < 0.0001 &&
      Math.abs(after.qty_on_hand - expected) < 0.0001,
    `rebuilt=${rebuild.qty_on_hand} stored=${after.qty_on_hand} expected=${expected}`,
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
