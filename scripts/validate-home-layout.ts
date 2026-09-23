#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   validate:home-layout — the Home launcher's layout and My apps rules.

   The owner picked this layout from real screenshots on 23 Sep 2026 (option
   F): smaller tiles, groups packed into bands on one column grid, and a
   "My apps" row seeded once from the person's own usage. These checks pin
   the parts that would break silently: the band packer's output for the real
   catalogue, its invariants on random catalogues, the seeding rules, the
   preferences passthrough that every Settings save depends on, and the
   promises made about Home's speed (no request on an ordinary open, drag
   code only loaded on Edit).
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { launcherColumns, packAppBands, type AppBand } from "../src/lib/home/app-bands";
import { appForPath, readHomeAppsPref, seedPins, MY_APPS_MAX, MY_APPS_SEED } from "../src/lib/home/my-apps";
import { withDefaults, DEFAULT_PREFERENCES } from "../src/lib/access-control";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
const show = (bands: AppBand[]) => bands.map((b) => `[${b.rows}] ` + b.groups.map((g) => `${g.index}:${g.span}`).join(" ")).join(" | ");

console.log("── Columns: size-driven, tiles never narrower than 112 px ──");
check("1320 px of grid (a 1440 laptop) → 10 columns", launcherColumns(1320) === 10);
check("1105 px (1200 wide) → 9, 883 px (978 wide) → 7, 608 px (640 wide) → 5",
  launcherColumns(1105) === 9 && launcherColumns(883) === 7 && launcherColumns(608) === 5);
check("nothing measured yet → 3, never 0", launcherColumns(0) === 3 && launcherColumns(Number.NaN) === 3);

console.log("── Bands for the real catalogue (Operations 8, Commercial 12, Finance 2, People 4, Communication 5, Planning 3, Knowledge 5, System 10) ──");
const OWNER = [8, 12, 2, 4, 5, 3, 5, 10];
const b10 = packAppBands(OWNER, 10);
check("10 columns: Operations 4×2 | Commercial 6×2 · Finance | People | Planning · Communication | Knowledge · System",
  show(b10) === "[2] 0:4 1:6 | [1] 2:2 3:4 5:3 | [1] 4:5 6:5 | [1] 7:10", show(b10));
const b9 = packAppBands(OWNER, 9);
check("9 columns: System is not pulled up beside Operations (an order swap must cost more than a gap)",
  !b9[0].groups.some((g) => g.index === 7), show(b9));

console.log("── Band invariants on random catalogues ──");
let seed = 20260923;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let bad = "";
for (let trial = 0; trial < 1500 && !bad; trial++) {
  const n = 1 + Math.floor(rnd() * 8);
  const counts = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 16));
  const C = 5 + Math.floor(rnd() * 8);
  const bands = packAppBands(counts, C);
  const seen = new Map<number, number>();
  let lowestUnplaced = 0;
  for (const band of bands) {
    const used = band.groups.reduce((a, g) => a + g.span, 0);
    if (used > C) { bad = `band wider than ${C}: ${show(bands)}`; break; }
    if (band.groups[0].index !== lowestUnplaced) { bad = `band does not start with the lowest unplaced group: ${show(bands)}`; break; }
    for (const g of band.groups) {
      seen.set(g.index, (seen.get(g.index) ?? 0) + 1);
      const cnt = counts[g.index];
      const solo = band.groups.length === 1 && g.span === Math.min(cnt, C);
      const fits = band.rows * g.span >= cnt && (band.rows - 1) * g.span < cnt;
      const shaped = band.rows === 1 || (g.span >= 3 && band.rows * g.span - cnt <= 1);
      if (!fits || (!shaped && !solo)) { bad = `group ${g.index} (${cnt}) is not a closed block: ${show(bands)} C=${C}`; break; }
    }
    while (seen.has(lowestUnplaced)) lowestUnplaced++;
  }
  if (!bad && (seen.size !== n || [...seen.values()].some((v) => v !== 1))) bad = `a group missing or placed twice: ${show(bands)} counts=${counts}`;
}
check("1500 random catalogues: every group once, never wider than the grid, each a closed block, registry order kept", !bad, bad);
const t0 = performance.now();
for (let i = 0; i < 1000; i++) packAppBands(OWNER, [10, 9, 7][i % 3]);
const perCall = (performance.now() - t0) / 1000;
check(`packing the real catalogue costs ${perCall.toFixed(3)} ms (budget 1 ms)`, perCall < 1);

console.log("── My apps seeding ──");
const APPS = [
  { id: "products", route: "/products" }, { id: "product-data", route: "/product-data" },
  { id: "ai", route: "/ai" }, { id: "ai-knowledge", route: "/ai/knowledge" },
  { id: "activity-monitor", route: "/super-admin/activity" }, { id: "quotations", route: "/quotations" },
  { id: "orders", route: "/orders" }, { id: "settings", route: "/settings" },
];
check("a path belongs to the LONGEST app route it starts with",
  appForPath("/ai/knowledge/x", APPS) === "ai-knowledge" && appForPath("/ai/chat", APPS) === "ai" &&
  appForPath("/super-admin/activity", APPS) === "activity-monitor" && appForPath("/", APPS) === null && appForPath("/productsX", APPS) === null);
const pins = seedPins({ "/product-data": 600, "/ai": 400, "/quotations": 90, "/nowhere": 999, "/orders": 90 }, APPS, 5);
check("most-opened first, ties in launcher order, unknown routes ignored, padded in launcher order",
  JSON.stringify(pins) === JSON.stringify(["product-data", "ai", "quotations", "orders", "products"]), JSON.stringify(pins));
check(`the row is seeded with ${MY_APPS_SEED} apps, or every app the person has when fewer`,
  seedPins({}, APPS).length === Math.min(MY_APPS_SEED, APPS.length) && new Set(seedPins({}, APPS)).size === seedPins({}, APPS).length);
check("stored values are validated: junk → null, duplicates dropped, capped, unknown source → none",
  readHomeAppsPref("x") === null && readHomeAppsPref({ pins: "a" }) === null &&
  JSON.stringify(readHomeAppsPref({ pins: ["a", "a", 3, "b"], source: "bogus" })) === JSON.stringify({ pins: ["a", "b"], source: "none" }) &&
  (readHomeAppsPref({ pins: Array.from({ length: 40 }, (_, i) => `a${i}`), source: "user" })?.pins.length ?? 0) === MY_APPS_MAX);

console.log("── Preferences: the passthrough every Settings save depends on ──");
const mine = { pins: ["ai", "products"], source: "user" as const };
check("withDefaults keeps home_apps (a key it does not name is deleted by every wholesale save)",
  JSON.stringify(withDefaults({ home_apps: mine }).home_apps) === JSON.stringify(mine));
check("never set → source \"none\", so Home seeds it once",
  withDefaults({}).home_apps?.source === "none" && DEFAULT_PREFERENCES.home_apps.source === "none");

console.log("── Home stays fast ──");
const page = readFileSync("src/app/page.tsx", "utf8");
check("drag-to-reorder is a separate chunk, imported only when Edit is on",
  /import\("@\/components\/home\/my-apps-reorder"\)/.test(page) && !/from "@\/components\/home\/my-apps-reorder"/.test(page));
check("the usage read happens once, only while the row has never been set",
  (page.match(/\/api\/home\/app-usage/g) ?? []).length === 1 &&
  /if \(!homeApps \|\| homeApps\.source !== "none" \|\| homeApps\.pins\.length > 0\) return;/.test(page) &&
  /seedStarted\.current = true;/.test(page));
check("the row paints from the device's copy on the first render (no effect, no request)",
  /useState<HomeAppsPref \| null>\(\(\) => readCachedHomeApps\(getCurrentAccountIdSync\(\)\)\)/.test(page));
const route = readFileSync("src/app/api/home/app-usage/route.ts", "utf8");
check("the usage route is self-scoped: the account comes from the session only",
  /\.eq\("account_id", auth\.account_id\)/.test(route) && !/searchParams\.get\("account/.test(route) && /ROUTE_RE\.test/.test(route));

console.log(`\nhome-layout: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
