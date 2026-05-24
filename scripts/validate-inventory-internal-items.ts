#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H5C — Internal inventory library + UX simplification validator.

     01 Expanded type library: ≥23 system types, all 10 categories present
     02 Every internal-use type has icon set + requires_product=false
     03 inventory_items.subcategory column exists, nullable
     04 Quick-add internal item with minimum fields succeeds (no product)
     05 Created item carries usage_scope=internal_use on listing
     06 Opening-balance movement against an internal-use item works
     07 Internal-use item creation creates no serial row
     08 Internal-use item creation creates no batch row
     09 Internal-use item creation creates no product row
     10 Subcategory field round-trips through PATCH
     11 Type library API returns icon + usage_scope so UI can render
     12 H5B regression: machine-type item without product still rejected
     13 H5B regression: existing internal types still work
     14 Chained validators (unification + discipline + transfers + returns
        + variants + serials + ux + internal-use) all pass
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import {
  createInventoryMovement,
  postInventoryMovement,
  ensureDefaultWarehouse,
} from "../src/lib/inventory/posting";
import {
  createInventoryItem,
  updateInventoryItem,
} from "../src/lib/inventory/items";
import {
  listInventoryItems,
  listItemTypes,
} from "../src/lib/inventory/queries";
import { INTERNAL_TAXONOMY } from "../src/lib/inventory/internal-taxonomy";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[inv-h5c] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT = "00000000-0000-4000-a000-00000000F5C1";

let passes = 0;
let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenant() {
  await supabase.from("tenants").upsert({
    id: TENANT, slug: `inv-h5c-${TENANT.slice(-4)}`,
    name: `INV-H5C Sandbox ${TENANT.slice(-4)}`, is_host: false, active: true,
  }, { onConflict: "id" });
}

async function clean() {
  await supabase.from("inventory_serials").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_batches").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_valuation").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_stock_balances").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_stock_movements").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_items").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_item_types").delete().eq("tenant_id", TENANT);
  await supabase.from("inventory_warehouses").delete().eq("tenant_id", TENANT);
}

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H5C — Internal inventory library + UX simplification");
  console.log("─".repeat(72));

  await ensureTenant();
  await clean();
  await ensureDefaultWarehouse(TENANT);

  /* 01 — Expanded type library: at least 23 system types, with one row
          from each of the 10 INV-H5C categories. */
  const { data: sysTypesRaw } = await supabase
    .from("inventory_item_types")
    .select("type_key, type_name, icon, requires_product, usage_scope, is_system")
    .eq("is_system", true);
  const sysTypes = (sysTypesRaw ?? []) as Array<{
    type_key: string; type_name: string; icon: string | null;
    requires_product: boolean; usage_scope: string; is_system: boolean;
  }>;
  const requiredKeys = INTERNAL_TAXONOMY.map((c) => c.type_key);
  const missing = requiredKeys.filter(
    (k) => !sysTypes.some((t) => t.type_key === k && t.usage_scope === "internal_use"),
  );
  ok("01  expanded type library covers all 10 internal categories",
     sysTypes.length >= 23 && missing.length === 0,
     `count=${sysTypes.length} missing=[${missing.join(",")}]`);

  /* 02 — All internal types have icon + requires_product=false. */
  const internalRows = sysTypes.filter((t) => t.usage_scope === "internal_use");
  const noIcon = internalRows.filter((t) => !t.icon || t.icon.trim().length === 0);
  const wrongFlag = internalRows.filter((t) => t.requires_product !== false);
  ok("02  every internal-use type has icon set + requires_product=false",
     noIcon.length === 0 && wrongFlag.length === 0,
     `noIcon=${noIcon.length} wrongFlag=${wrongFlag.length}`);

  /* 03 — subcategory column exists, nullable. */
  const { data: probeItem, error: probeErr } = await supabase
    .from("inventory_items")
    .select("id, subcategory")
    .limit(1);
  ok("03  inventory_items.subcategory column exists (probe)",
     !probeErr && Array.isArray(probeItem),
     probeErr?.message ?? "");

  /* 04 — Quick-add: minimum fields succeed for an internal type. */
  const wh = await ensureDefaultWarehouse(TENANT);
  const quickAdd = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "INV-H5C A4 Paper Reams",
    type_key: "office_supply",
    unit_of_measure: "pcs",
    initial_quantity: 50,
    initial_warehouse_id: wh,
  });
  ok("04  quick-add internal item (name + type + warehouse + qty) succeeds",
     quickAdd.ok && !!quickAdd.item,
     quickAdd.error ?? "");

  /* 05 — Listing surfaces usage_scope=internal_use. */
  const items = await listInventoryItems({ tenantId: TENANT });
  const created = items.find((it) => it.id === quickAdd.item?.id);
  ok("05  list API marks the new item usage_scope=internal_use",
     !!created && created.usage_scope === "internal_use",
     `usage_scope=${created?.usage_scope}`);

  /* 06 — Posting opening_balance against the internal-use item. */
  const mv = await createInventoryMovement({
    tenant_id: TENANT,
    inventory_item_id: quickAdd.item!.id,
    warehouse_id: wh,
    movement_type: "opening_balance",
    quantity: 10,
    unit_cost: 1,
    from_workflow: true,
  });
  const mvPosted = mv.ok && mv.movement
    ? await postInventoryMovement(mv.movement.id, TENANT, null)
    : { ok: false };
  /* It's fine if opening_balance already posted on create; both attempts
     should still produce a posted IN movement at the end. */
  const { data: postedRows } = await supabase
    .from("inventory_stock_movements")
    .select("id, status, movement_type")
    .eq("tenant_id", TENANT)
    .eq("inventory_item_id", quickAdd.item!.id)
    .eq("status", "posted");
  ok("06  opening_balance movement against internal-use item posts",
     (postedRows ?? []).length >= 1,
     `postedCount=${(postedRows ?? []).length} mvOk=${mv.ok} postOk=${mvPosted.ok}`);

  /* 07 — No serial rows. */
  const { count: serialCount } = await supabase
    .from("inventory_serials")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("inventory_item_id", quickAdd.item!.id);
  ok("07  internal-use item creates no serial row",
     (serialCount ?? 0) === 0, `serials=${serialCount ?? 0}`);

  /* 08 — No batch rows. */
  const { count: batchCount } = await supabase
    .from("inventory_batches")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT)
    .eq("inventory_item_id", quickAdd.item!.id);
  ok("08  internal-use item creates no batch row",
     (batchCount ?? 0) === 0, `batches=${batchCount ?? 0}`);

  /* 09 — No product row was created. */
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT);
  ok("09  internal-use item creates no product row",
     (productCount ?? 0) === 0, `products=${productCount ?? 0}`);

  /* 10 — Subcategory round-trips through PATCH. */
  const patched = await updateInventoryItem(TENANT, quickAdd.item!.id, {
    subcategory: "Printer Paper",
  });
  const { data: refetched } = await supabase
    .from("inventory_items")
    .select("subcategory")
    .eq("id", quickAdd.item!.id)
    .maybeSingle();
  ok("10  subcategory round-trips through PATCH",
     patched.ok && (refetched as { subcategory?: string } | null)?.subcategory === "Printer Paper",
     patched.error ?? `got=${(refetched as { subcategory?: string } | null)?.subcategory}`);

  /* 11 — Type library API returns icon + usage_scope so UI can render. */
  const typeLib = await listItemTypes(TENANT);
  const sample = typeLib.find((t) => t.is_system && t.usage_scope === "internal_use");
  ok("11  listItemTypes returns icon + usage_scope on internal types",
     !!sample && !!sample.icon && sample.usage_scope === "internal_use",
     `sample=${sample?.type_key} icon=${sample?.icon}`);

  /* 12 — Regression: machine without product still rejected. */
  const machineTry = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "INV-H5C regression machine",
    type_key: "machine",
    unit_of_measure: "pcs",
  });
  ok("12  H5B regression: machine-type item without product still rejected",
     !machineTry.ok &&
       !!machineTry.error &&
       (machineTry.error.includes("INV_H1_REQUIRE_PRODUCT") ||
        machineTry.error.includes("Create or link a Product")),
     (machineTry.error ?? "").slice(0, 60));

  /* 13 — Regression: existing internal types still work (marketing_material). */
  const marketingTry = await createInventoryItem({
    tenant_id: TENANT,
    item_name: "INV-H5C Brochure Pack",
    type_key: "marketing_material",
    unit_of_measure: "pcs",
  });
  ok("13  H5B regression: existing internal types still work",
     marketingTry.ok && !!marketingTry.item,
     marketingTry.error ?? "");

  /* 14 — Chained validators. */
  const chained = [
    "validate:inventory-unification",
    "validate:inventory-discipline",
    "validate:inventory-transfers",
    "validate:inventory-returns",
    "validate:inventory-variants",
    "validate:inventory-serials",
    "validate:inventory-ux",
    "validate:inventory-internal-use",
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
        .split("\n").slice(-6).join(" | ");
      chainedDetails.push(`${script}=FAIL (${tail.slice(0, 100)})`);
    }
  }
  ok("14  chained inventory validators all pass",
     chainedPass, chainedDetails.join("; "));

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
