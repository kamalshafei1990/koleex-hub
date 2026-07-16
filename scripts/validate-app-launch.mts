#!/usr/bin/env node
/* validate:app-launch — Phase 4 Home & App Launch Performance.
   Deterministic coverage of the shared launch primitive + prefetch strategy +
   loading-boundary presence, without a DOM renderer.

   (A) prefetch tiers + network/authorization gating (pure);
   (B) idle-preload never includes unauthorized or Tier-C apps;
   (C) static guards: AppLaunchLink is Link-based with modifier-key + dup +
       disabled + reduced-motion handling; Home + sidebar adopt it and no longer
       launch via router.push / bare <Link>; every representative app has a
       route-level loading.tsx; launch metric is privacy-safe.
   Run: node --import tsx scripts/validate-app-launch.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

const pf = await import(R("src/lib/app-prefetch.ts")) as typeof import("../src/lib/app-prefetch.js");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

// ── (A) tiers ──
check("customers is Tier A (idle preload)", pf.prefetchTier("customers") === "A");
check("suppliers is Tier A", pf.prefetchTier("suppliers") === "A");
check("database is Tier C (no auto preload — heavy)", pf.prefetchTier("database") === "C");
check("ai is Tier C", pf.prefetchTier("ai") === "C");
check("finance is Tier C", pf.prefetchTier("finance") === "C");
check("crm is Tier B (intent only)", pf.prefetchTier("crm") === "B");
check("Tier A list is small (≤4)", pf.TIER_A_IDLE_PRELOAD.length <= 4);

// ── network / device gating ──
const base = { saveData: false, effectiveType: "4g", hidden: false, online: true, deviceMemoryGb: 8 };
check("preload allowed on good 4g", pf.isPreloadAllowed(base) === true);
check("preload BLOCKED on Save-Data", pf.isPreloadAllowed({ ...base, saveData: true }) === false);
check("preload BLOCKED on 2g", pf.isPreloadAllowed({ ...base, effectiveType: "2g" }) === false);
check("preload BLOCKED on slow-2g", pf.isPreloadAllowed({ ...base, effectiveType: "slow-2g" }) === false);
check("preload BLOCKED when hidden tab", pf.isPreloadAllowed({ ...base, hidden: true }) === false);
check("preload BLOCKED when offline", pf.isPreloadAllowed({ ...base, online: false }) === false);
check("preload BLOCKED on <1GB device memory", pf.isPreloadAllowed({ ...base, deviceMemoryGb: 0.5 }) === false);
check("preload allowed on 3g", pf.isPreloadAllowed({ ...base, effectiveType: "3g" }) === true);

// ── (B) idle preload set = Tier A ∩ authorized only ──
check("idlePreloadApps intersects authorization (customers only)",
  JSON.stringify(pf.idlePreloadApps(new Set(["customers", "crm", "finance"]))) === JSON.stringify(["customers"]));
check("idlePreloadApps NEVER returns an unauthorized Tier-A app",
  pf.idlePreloadApps(new Set(["products"])).every((id) => id === "products"));
check("idlePreloadApps empty when nothing authorized", pf.idlePreloadApps(new Set()).length === 0);
check("idlePreloadApps ⊆ Tier A", pf.idlePreloadApps(new Set(pf.TIER_A_IDLE_PRELOAD)).every((id) => pf.TIER_A_IDLE_PRELOAD.includes(id)));

// ── (C) static guards — AppLaunchLink ──
const all = read("src/components/layout/AppLaunchLink.tsx");
check("AppLaunchLink renders a Next <Link> (native modifier keys / new tab)", /from "next\/link"/.test(all) && /<Link/.test(all));
check("AppLaunchLink handles modifier / middle click", /metaKey|ctrlKey/.test(all) && /button === 1/.test(all));
check("AppLaunchLink has a duplicate-activation guard", /lastLaunchRef/.test(all) && /< 400/.test(all));
check("AppLaunchLink renders a NON-link element when inactive/disabled", /if \(inactive\)/.test(all) && /<div/.test(all));
check("AppLaunchLink pressed feedback is reduced-motion-safe", /active:scale/.test(all) && /motion-reduce/.test(all));
check("AppLaunchLink gates intent preload on network safety", /isPreloadAllowed/.test(all));
check("AppLaunchLink fires unified launch telemetry", /trackAppOpen/.test(all) && /markAppLaunch/.test(all));

// Home adoption
const home = read("src/app/page.tsx");
check("Home AppCard adopts AppLaunchLink", /<AppLaunchLink/.test(home));
check("Home no longer launches apps via router.push(app.route)", !/router\.push\(app\.route\)/.test(home));
check("Home wires idle preload strategy", /idlePreloadApps/.test(home));

// Sidebar adoption
const side = read("src/components/layout/Sidebar.tsx");
check("Sidebar AppLink adopts AppLaunchLink", /<AppLaunchLink/.test(side));
check("Sidebar no longer imports bare next/link", !/from "next\/link"/.test(side));

// launch metric privacy
const perf = read("src/lib/perf/client.ts");
check("markAppLaunch normalizes app id (no arbitrary strings)", /markAppLaunch/.test(perf) && /\[a-z0-9_-\]\{1,32\}/.test(perf));

// ── loading boundaries for every representative app ──
const REP = ["customers", "suppliers", "contacts", "crm", "quotations", "catalogs", "discuss", "ai",
  "settings", "accounts", "inbox", "invoices", "sales", "purchase", "inventory", "products", "product-data", "finance", "employees"];
for (const app of REP) {
  check(`loading.tsx present for /${app}`, fs.existsSync(R(`src/app/${app}/loading.tsx`)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
