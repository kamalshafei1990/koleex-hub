#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H5B — Internal-use inventory items validator.

     01 inventory_item_types has requires_product + usage_scope columns
     02 product-related type + no product → INV_H1_REQUIRE_PRODUCT
     03 internal-use type + no product → accepted
     04 machine-type item without product → rejected
     05 office_supply item without product → allowed
     06 exhibition_material / printed_material items without product → allowed
     07 custom internal-use type creation defaults requires_product=false
     08 custom product-related type creation honors requires_product=true
     09 list API returns usage_scope + requires_product
     10 movement (IN, opening_balance) against an internal-use item posts
     11 H1 guard still blocks product-related items without product (regression)
     12 chained validators (unification + discipline + transfers + returns +
        variants + serials + ux) still pass
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import {
  createInventoryMovement,
  postInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import { createInventoryItem, createItemType } from "../src/lib/inventory/items";
import { listInventoryItems } from "../src/lib/inventory/queries";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h5b] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT = "00000000-0000-4000-a000-00000000F5B1";

let passes = 0;
let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenant() {
  await supabase.from("tenants").upsert({
    id: TENANT, slug: `inv-h5b-${TENANT.slice(-4)}`,
    name: `INV-H5B Sandbox ${TENANT.slice(-4)}`, is_host: false, active: true,
  }, { onConflict: "id" });
}

async function clean() {
  await supabase.from("inventory_valuation").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_stock_balances").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_stock_movements").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_items").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_item_types").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_warehouses").delete().eq("tenant_id", TENANT);
}

async function getSysType(typeKey: string): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_item_types")
    .select("id")
    .eq("is_system", true)
    .eq("type_key", typeKey)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H5B — Internal-use inventory items validator");
  console.log("─".repeat(72));

  await ensureTenant();
  await clean();
  await ensureDefaultWarehouse(TENANT);

  /* 01 — schema columns. */
  const { data: cols, error: colErr } = await supabase
    .from("information_schema.columns" as never)
    .select("column_name");
  let colNames: string[] = [];
  if (!colErr && Array.isArray(cols)) {
    colNames = (cols as Array<{ column_name: string }>).map((c) => c.column_name);
  } else {
    /* Fall back via a probe SELECT */
    const probe = await supabase
      .from("inventory_item_types")
      .select("requires_product, usage_scope")
      .limit(1);
    colNames = probe.error ? [] : ["requires_product", "usage_scope"];
  }
  ok("01  inventory_item_types has requires_product + usage_scope",
     colNames.includes("requires_product") && colNames.includes("usage_scope"));

  /* 02 — product-related type, no product → rejected by DB guard. */
  const machineId = await getSysType("machine");
  const deniedProdRelated = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: TENANT,
      item_code: "BAD-PR-1",
      item_name: "Bad product-related without product",
      item_type_id: machineId,
      unit_of_measure: "pcs",
    });
  ok("02  product-related type + no product is rejected",
     !!deniedProdRelated.error &&
       (deniedProdRelated.error.message.includes("INV_H1_REQUIRE_PRODUCT") ||
        deniedProdRelated.error.message.includes("Create or link a Product")),
     deniedProdRelated.error?.message?.slice(0, 60) ?? "");

  /* 03 — internal-use type, no product → succeeds via DB. */
  const officeId = await getSysType("office_supply");
  const okOffice = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "A4 Paper Reams",
    item_type_id: officeId ?? undefined,
    unit_of_measure: "pcs",
  });
  ok("03  internal-use type + no product creates standalone item",
     okOffice.ok && !!okOffice.item, okOffice.error ?? "");

  /* 04 — machine-type item without product is rejected (via library path). */
  const machineFail = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "Sewing Machine without product",
    item_type_id: machineId ?? undefined,
    unit_of_measure: "pcs",
  });
  ok("04  machine-type item without product is rejected",
     !machineFail.ok &&
       !!machineFail.error &&
       (machineFail.error.includes("INV_H1_REQUIRE_PRODUCT") ||
        machineFail.error.includes("Create or link a Product")),
     (machineFail.error ?? "").slice(0, 60));

  /* 05 — office_supply allowed (also covered above; use a different name). */
  const okOffice2 = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "Sticky Notes",
    type_key: "office_supply",
    unit_of_measure: "pcs",
  });
  ok("05  office_supply-type item without product is allowed",
     okOffice2.ok && !!okOffice2.item, okOffice2.error ?? "");

  /* 06 — exhibition_material + printed_material without product allowed. */
  const okExhibition = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "Exhibition Banner Set",
    type_key: "exhibition_material",
    unit_of_measure: "pcs",
  });
  const okPrinted = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "Product Catalog 2026",
    type_key: "printed_material",
    unit_of_measure: "pcs",
  });
  ok("06  exhibition_material + printed_material items allowed (no product)",
     okExhibition.ok && okPrinted.ok,
     [okExhibition.error, okPrinted.error].filter(Boolean).join(" | "));

  /* 07 — custom internal-use type. */
  const customInternal = await createItemType({
    tenant_id: TENANT,
    type_name: `CEO Office Items ${Date.now()}`,
    usage_scope: "internal_use",
  });
  ok("07  custom type defaults internal-use → requires_product=false",
     customInternal.ok &&
       customInternal.type?.usage_scope === "internal_use" &&
       customInternal.type?.requires_product === false,
     customInternal.error ?? `usage_scope=${customInternal.type?.usage_scope} rp=${customInternal.type?.requires_product}`);

  /* 08 — custom product-related type. */
  const customProduct = await createItemType({
    tenant_id: TENANT,
    type_name: `Custom Component ${Date.now()}`,
    usage_scope: "product_related",
  });
  ok("08  custom product-related type honors requires_product=true",
     customProduct.ok &&
       customProduct.type?.usage_scope === "product_related" &&
       customProduct.type?.requires_product === true,
     customProduct.error ?? `usage_scope=${customProduct.type?.usage_scope} rp=${customProduct.type?.requires_product}`);

  /* 09 — listInventoryItems surfaces usage_scope + requires_product. */
  const items = await listInventoryItems({ tenantId: TENANT });
  const surfaceItem = items.find((it) => it.id === okOffice.item?.id);
  ok("09  list API returns usage_scope + requires_product",
     !!surfaceItem &&
       surfaceItem.usage_scope === "internal_use" &&
       surfaceItem.requires_product === false,
     `usage_scope=${surfaceItem?.usage_scope} rp=${surfaceItem?.requires_product}`);

  /* 10 — opening_balance IN against an internal-use item. */
  const wh = await ensureDefaultWarehouse(TENANT);
  const movement = await createInventoryMovement({
    tenant_id: TENANT,
    inventory_item_id: okOffice.item!.id,
    warehouse_id: wh,
    movement_type: "opening_balance",
    quantity: 100,
    unit_cost: 1,
    from_workflow: true,
  });
  const posted = movement.ok && movement.movement
    ? await postInventoryMovement(movement.movement.id, TENANT, null)
    : { ok: false };
  ok("10  IN movement against an internal-use item posts",
     movement.ok && posted.ok,
     movement.error ?? "");

  /* 11 — regression: H1 guard still blocks product-related items without product. */
  const spareId = await getSysType("spare_part");
  const stillBlocked = await supabase
    .from("inventory_items")
    .insert({
      tenant_id: TENANT,
      item_code: "REG-001",
      item_name: "Regression spare part",
      item_type_id: spareId,
      unit_of_measure: "pcs",
    });
  ok("11  regression: product-related types still rejected without product",
     !!stillBlocked.error &&
       (stillBlocked.error.message.includes("INV_H1_REQUIRE_PRODUCT") ||
        stillBlocked.error.message.includes("Create or link a Product")),
     stillBlocked.error?.message?.slice(0, 60) ?? "");

  /* 12 — chained validators. */
  const chained = [
    "validate:inventory-unification",
    "validate:inventory-discipline",
    "validate:inventory-transfers",
    "validate:inventory-returns",
    "validate:inventory-variants",
    "validate:inventory-serials",
    "validate:inventory-ux",
  ];
  let chainedPass = true;
  const chainedDetails: string[] = [];
  for (const script of chained) {
    try {
      execSync(`npm run -s ${script}`, {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          SUPABASE_URL: URL_ENV,
          NEXT_PUBLIC_SUPABASE_URL: URL_ENV,
          SUPABASE_SERVICE_ROLE_KEY: KEY,
        },
      });
      chainedDetails.push(`${script}=PASS`);
    } catch (e: unknown) {
      chainedPass = false;
      const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
      const tail = (err.stdout?.toString() ?? err.stderr?.toString() ?? err.message ?? "")
        .split("\n").slice(-5).join(" | ");
      chainedDetails.push(`${script}=FAIL (${tail.slice(0, 80)})`);
    }
  }
  ok("12  all prior inventory validators still pass",
     chainedPass, chainedDetails.join("; "));

  /* Final summary. */
  await clean();
  console.log("─".repeat(72));
  console.log(`Result: ${passes} pass · ${failures} fail`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("validator crashed:", e);
  process.exit(2);
});
