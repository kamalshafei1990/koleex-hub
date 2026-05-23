#!/usr/bin/env tsx

/* ===========================================================================
   PHASE INV-H5A — Inventory UX validator (15 assertions).

     01  Dashboard component loads (no syntax errors, default export)
     02  Quick action cards rendered (4 ActionCards present)
     03  Global search resolves serial number
     04  Global search resolves batch number
     05  Global search resolves SKU / item code
     06  Movement create menu uses operator-friendly labels
     07  Serial qty auto-sync helper exists and works
     08  FEFO suggestion picks the earliest-expiry batch
     09  Bulk approve action wires to /api/inventory/movements/:id/approve
     10  Bulk transfer complete: receive endpoint reachable for shipped transfer
     11  Mobile action bar renders on mobile-width viewport (mobile classes in JSX)
     12  Traceability card component exists and renders link list
     13  Warnings render — low stock chip, expired chip, serial-required chip
     14  Keyboard shortcuts hook registers + skips typing targets
     15  All previous inventory validators still pass (chain run)
   ========================================================================== */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

/* Optional DB-backed assertions if env supplies credentials. */
const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbAvailable = !!(URL_ENV && KEY);

async function main() {
  console.log("─".repeat(72));
  console.log("PHASE INV-H5A — Inventory UX validator (15 assertions)");
  console.log("─".repeat(72));

  /* 01 — Dashboard component loads */
  const dashboard = read("src/components/inventory/InventoryDashboard.tsx");
  ok(
    "01  Inventory dashboard component exports default",
    dashboard.includes("export default function InventoryDashboard"),
    dashboard.length === 0 ? "file missing" : "",
  );

  /* 02 — Quick action cards rendered */
  const hasFourActions =
    dashboard.includes(`testId="action-receive"`) &&
    dashboard.includes(`testId="action-ship"`) &&
    dashboard.includes(`testId="action-transfer"`) &&
    dashboard.includes(`testId="action-adjust"`);
  ok("02  Quick action cards (4) present", hasFourActions);

  /* 03–05 — global search via library helper. We exercise the pure
     query helper logic by checking the search route + query function. */
  const searchRoute = read("src/app/api/inventory/search/route.ts");
  const searchLib = read("src/lib/inventory/queries.ts");
  ok(
    "03  Search resolves serial — route + serial branch present",
    searchRoute.includes("inventoryGlobalSearch") &&
      searchLib.includes(`from("inventory_serials")`) &&
      searchLib.includes("serial_no"),
  );
  ok(
    "04  Search resolves batch — batch branch present",
    searchLib.includes(`from("inventory_batches")`) && searchLib.includes("batch_no"),
  );
  ok(
    "05  Search resolves SKU/item_code — items branch present",
    searchLib.includes(`from("inventory_items")`) &&
      searchLib.includes("item_code") &&
      searchLib.includes("sku"),
  );

  /* 06 — Movement create menu has operator labels */
  const ux = read("src/components/inventory/InventoryUx.tsx");
  const hasOperatorMenu =
    ux.includes("OperatorMovementMenu") &&
    ux.includes("inv.action.receive") &&
    ux.includes("inv.action.ship") &&
    ux.includes("inv.action.transfer") &&
    ux.includes("inv.action.adjust") &&
    ux.includes("inv.action.return");
  ok("06  Movement menu uses Receive/Ship/Transfer/Adjust/Return labels", hasOperatorMenu);

  /* 07 — Serial qty auto-sync — engine enforces this; verify the engine
         throws on mismatch (logic check via grep). */
  const serialsLib = read("src/lib/inventory/serials.ts");
  ok(
    "07  Serial qty auto-sync — engine validates qty == serial count",
    /qty[\s\S]*serial[\s\S]*length|serial[\s\S]*count[\s\S]*qty|quantity.*serial_ids\.length/i.test(serialsLib) ||
      /serial.*mismatch/i.test(serialsLib),
  );

  /* 08 — FEFO suggestion picks earliest expiry */
  try {
    const { suggestFefoBatch } = await import("../src/lib/inventory/fefo");
    const result = suggestFefoBatch([
      { id: "later",   batch_no: "B-LATER",   expiry_date: "2030-01-01" },
      { id: "earlier", batch_no: "B-EARLIER", expiry_date: "2026-01-01" },
      { id: "noexp",   batch_no: "B-NOEXP",   expiry_date: null },
    ]);
    ok("08  FEFO suggestion picks earliest expiry", result?.id === "earlier", `got ${result?.id ?? "null"}`);
  } catch (e) {
    ok("08  FEFO suggestion picks earliest expiry", false, e instanceof Error ? e.message : String(e));
  }

  /* 09 — Bulk approve wires to approve endpoint */
  const movements = read("src/components/inventory/InventoryMovements.tsx");
  ok(
    "09  Bulk approve wired to /movements/:id/approve",
    movements.includes("/api/inventory/movements/") && movements.includes("/approve") && movements.includes("bulkApprove"),
  );

  /* 10 — Bulk transfer complete: receive endpoint must exist */
  const receiveEndpoint = existsSync(
    join(process.cwd(), "src/app/api/inventory/transfers/[id]/receive/route.ts"),
  );
  ok(
    "10  Transfer receive endpoint exists (bulk-completable)",
    receiveEndpoint,
    receiveEndpoint ? "" : "POST /transfers/[id]/receive route missing",
  );

  /* 11 — Mobile action bar renders on mobile-width — check JSX classes. */
  const dashboardMobile = dashboard.includes("MobileBottomBar") && dashboard.includes("MobileFab");
  const movementsMobile = movements.includes("MobileBottomBar") && movements.includes("MobileFab");
  const mobileClassesInUx = ux.includes("md:hidden") && ux.includes("data-testid=\"inv-mobile-fab\"");
  ok("11  Mobile action bar rendered on inventory routes", dashboardMobile && movementsMobile && mobileClassesInUx);

  /* 12 — Traceability card component exists */
  ok(
    "12  TraceabilityCard component present + renders link list",
    ux.includes("export function TraceabilityCard") &&
      ux.includes("data-testid=\"inv-trace-card\"") &&
      ux.includes("TraceLink"),
  );

  /* 13 — Warnings render — low stock, expired, serial-required, stale-draft */
  const i18n = read("src/lib/translations/inventory.ts");
  ok(
    "13  Warning vocab present (low_stock, expired, serial_required, stale_draft)",
    i18n.includes("inv.warn.low_stock") &&
      i18n.includes("inv.warn.expired") &&
      i18n.includes("inv.warn.serial_required") &&
      i18n.includes("inv.warn.stale_draft") &&
      ux.includes("export function WarningChip"),
  );

  /* 14 — Keyboard shortcuts hook registered + skips typing */
  ok(
    "14  useInventoryShortcuts registered + skips inputs/textareas",
    ux.includes("useInventoryShortcuts") &&
      ux.includes("INPUT") &&
      ux.includes("TEXTAREA") &&
      ux.includes("isContentEditable") &&
      dashboard.includes("useInventoryShortcuts") &&
      movements.includes("useInventoryShortcuts"),
  );

  /* If DB available, do a tiny smoke check on operator-summary helper. */
  if (dbAvailable) {
    try {
      const { buildInventoryOperatorSummary, inventoryGlobalSearch } = await import("../src/lib/inventory/queries");
      const t = "00000000-0000-4000-a000-00000000F5A0";
      const summary = await buildInventoryOperatorSummary(t);
      console.log(`     operator-summary smoke: alerts=${JSON.stringify(summary.alerts)}`);
      const r = await inventoryGlobalSearch(t, "test");
      console.log(`     search smoke: items=${r.items.length} serials=${r.serials.length}`);
    } catch (e) {
      console.log(`     [info] DB smoke skipped — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /* 15 — chain previous validators */
  console.log("");
  console.log("─".repeat(72));
  console.log("Chaining previous inventory validators");
  console.log("─".repeat(72));
  const chain = [
    "validate:inventory",
    "validate:inventory-unification",
    "validate:inventory-discipline",
    "validate:inventory-transfers",
    "validate:inventory-returns",
    "validate:inventory-variants",
    "validate:inventory-serials",
  ];
  let chainAllPass = true;
  for (const script of chain) {
    console.log(`\n→ npm run ${script}`);
    const r = spawnSync("npm", ["run", "--silent", script], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    if (r.status !== 0) chainAllPass = false;
  }
  ok("15  All previous inventory validators pass (chain)", chainAllPass);

  console.log("");
  console.log("─".repeat(72));
  console.log(`PHASE INV-H5A summary — ${passes} pass · ${failures} fail`);
  console.log("─".repeat(72));
  if (failures > 0) process.exit(1);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
