#!/usr/bin/env node
/* validate:low-stock — ONE low-stock rule, and an alert that can fire
 * (owner's pick, 26 Sep 2026).
 *
 *   §1 the rule — low at or under the REORDER POINT, else the MINIMUM; an
 *      item with neither, or not tracked, is never low.
 *   §2 the alert reads real columns (item_name — the table has no `name`),
 *      says so when a read fails (and then neither raises nor settles an
 *      alert), uses the rule both when it raises and when it settles, and
 *      names the line the item crossed in every language.
 *   §3 the dashboard's count and the Items list's low-stock view use the
 *      same rule, from the balances; the page opens on it from the link.
 *
 * Source rules are checked both ways: the real file passes, a mutated copy
 * that breaks the rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import { isLowStock, lowStockThreshold } from "../src/lib/inventory/low-stock";
import { fillTemplate } from "../src/lib/notification-templates";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(JSON.stringify(got) === JSON.stringify(want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => stripComments(src);
function rule(name: string, file: string, check: (c: string) => string[], mutate: (src: string) => string) {
  const src = read(file);
  const real = check(code(src));
  expect(real.length === 0, `${name} (${file})`, real.join("; "));
  const mutated = mutate(src);
  if (mutated === src) { fail(`${name}: the mutation did not apply — update the guard`); return; }
  expect(check(code(mutated)).length > 0, `${name}: a copy that breaks it fails`);
}

console.log("\n§1 the rule");
eq(lowStockThreshold({ reorder_point: 5, min_stock: 2 }), { at: 5, by: "reorder_point" }, "the reorder point comes first — early enough to order in time");
eq(lowStockThreshold({ reorder_point: null, min_stock: 50 }), { at: 50, by: "min_stock" }, "an item with only a minimum is low at its minimum (it used to be missed by the dashboard)");
eq(lowStockThreshold({ reorder_point: "0", min_stock: "3.5" }), { at: 3.5, by: "min_stock" }, "a zero reorder point is no reorder point; numbers may come as text");
eq([lowStockThreshold({}), lowStockThreshold({ reorder_point: 5, track_stock: false }), lowStockThreshold(null)], [null, null, null], "an item with neither limit, or not tracked, is never low");
eq([isLowStock(5, { reorder_point: 5 }), isLowStock(5.01, { reorder_point: 5 }), isLowStock(0, {}), isLowStock("2", { min_stock: 2 })], [true, false, false, true], "low means at or under the threshold");

console.log("\n§2 the alert");
const NL = "src/lib/server/notify-lite.ts";
rule("the alert reads the item's real columns", NL,
  (c) => (/\.select\("id, item_name, item_code, min_stock, reorder_point, track_stock"\)/.test(c) && !/\.select\("id, name,/.test(c) ? [] : ["the alert reads a column that does not exist — it never fires"]),
  (src) => src.replace('.select("id, item_name, item_code, min_stock, reorder_point, track_stock")', '.select("id, name, min_stock, reorder_point, track_stock")'));
rule("a failed read says so in the log, and is 'unknown' — never passes for 'nothing is low'", NL,
  (c) => (c.includes('if (itemErr) { console.error("[notify-lite] low-stock item read:", itemErr.message); return "unknown"; }') && c.includes('if (balErr) { console.error("[notify-lite] low-stock balance read:", balErr.message); return "unknown"; }') ? [] : ["a failed read is silent"]),
  (src) => src.replace('if (itemErr) { console.error("[notify-lite] low-stock item read:", itemErr.message); return "unknown"; }', ""));
rule("the alert is raised by the one rule", NL,
  (c) => (c.includes("const limit = lowStockThreshold(item);") && c.includes("low: isLowStock(qty, item) };") && c.includes('if (!level || level === "unknown" || !level.low) return;')
    && !/item\.min_stock \?\? item\.reorder_point/.test(c) && !/level\.qty\s*[<>]=?\s*level\.threshold/.test(c) ? [] : ["the alert has its own rule"]),
  (src) => src.replace('if (!level || level === "unknown" || !level.low) return;', 'if (!level || level === "unknown" || level.qty > level.threshold) return;'));
rule("…and settled by it: back above the line, and never on a failed read", NL,
  (c) => (c.includes('if (level === "unknown" || (level && level.low)) return;') && !/level\.qty\s*[<>]=?\s*level\.threshold/.test(c) ? [] : ["a restock settles the alert by another rule, or on a read that failed"]),
  (src) => src.replace('if (level === "unknown" || (level && level.low)) return;', "if (level && level !== \"unknown\" && level.low) return;"));
rule("the alert names the line the item crossed", NL,
  (c) => (c.includes('p: { item: level.name, qty, threshold, by } }') && c.includes('p: { qty, threshold, by } }') ? [] : ["the alert says 'minimum' for a reorder point"]),
  (src) => src.replace('p: { item: level.name, qty, threshold, by } }', 'p: { item: level.name, qty, threshold } }'));
eq([fillTemplate("low_stock_alert.b", "en", { qty: 1, threshold: 5, by: "reorder_point" }), fillTemplate("low_stock_alert.b", "en", { qty: 2, threshold: 2, by: "min_stock" })],
  ["On hand 1 ≤ reorder point 5.", "On hand 2 ≤ minimum 2."], "…in its words: the reorder point, or the minimum");
eq([fillTemplate("low_stock_alert.unnamed.b", "zh", { qty: 1, threshold: 5, by: "reorder_point" }), fillTemplate("low_stock_alert.b", "ar", { qty: 2, threshold: 2, by: "min_stock" })],
  ["现有库存 1 ≤ 补货点 5。", "الكمية المتوفرة 2 ≤ الحد الأدنى 2."], "…in Chinese and Arabic too");

console.log("\n§3 the dashboard and the Items list");
const Q = "src/lib/inventory/queries.ts";
rule("the dashboard counts the low items by the one rule", Q,
  (c) => (c.includes("safe(lowStockItemIds(tenantId).then((ids) => ids.length), 0),") && c.includes("isLowStock(row.qty_on_hand, item)") ? [] : ["the dashboard counts by the reorder point only"]),
  (src) => src.replace("isLowStock(row.qty_on_hand, item)", "Number(row.qty_on_hand) <= Number(item.reorder_point ?? 0) && Number(item.reorder_point ?? 0) > 0"));
rule("the Items list's low-stock view reads the same items", Q,
  (c) => (c.includes("const lowIds = opts.lowStock ? await lowStockItemIds(opts.tenantId) : null;") && c.includes('await base().in("id", lowIds.slice(i, i + 100))') ? [] : ["the list's view differs from the count"]),
  (src) => src.replace("const lowIds = opts.lowStock ? await lowStockItemIds(opts.tenantId) : null;", "const lowIds: string[] | null = null;"));
rule("the items route takes the dashboard's link", "src/app/api/inventory/items/route.ts",
  (c) => (c.includes('lowStock: url.searchParams.get("filter") === "low_stock",') ? [] : ["?filter=low_stock is ignored"]),
  (src) => src.replace('lowStock: url.searchParams.get("filter") === "low_stock",', ""));
rule("the Items page opens on the low-stock view from the link, without painting the whole catalogue first", "src/components/inventory/InventoryItems.tsx",
  (c) => (c.includes('const lowStock = useSearchParams().get("filter") === "low_stock";') && c.includes("useRef<ItemsSnap | null>(lowStock ? null : readItemsSnap())") && c.includes('if (lowStock) qs.set("filter", "low_stock");') ? [] : ["the link opens every item"]),
  (src) => src.replace('if (lowStock) qs.set("filter", "low_stock");', ""));
const dash = code(read("src/components/inventory/InventoryDashboard.tsx"));
expect(dash.includes('href="/inventory/items?filter=low_stock"'), "the dashboard's low-stock card links to that view");
expect(code(read(NL)).includes('link: "/inventory/items?filter=low_stock",'), "…and so does the alert");

console.log(failed ? `\nvalidate:low-stock FAILED (${failed})` : "\nvalidate:low-stock passed");
process.exit(failed ? 1 : 0);
