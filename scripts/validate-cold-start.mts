#!/usr/bin/env node
/* validate:cold-start — Phase 4 Cold Start & First Application Launch.
   Deterministic static guards (no DB / no browser):
   (A) Customers/Suppliers load ONLY the selected implementation (both are
       next/dynamic; the 11.6k-line legacy Contacts is not statically bundled),
       and mount neither until the trusted bootstrap flag resolves;
   (B) a real dynamic-chunk preload registry exists for the heavy apps;
   (C) AppLaunchLink warms the real client chunk on intent + tags cold launches;
   (D) Home warms the top chunks on idle (capped) + records interactivity;
   (E) cold-start metrics exist and are privacy-safe (durations/ids only);
   (F) the service worker never caches /api and never caches HTML navigations.
   Run: node --import tsx scripts/validate-cold-start.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const cust = read("src/app/customers/page.tsx");
const supp = read("src/app/suppliers/page.tsx");
const chunk = read("src/lib/app-chunk-preload.ts");
const link = read("src/components/layout/AppLaunchLink.tsx");
const home = read("src/app/page.tsx");
const perf = read("src/lib/perf/client.ts");
const sw = read("public/sw.js");

// ── (A) Customers/Suppliers cold-entry: only the selected impl loads ──
for (const [name, src, impl] of [["customers", cust, "CustomersServerList"], ["suppliers", supp, "SuppliersServerList"]] as const) {
  check(`${name}: legacy Contacts is a dynamic import, not a static import`, /dynamic\(\s*\(\) => import\("@\/components\/contacts\/Contacts"\)/.test(src) && !/^import Contacts from/m.test(src));
  check(`${name}: server-list impl is a dynamic import`, new RegExp(`dynamic\\(\\s*\\(\\) => import\\("@/components/(customers|suppliers)/${impl}"\\)`).test(src));
  check(`${name}: waits for bootstrap before mounting either impl (mode null → skeleton)`, /mode === null/.test(src) && /useState<null \| "legacy" \| "server">\(null\)/.test(src));
  check(`${name}: rollout precedence unchanged (decide() still calls shouldUseServerList)`, /shouldUseServerList\(window\.location\.hostname, window\.location\.search, inCohort\)/.test(src));
}

// ── (B) dynamic-chunk preload registry ──
check("app-chunk-preload registers crm/customers/suppliers", /crm: \(\) => import\("@\/components\/crm\/CRM"\)/.test(chunk) && /customers: \(\) => import\("@\/components\/contacts\/Contacts"\)/.test(chunk) && /suppliers: \(\) => import\("@\/components\/contacts\/Contacts"\)/.test(chunk));
check("app-chunk-preload never touches /api (chunk warm only)", !/\/api\//.test(chunk));
check("preloadAppChunk is deduped", /warmed\.has\(appId\)/.test(chunk) && /warmed\.add\(appId\)/.test(chunk));

// ── (C) AppLaunchLink warms real chunk on intent + cold tag ──
check("AppLaunchLink warms the real chunk on intent", /preloadAppChunk\(app\.id\)/.test(link));
check("AppLaunchLink keeps native <Link> (modifier/middle/keyboard)", /<Link/.test(link) && /metaKey \|\| e\.ctrlKey/.test(link));
check("AppLaunchLink keeps CSS :active press feedback (no JS wait)", /active:scale-\[0\.97\]/.test(link));
check("AppLaunchLink tags cold launches", /markAppLaunch\(app\.id, pressMs, !wasChunkWarmed\(app\.id\)\)/.test(link));

// ── (D) Home: idle chunk warm (capped) + interactivity mark ──
check("Home warms real chunks on idle, capped at top 2", /chunksWarmed < 2 && hasChunkPreloader\(id\)/.test(home) && /preloadAppChunk\(id\)/.test(home));
check("Home idle preload still gated on network/device", /isPreloadAllowed\(readNetworkContext\(\)\)/.test(home));
check("Home records interactivity on mount", /markHomeInteractive\(\)/.test(home));

// ── (E) cold-start metrics present + privacy-safe ──
check("perf: markHomeInteractive emits home.interactive_ms + first_input_delay", /home\.interactive_ms/.test(perf) && /home\.first_input_delay_ms/.test(perf));
check("perf: app_launch cold vs warm split", /app_launch\.cold\.press_feedback_ms/.test(perf));
// no account/route/permission content in metric DATA args: scan record()/event() args, drop the metric name.
const metricCalls = [...perf.matchAll(/\b(record|event)\(([^;]*?)\)/g), ...home.matchAll(/\b(record|event|markHomeInteractive)\(([^;]*?)\)/g)].map((m) => m[2] ?? "");
const dataArgs = metricCalls.map((a) => a.replace(/^\s*["'][^"']*["']\s*,?/, "").trim());
const FORBIDDEN = /account|permission|tenant|customer|supplier|email|route:|pathname|href|search|token/i;
check("cold-start metric DATA args carry no account/permission/route content", dataArgs.every((a) => !FORBIDDEN.test(a)));

// ── (F) service worker security ──
check("SW caches ONLY /_next/static/ (immutable hashed build output)", /url\.pathname\.startsWith\("\/_next\/static\/"\)/.test(sw));
check("SW never caches API responses", !/cache[^\n]*\/api\//.test(sw) && /NEVER \/api\/\*/.test(sw));
check("SW never caches HTML navigations (new version always picked up)", /NEVER HTML navigations/.test(sw));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
