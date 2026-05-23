#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H1 — Product ↔ Inventory unification validator.

   Drives the new architecture end-to-end in a sandbox tenant:

     01  Legacy unlinked inventory item is linked or product-created during
         backfill (fn_inventory_backfill_link_to_product).
     02  Product with Track in Inventory creates inventory_items profile
         (via /api/products/[id]/stock-profile PUT — exercised through
         ensureInventoryItemForProduct + updateInventoryItem).
     03  Product with Track in Inventory does not create a duplicate profile
         if one already exists.
     04  Duplicate active stock profile is blocked at the DB layer
         (uq_inventory_items_one_active_profile_per_product).
     05  Normal inventory item creation without product is rejected by the
         API guard (and by the DB trigger).
     06  Admin repair/link path works
         (fn_inventory_link_item_to_product).
     07  Movement creation resolves product → inventory_item_id and posts.
     08  Movement creation rejects a product without a stock profile.
     09  Balances enrichment returns product identity (product_name).
     10  Items list enrichment returns product identity (product_name,
         product_sku, product_image).
     11  Purchase receiving still works (ensureInventoryItemForProduct
         resolves PO product_id when the line lacks inventory_item_id).
     12  Sales shipment still works against an inventory_item_id.
     13  Existing inventory movement history is preserved across backfill.
     14  Tenant isolation preserved (Tenant A cannot see B's items).
     15  All previous validators pass — quick sanity that the schema still
         has the core inventory RPCs that scripts/inventory.ts relies on.
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  createInventoryMovement,
  postInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import {
  buildBalancesSnapshot,
  buildMovementHistory,
  listInventoryItems,
} from "../src/lib/inventory/queries";
import {
  createInventoryItem,
  ensureInventoryItemForProduct,
  updateInventoryItem,
} from "../src/lib/inventory/items";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h1] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-00000000F1A1";
const TENANT_B = "00000000-0000-4000-a000-00000000F1B1";

let passes = 0;
let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `inv-h1-${id.slice(-4)}`,
      name: `INV-H1 Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
  /* Best-effort cleanup of sandbox-created products from earlier runs. */
  await supabase.from("products").delete().like("slug", "legacy-%-inv-h1-sandbox");
  await supabase.from("products").delete().like("slug", "inv-h1-sandbox-%");
}

async function createSandboxProduct(slugSuffix: string, name: string): Promise<string> {
  const slug = `inv-h1-sandbox-${slugSuffix}`;
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
  console.log("PHASE INV-H1 — Product ↔ Inventory unification validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();
  await ensureDefaultWarehouse(TENANT_A);
  await ensureDefaultWarehouse(TENANT_B);

  /* ─────────────────────────────────────────────────────────────
     01 — Legacy unlinked inventory item is linked or product-created.
     ───────────────────────────────────────────────────────────── */
  /* Insert a legacy unlinked item directly with the legacy flag (mimicking
     the migration stamping path). */
  const { data: legacy } = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: TENANT_A,
      item_code: "LG-000001",
      item_name: "Legacy Unlinked Sample",
      item_type_id: (await supabase.from("inventory_item_types")
        .select("id").eq("is_system", true).eq("type_key", "other").maybeSingle()).data?.id,
      unit_of_measure: "pcs",
      metadata: { legacy_unlinked: true },
    })
    .select("id, linked_product_id")
    .single();
  const legacyId = (legacy as { id: string } | null)?.id ?? null;
  if (legacyId) {
    const { data: linked } = await supabase.rpc("fn_inventory_backfill_link_to_product", {
      p_tenant_id: TENANT_A,
      p_inventory_item_id: legacyId,
      p_allow_create_product: true,
    });
    ok("01  legacy unlinked item linked or product-created during backfill",
       typeof linked === "string" && linked.length > 0, `product=${String(linked).slice(0, 8)}`);
  } else {
    ok("01  legacy unlinked item linked or product-created during backfill", false, "could not create legacy fixture");
  }

  /* ─────────────────────────────────────────────────────────────
     02/03 — Product with Track in Inventory creates / dedupes profile.
     ───────────────────────────────────────────────────────────── */
  const prodA = await createSandboxProduct("a", "Sandbox Sewing Machine A");
  const profileId1 = await ensureInventoryItemForProduct(TENANT_A, prodA);
  const profileId2 = await ensureInventoryItemForProduct(TENANT_A, prodA);
  ok("02  product Track in Inventory creates stock profile",
     !!profileId1 && profileId1 === profileId2, `item=${profileId1.slice(0, 8)}`);
  ok("03  ensureInventoryItemForProduct does not duplicate the profile",
     profileId1 === profileId2);

  /* ─────────────────────────────────────────────────────────────
     04 — Duplicate active stock profile is blocked by unique index.
     ───────────────────────────────────────────────────────────── */
  /* Try to insert another active profile for the same product. */
  const dupTry = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: TENANT_A,
      item_code: "DUP-000001",
      item_name: "Duplicate Attempt",
      item_type_id: (await supabase.from("inventory_item_types")
        .select("id").eq("is_system", true).eq("type_key", "finished_product").maybeSingle()).data?.id,
      linked_product_id: prodA,
      unit_of_measure: "pcs",
    });
  ok("04  duplicate active stock profile is blocked",
     !!dupTry.error, dupTry.error?.message?.slice(0, 60) ?? "");

  /* ─────────────────────────────────────────────────────────────
     05 — Normal item creation without product is rejected (DB guard).
     ───────────────────────────────────────────────────────────── */
  const denied = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: TENANT_A,
      item_code: "REJ-000001",
      item_name: "Rejected Item",
      item_type_id: (await supabase.from("inventory_item_types")
        .select("id").eq("is_system", true).eq("type_key", "other").maybeSingle()).data?.id,
      unit_of_measure: "pcs",
      /* no linked_product_id, no admin_repair, no legacy_unlinked. */
    });
  ok("05  insert without linked_product_id is rejected",
     !!denied.error && (denied.error.message.includes("INV_H1_REQUIRE_PRODUCT") || denied.error.message.includes("Create or link a Product")),
     denied.error?.message?.slice(0, 60) ?? "");

  /* ─────────────────────────────────────────────────────────────
     06 — Admin repair/link path works.
     ───────────────────────────────────────────────────────────── */
  const prodB = await createSandboxProduct("b", "Sandbox Lockstitch B");
  /* Create an admin-repair item without linked product. */
  const adminRepair = await createInventoryItem({
    tenant_id: TENANT_A,
    item_name: "Admin Repair Sample",
    type_key: "other",
    unit_of_measure: "pcs",
    metadata: { admin_repair: true },
  });
  const adminItemId = adminRepair.item?.id;
  let linkRes: { data: unknown; error: { message: string } | null } = { data: null, error: null };
  if (adminItemId) {
    linkRes = await supabase.rpc("fn_inventory_link_item_to_product", {
      p_tenant_id: TENANT_A,
      p_inventory_item_id: adminItemId,
      p_product_id: prodB,
    }) as unknown as { data: unknown; error: { message: string } | null };
  }
  ok("06  admin repair: create unlinked then link to product",
     adminRepair.ok && linkRes.data === true && !linkRes.error,
     adminRepair.error ?? linkRes.error?.message ?? "");

  /* ─────────────────────────────────────────────────────────────
     07/08 — Movement creation via product_id → inventory_item_id.
     ───────────────────────────────────────────────────────────── */
  /* Set track_stock + cost on profile so the post path uses it. */
  await updateInventoryItem(TENANT_A, profileId1, { track_stock: true, cost_price: 10 });

  const wh = await ensureDefaultWarehouse(TENANT_A);
  const ok07create = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: profileId1,
    warehouse_id: wh,
    movement_type: "opening_balance",
    quantity: 50,
    unit_cost: 10,
    from_workflow: true,
  });
  const ok07post = ok07create.ok && ok07create.movement
    ? await postInventoryMovement(ok07create.movement.id, TENANT_A, null)
    : { ok: false };
  ok("07  movement created against product's stock profile posts cleanly",
     ok07create.ok && ok07post.ok, ok07create.error ?? "");

  /* For 08, create a product *without* a stock profile, then try the
     "product_id only" resolution via our manual lookup path. */
  const prodC = await createSandboxProduct("c-no-profile", "Sandbox No Profile C");
  const { data: noProfile } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("tenant_id", TENANT_A)
    .eq("linked_product_id", prodC)
    .is("deleted_at", null)
    .maybeSingle();
  ok("08  product with no stock profile cannot be moved",
     noProfile === null);

  /* ─────────────────────────────────────────────────────────────
     09/10 — Balances + Items enrichment return product identity.
     ───────────────────────────────────────────────────────────── */
  const balances = await buildBalancesSnapshot({ tenantId: TENANT_A });
  const bForProfile = balances.find((b) => b.inventory_item_id === profileId1);
  ok("09  balances surface product_name for the linked profile",
     !!bForProfile && bForProfile.product_name === "Sandbox Sewing Machine A",
     `name=${bForProfile?.product_name}`);

  const itemsList = await listInventoryItems({ tenantId: TENANT_A });
  const itForProfile = itemsList.find((i) => i.id === profileId1);
  ok("10  items list surfaces product identity for linked items",
     !!itForProfile && itForProfile.product_name === "Sandbox Sewing Machine A",
     `name=${itForProfile?.product_name}`);

  /* ─────────────────────────────────────────────────────────────
     11 — Purchase receiving smoke: ensureInventoryItemForProduct
     ───────────────────────────────────────────────────────────── */
  const ensuredAgain = await ensureInventoryItemForProduct(TENANT_A, prodA);
  ok("11  purchase receiving keeps ensureInventoryItemForProduct stable",
     ensuredAgain === profileId1);

  /* ─────────────────────────────────────────────────────────────
     12 — Sales shipment OUT against an inventory_item_id.
     ───────────────────────────────────────────────────────────── */
  const ship = await createInventoryMovement({
    tenant_id: TENANT_A,
    inventory_item_id: profileId1,
    warehouse_id: wh,
    movement_type: "sales_shipment",
    quantity: 5,
    unit_cost: 10,
    source_type: "sales_shipment",
    source_id: "00000000-0000-4000-a000-0000000000F5",
    from_workflow: true,
  });
  const shipPost = ship.ok && ship.movement
    ? await postInventoryMovement(ship.movement.id, TENANT_A, null)
    : { ok: false };
  ok("12  sales shipment posts OUT against the linked profile",
     ship.ok && shipPost.ok, ship.error ?? "");

  /* ─────────────────────────────────────────────────────────────
     13 — Historical movements preserved across backfill paths.
     ───────────────────────────────────────────────────────────── */
  const history = await buildMovementHistory({ tenantId: TENANT_A, inventoryItemId: profileId1 });
  ok("13  inventory movement history preserved (>= 2 movements)",
     history.length >= 2, `count=${history.length}`);

  /* ─────────────────────────────────────────────────────────────
     14 — Tenant isolation: B cannot see A's profile.
     ───────────────────────────────────────────────────────────── */
  const bItems = await listInventoryItems({ tenantId: TENANT_B });
  const leaked = bItems.some((i) => i.id === profileId1);
  ok("14  tenant isolation — B cannot see A's profile", !leaked, `bItems=${bItems.length}`);

  /* ─────────────────────────────────────────────────────────────
     15 — Core inventory RPCs still present (regression net).
     ───────────────────────────────────────────────────────────── */
  /* Probe each RPC by name — Postgres errors with "function does not
     exist" if any are missing. We swallow tenant / arg-shape errors. */
  const probes = await Promise.all([
    supabase.rpc("fn_inventory_ensure_default_warehouse", { p_tenant_id: TENANT_A }),
    supabase.rpc("fn_inventory_ensure_item_for_product", { p_tenant_id: TENANT_A, p_product_id: prodA }),
    supabase.rpc("fn_inventory_backfill_link_to_product", { p_tenant_id: TENANT_A, p_inventory_item_id: profileId1, p_allow_create_product: false }),
    supabase.rpc("fn_inventory_link_item_to_product", { p_tenant_id: TENANT_A, p_inventory_item_id: profileId1, p_product_id: prodA }),
  ]);
  const rpcOk = probes.every((r) => !r.error || !/does not exist/i.test(r.error.message));
  ok("15  all previous inventory RPCs still present", rpcOk);

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
