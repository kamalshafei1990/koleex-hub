#!/usr/bin/env tsx

/* ===========================================================================
   Phase O.2 — Inventory Movement Core validator.

   Coverage (10 assertions):
     01  Default warehouse seeder is idempotent — second call returns same id
     02  createInventoryMovement(draft) inserts a draft row with auto-#
     03  postInventoryMovement promotes draft → posted and updates balance
     04  Negative stock is rejected: OUT > on_hand returns ok=false / code 422
     05  Posted movement is immutable: UPDATE on operational columns rejected
     06  Re-posting a posted movement is idempotent (returns already_posted)
     07  voidInventoryMovement creates reversing entry and zeroes the balance
     08  Tenant isolation: A cannot read B's movements (filter must always
         include tenant_id — we assert no leak across tenant queries)
     09  Source idempotency: two creates with same (source_type, source_id)
         do NOT produce two non-voided movements
     10  Balance rebuild from movement history matches stored balance
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import { buildBalancesSnapshot, buildMovementHistory } from "../src/lib/inventory/queries";

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
  const wh2 = await ensureDefaultWarehouse(TENANT_A);
  ok("01  default warehouse seeder idempotent", wh1 === wh2, `wh=${wh1.slice(0, 8)}`);

  /* 02 — Create draft. */
  const draft = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "opening_balance",
    quantity: 100,
    notes: "Phase O.2 test seed",
  });
  ok("02  createInventoryMovement inserts draft", !!(draft.ok && draft.movement && draft.movement.status === "draft"));

  /* 03 — Post draft, balance updates to 100. */
  const post1 = await postInventoryMovement(draft.movement!.id, TENANT_A, null);
  const balsAfterIn = await buildBalancesSnapshot({ tenantId: TENANT_A, productId });
  const onHand1 = balsAfterIn[0]?.qty_on_hand ?? 0;
  ok(
    "03  postInventoryMovement promotes draft → posted (on-hand=100)",
    post1.ok && onHand1 === 100,
    `on_hand=${onHand1}`,
  );

  /* 04 — Negative stock rejected. */
  const overdraw = await createInventoryMovement({
    tenant_id: TENANT_A,
    product_id: productId,
    warehouse_id: wh1,
    movement_type: "adjustment_out",
    quantity: 500,                 // > 100 on hand
  });
  const overdrawPost = await postInventoryMovement(overdraw.movement!.id, TENANT_A, null);
  ok(
    "04  negative stock rejected (code=422)",
    !overdrawPost.ok && overdrawPost.code === 422,
    overdrawPost.error ?? "",
  );

  /* 05 — Posted movement immutable. */
  const updTry = await supabase
    .from("inventory_stock_movements")
    .update({ quantity: 999 })
    .eq("id", draft.movement!.id);
  ok(
    "05  posted movement immutable (UPDATE on quantity rejected)",
    !!updTry.error,
    updTry.error?.message ? updTry.error.message.slice(0, 60) : "",
  );

  /* 06 — Idempotent post. */
  const post2 = await postInventoryMovement(draft.movement!.id, TENANT_A, null);
  ok(
    "06  re-posting posted movement is idempotent",
    post2.ok === true && post2.already_posted === true,
  );

  /* 07 — Void produces a reversing entry that zeroes the balance. */
  const voided = await voidInventoryMovement(draft.movement!.id, TENANT_A, null, "test reversal");
  const balsAfterVoid = await buildBalancesSnapshot({ tenantId: TENANT_A, productId });
  const onHandAfterVoid = balsAfterVoid[0]?.qty_on_hand ?? -1;
  ok(
    "07  void posts reversing entry, balance returns to 0",
    voided.ok && !!voided.reverse_movement_id && onHandAfterVoid === 0,
    `on_hand=${onHandAfterVoid}`,
  );

  /* 08 — Tenant isolation. Seed a movement in B, ensure A can't see it. */
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
  /* UUIDs come back lowercase from Postgres; compare case-insensitively. */
  const aId = TENANT_A.toLowerCase();
  const bLeaked = aSees.some((m) => m.tenant_id.toLowerCase() !== aId);
  ok("08  tenant isolation — A cannot see B's movements", !bLeaked, `rows=${aSees.length}`);

  /* 09 — Source idempotency. */
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
    "09  source idempotency — two creates with same source return same row",
    !!(s1.ok && s2.ok && s1.movement && s2.movement && s1.movement.id === s2.movement.id),
  );

  /* 10 — Balance rebuild matches stored balance.
     Voided rows had their original delta applied at posting time;
     the matching reverse (status='posted') undoes them. So the
     rebuild sums over BOTH posted and voided rows — together they
     equal the live balance. Drafts are skipped. */
  await postInventoryMovement(s1.movement!.id, TENANT_A, null);     // post the +12
  const history = await buildMovementHistory({ tenantId: TENANT_A, productId });
  const rebuilt = history
    .filter((m) => m.status !== "draft")
    .reduce((acc, m) => {
      const q = Number(m.quantity) || 0;
      return acc + (m.direction === "in" ? q : -q);
    }, 0);
  const stored = await buildBalancesSnapshot({ tenantId: TENANT_A, productId });
  const storedQty = stored[0]?.qty_on_hand ?? 0;
  ok(
    "10  balance rebuild from history matches stored balance",
    Math.abs(rebuilt - storedQty) < 0.0001,
    `rebuilt=${rebuilt}  stored=${storedQty}`,
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
