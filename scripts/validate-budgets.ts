#!/usr/bin/env node
/* validate:budgets — MEASURED performance budgets, not source patterns.
 *
 * WHY THIS EXISTS. Every regression found on 2026-08-09 was invisible to the
 * ~75 existing validators, because all of those read SOURCE and assert
 * patterns, while these defects were about NUMBERS:
 *
 *   the boot went 14 chunks / 944 KB  ->  33 chunks / 2217 KB
 *   Home opened 14 API calls; /product-data 14, taking 6.95 s
 *   a card painted at 208px and then again at 311px
 *
 * Nobody did anything reckless. Each addition was reasonable on its own; the
 * SUM was the problem, and nothing was watching the sum. The owner's worry is
 * exactly right: "after we add more features the system will get slow again."
 * It will, unless a number fails the build the day it moves.
 *
 * This runs on the BUILD OUTPUT — no browser, no database, no auth, seconds
 * to run. It reads what Next itself records about each route.
 *
 * Run: npm run build && tsx scripts/validate-budgets.ts
 *      tsx scripts/validate-budgets.ts --report   (print, never fail)
 *
 * WHEN A BUDGET FAILS: do not raise the number to make it pass. Find what was
 * added. Raise a budget only with a measurement and a reason in the commit —
 * a budget that drifts upward on every commit is not a budget.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
/* Sections G–I assert against the LIVE registries, so they import them. */
import { listSchemas } from "../src/lib/product-schema/index";
import { SPEC_I18N, SPEC_DESC_I18N, SPEC_NAME_I18N } from "../src/lib/product-schema/spec-i18n";
import { MACHINE_KINDS } from "../src/lib/machine-kinds";
import { FACETS, isValidFacet, FACET_I18N } from "../src/lib/product-facets";
import { stripComments } from "./lib/strip-comments";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NEXT = path.join(ROOT, ".next");
const REPORT_ONLY = process.argv.includes("--report");

let pass = 0, fail = 0;
const ok = (n: string, msg = "") => { pass++; console.log(`  ✓ ${n}${msg ? " — " + msg : ""}`); };
const bad = (n: string, msg: string) => { fail++; console.error(`  ✗ ${n} — ${msg}`); };

function kb(bytes: number) { return Math.round(bytes / 1024); }
function sizeOf(webPath: string): number {
  const rel = webPath.startsWith("/_next/") ? webPath.slice("/_next/".length) : webPath;
  const p = path.join(NEXT, rel);
  try { return fs.statSync(p).size; } catch { return 0; }
}

if (!fs.existsSync(NEXT)) {
  console.error("✗ .next not found — run `npm run build` first.");
  process.exit(1);
}

/* ── A. The framework + shell floor every page pays ────────────────────────
   rootMainFiles is what Next loads on EVERY app-router page. It is the one
   number that, if it drifts, makes the whole Hub slower at once. */
const FLOOR_MAX_FILES = 8;
const FLOOR_MAX_KB = 520;   // measured 2026-08-09: 6 files / 445 KB
{
  const bm = JSON.parse(fs.readFileSync(path.join(NEXT, "build-manifest.json"), "utf8")) as
    { rootMainFiles?: string[] };
  const files = (bm.rootMainFiles ?? []).filter((f) => f.endsWith(".js"));
  const total = files.reduce((n, f) => n + fs.statSync(path.join(NEXT, f)).size, 0);
  console.log(`\nA. Shared floor (every page): ${files.length} files, ${kb(total)} KB`);
  files.length <= FLOOR_MAX_FILES
    ? ok("file count", `${files.length} ≤ ${FLOOR_MAX_FILES}`)
    : bad("file count", `${files.length} > ${FLOOR_MAX_FILES} — something new is loading on EVERY page`);
  kb(total) <= FLOOR_MAX_KB
    ? ok("size", `${kb(total)} KB ≤ ${FLOOR_MAX_KB} KB`)
    : bad("size", `${kb(total)} KB > ${FLOOR_MAX_KB} KB — every screen in the Hub just got heavier`);
}

/* ── B. Per-route entry weight ─────────────────────────────────────────────
   What the route DECLARES it needs, straight from Next's client reference
   manifest. A new app gets a line here; that is the point — an app with no
   budget is an app nobody is watching.

   Measured 2026-08-09 after the boot work (chunks / KB):
     /home 8 / 500   /product-data 10 / 711   /products 10 / 706
     /purchase 9 / 490   /inventory 11 / 603
   Budgets are those numbers plus ~12% headroom — enough that ordinary work
   does not trip them, tight enough that a new library or a heavy import
   does. They were first written as GUESSES and two of them failed on the
   first run; measured beats guessed, always. */
const ROUTE_BUDGETS: Record<string, { chunks: number; kbytes: number }> = {

  /* The finance/* lines were re-baselined the same day, after the finance
     dictionary split: one 200 KB chunk had been sitting in 28 of the 29
     finance routes and nowhere else in the Hub. Every one of them dropped
     ~180 KB. Left at the old numbers, all of it could have come back unseen.

     products/[id] and products/preview/[slug] were re-baselined the same day,
     AFTER the preview-dictionary split and the spec-i18n change took them from
     1,410 KB to 853. A budget left at the old number would have quietly
     allowed all of it back. */
  /* ── DETAIL ROUTES, MEASURED 17/09/2026 ───────────────────────────────────
     These 34 had never been budgeted: section C only read navigation.ts,
     whose entries are all top-level, so every detail page in the Hub was
     unwatched. That is how /product-data/[id] reached 1,257 KB — nearly twice
     its own list — with nothing to notice. The coverage check below now
     weighs nested routes and asks for a line once one passes 800 KB.

     Written from the measurement, +12%, exactly as the app budgets were.
     Two things worth seeing in this list rather than hiding behind a pass:
     /products/[id] is the heaviest screen in the Hub at 1,410 KB, and the
     finance/* cluster sits at 800–1,010 KB across ~25 routes, which says the
     weight is shared between them rather than in any one page. Neither is
     addressed here; they are now VISIBLE, which is the prerequisite. */
  "contracts/[id]/print": { chunks: 14, kbytes: 1019 },
  /* 19/09/2026: the spec icon hub listed the templates by importing the
     product-schema registry into the browser — the whole registry (532 KB
     of source) shipped for a list. It now asks /api/product-schema; measured
     879 → 598 KB. Ceiling 12 KB over the measurement, never up again. */
  "database/product-specs": { chunks: 9, kbytes: 610 },
  "documents/[id]/print": { chunks: 15, kbytes: 1040 },
  "employees/[id]/edit": { chunks: 15, kbytes: 977 },
  "employees/new": { chunks: 15, kbytes: 974 },
  "finance/accounting/cash-flow": { chunks: 13, kbytes: 703 },
  "finance/accounting/equity": { chunks: 13, kbytes: 701 },
  "finance/accounting/general-ledger": { chunks: 13, kbytes: 702 },
  "finance/accounting/profit-loss": { chunks: 13, kbytes: 712 },
  "finance/accounting/queue": { chunks: 13, kbytes: 734 },
  "finance/accounting/trial-balance": { chunks: 13, kbytes: 702 },
  "finance/bank-accounts": { chunks: 15, kbytes: 811 },
  "finance/bank-imports": { chunks: 14, kbytes: 755 },
  "finance/customers": { chunks: 14, kbytes: 739 },
  "finance/expenses": { chunks: 14, kbytes: 762 },
  "finance/intelligence": { chunks: 15, kbytes: 951 },
  "finance/notifications": { chunks: 14, kbytes: 739 },
  "finance/orders": { chunks: 15, kbytes: 830 },
  "finance/overview": { chunks: 14, kbytes: 849 },
  "finance/payments": { chunks: 14, kbytes: 771 },
  "finance/reconciliation": { chunks: 14, kbytes: 752 },
  "finance/reports": { chunks: 13, kbytes: 692 },
  "finance/setup": { chunks: 14, kbytes: 752 },
  "finance/statements": { chunks: 14, kbytes: 732 },
  "finance/suppliers": { chunks: 14, kbytes: 738 },
  "finance/treasury-forecast": { chunks: 14, kbytes: 763 },
  "finance/treasury-plans": { chunks: 14, kbytes: 782 },
  "finance/visual": { chunks: 14, kbytes: 849 },
  "invoices/[id]/print": { chunks: 14, kbytes: 1040 },
  "product-data/[id]": { chunks: 14, kbytes: 1053 },
  /* Product-page rebuild, 19/09/2026. Phase 0 ratcheted this to the measured
     853 KB; phases 1–3 added the hero, highlights and the conditional
     sections and the page crept to 887. Then the real weight was found:
     ProductPreview imported five pure helpers through the @/lib/product-schema
     BARREL, whose index pulls every spec template (532 KB of source) to build
     the server-side registry — the whole registry rode into the browser
     bundle of the heaviest page in the Hub. Importing the helpers from their
     leaf modules took the page from 887 to 607 KB (validate:product-page-images
     §3 keeps the barrel out). Ceiling set 13 KB over the measured 607 and
     it never goes up again: every later phase must come in under 620. */
  "products/[id]": { chunks: 9, kbytes: 610 },
  "products/preview/[slug]": { chunks: 9, kbytes: 610 },
  "quotations/[id]/print": { chunks: 13, kbytes: 984 },
  /* reports/[id] + its print route — MEASURED 25/09/2026 at 9 chunks / 586 KB
     and 12 chunks / 742 KB, +12%. The print route carries the quotation's
     PRINT_AND_DOC_STYLES like every house document; it only ever loads in
     the reader's hidden print iframe. 26/09/2026: 604 → 589 KB and 777 →
     748 KB once each Reports screen downloaded only its own words
     (translations/report-ui — validate:reports §26). */
  "reports/[id]": { chunks: 10, kbytes: 657 },
  "reports/[id]/print": { chunks: 14, kbytes: 832 },
  "suppliers/[id]": { chunks: 13, kbytes: 1062 },
  /* ── RE-BASELINED 17/09/2026 ──────────────────────────────────────────────
     Ten routes sat 1–6 KB over while using FEWER chunks than budgeted (8 of
     10, 9 of 11). That shape is the signature of a shared-module repack, not
     a regression: the same bytes redistributed into fewer, fatter shared
     chunks, so every route's SUM drifts a little even though nothing was
     added. Section A confirms it — the shared floor is unchanged at 446 KB,
     inside its 520 KB line — and the two routes that WERE a real regression
     moved the other way in the same build (product-data 835 → 697 KB,
     products 831 → 692 KB, after the i18n split), which is what a genuine
     change looks like next to this noise.
     Re-measured and given the file's usual ~12% headroom. Raising a budget
     is only allowed with a measurement and a reason; both are above. */
  "accounts": { chunks: 12, kbytes: 880 },
  "ai": { chunks: 10, kbytes: 570 },
  "calendar": { chunks: 12, kbytes: 824 },
  "catalogs": { chunks: 15, kbytes: 1124 },
  /* Re-measured 2026-08-21 after a chunk repack (11 → 8 chunks, 673 KB —
     fewer, fatter chunks from unrelated shared-module churn; +5 KB tripped
     the old line). Measured + headroom. */
  "commercial-policy": { chunks: 9, kbytes: 700 },
  /* Measured 9 chunks / 504 KB the day the app shipped, +12%. Sits with
     contacts (508) and crm (514): almost all of it is the shared baseline,
     which is the expected shape for one list plus one dialog. The CONTRACT
     itself is not in this number — the paper lives on /contracts/[id],
     which is a separate route with its own manifest. */
  "contracts": { chunks: 10, kbytes: 564 },
  "contacts": { chunks: 10, kbytes: 570 },
  /* ── +1 KB ON SIX ROUTES, 20/09/2026 ──────────────────────────────────────
     Not a regression in any of these six screens. Adding the "me" app touched
     two files that 82% of every route already shares — navigation.ts (the
     entry) and translations/hub.ts (the app name) — so the shared bundle grew
     ~1 KB and every route carrying it went up by the same 1 KB. These six sat
     exactly on their number, so they were the only ones to cross. Raised to
     the re-measured value, which keeps them as tight as they were; the other
     routes had the headroom to absorb it and are untouched. */
  /* +2 KB on the six below (2026-09-23), measured, not guessed. These six
     sat within 1 KB of their budget. Once a user can choose the Koleex AI orb
     (owner, #448), every page that shows an orb also carries the choice. The
     CRM route, built before the orb shipped (9772d9c) and after, differs by
     +1,345 bytes, all in the shared shell:
       ChosenOrb  794 B  (picks aura or dots)
       orb-style  766 B  (reads the saved choice)
       lazy stub  102 B  (the dots themselves load on demand)
     The silent-update code removed from UpdateWatcher offsets part of it.
     The dots engine (~16 KB) is NOT here: it loads only for users who chose
     it. Without that, 19 routes failed. */
  "crm": { chunks: 10, kbytes: 517 },
  "customers": { chunks: 10, kbytes: 518 },
  "database": { chunks: 11, kbytes: 617 },
  "discuss": { chunks: 11, kbytes: 570 },
  "documents": { chunks: 10, kbytes: 517 },
  /* Measured 2026-08-20 TWICE — the widget-canvas demo is under active
     development in a parallel session and grew 8→9 chunks within the hour
     (498→508 KB). Budgeted at the second measurement + headroom; if it
     trips again the owning session should set its own number. */
  "dashboard": { chunks: 10, kbytes: 570 },
  "employees": { chunks: 12, kbytes: 851 },
  "expenses": { chunks: 13, kbytes: 722 },
  "finance": { chunks: 15, kbytes: 879 },
  "hr": { chunks: 14, kbytes: 1136 },
  "inbox": { chunks: 12, kbytes: 839 },
  "inventory": { chunks: 13, kbytes: 762 },
  "invoices": { chunks: 8, kbytes: 520 },
  "issues": { chunks: 12, kbytes: 712 },
  /* Re-measured 2026-08-24: 525 KB against a 520 budget. NOT drift — its
     peers (ai, contacts, crm, customers, discuss, notes, planning) all sit at
     497-502 KB, so the knowledge route genuinely carries ~24 KB of its own,
     and 5 KB of that is new. The source is product-coding/data.ts, which went
     12 KB -> 34 KB across CL-0026 and CL-0027. That growth is mandated: the
     owner's standing rule is that every minted code is taught in the Knowledge
     app, so this number rises every time the taxonomy does. Budgeted at
     measured + 12%; it is the one route where headroom is expected to be
     spent, and a jump far past 590 means something OTHER than codes arrived. */
  "knowledge": { chunks: 11, kbytes: 590 },
  "landed-cost": { chunks: 11, kbytes: 577 },
  "management": { chunks: 12, kbytes: 983 },
  "markets": { chunks: 11, kbytes: 772 },
  "notes": { chunks: 11, kbytes: 575 },
  /* Measured 8 chunks / 502 KB the day it shipped, +12%. Sits exactly with
     customers (502) and suppliers (502): almost all of it is the shared
     baseline, which is the expected shape — the app is one list and one
     detail screen with no library of its own. */
  "orders": { chunks: 10, kbytes: 562 },
  /* me — MEASURED 20/09/2026 at 11 chunks / 695 KB, +12% as every app line is.
     The employee self-service app: own profile, attendance, leave, documents,
     payslips. First budget, set the day the route appeared. */
  "me": { chunks: 13, kbytes: 778 },
  "planning": { chunks: 10, kbytes: 517 },
  "price-calculator": { chunks: 12, kbytes: 803 },
  "product-data": { chunks: 12, kbytes: 796 },
  "products": { chunks: 12, kbytes: 791 },
  "projects": { chunks: 10, kbytes: 517 },
  "purchase": { chunks: 11, kbytes: 622 },
  "quotations": { chunks: 11, kbytes: 850 },
  /* reports — MEASURED 25/09/2026 at 9 chunks / 608 KB, +12% as every app line
     is. The Reports app home (bundle, lists, template cards); the HR numbers
     in its Library are a dynamic import and are NOT in this number.
     26/09/2026: 665 KB after Phase 5C (146 types) → 638 KB once the home
     listed the types from their heads (lib/reports/catalog-heads, generated)
     instead of the whole catalog of sections; the builder tab keeps that →
     616 KB once it downloaded only its own words (translations/report-ui) →
     569 KB once the descriptions became their own chunk, loaded beside the
     list behind a skeleton (validate:reports §27). */
  "reports": { chunks: 10, kbytes: 681 },
  "roles": { chunks: 12, kbytes: 816 },
  "sales": { chunks: 12, kbytes: 810 },
  /* Re-measured 2026-08-15 after the tabs were moved to next/dynamic:
     11 chunks / 980 KB → 8 / 560. The old 14/1071 was headroom over a route
     that was loading all twelve tab components to show one; leaving it there
     would have let the regression walk straight back in. */
  "settings": { chunks: 11, kbytes: 706 },
  /* Measured 9 chunks / 519 KB the day it shipped, +12%. Sits with customers
     (502) and suppliers (502): almost all of it is the shared baseline, which
     is the expected shape for an app that is one search bar and a list of
     cards. The port and airport tables are NOT in this number and must never
     be — 3,806 ports live in Postgres and are searched server-side, which is
     the whole reason they are not a TS literal. */
  "shipping": { chunks: 10, kbytes: 581 },
  "software-center": { chunks: 11, kbytes: 618 },
  "suppliers": { chunks: 10, kbytes: 518 },
  /* Measured 9 chunks / 518 KB on the day it shipped, +12% headroom. Sits
     with customers (492) and notes (491): almost all of it is the shared
     baseline, and tesseract.js is a dynamic import so the OCR engine is NOT
     in this number. */
  "travel": { chunks: 10, kbytes: 580 },
  "todo": { chunks: 12, kbytes: 964 },
  /* +1 KB, 2026-09-24: 595 → 596 measured. The account preferences now
     validate the Koleex AI model choice (lib/ai/koleex-model-ids.ts, ~350 B
     minified, shared baseline); it tipped this route over a KB boundary. The
     picker's catalog and store stay in the AI app's own chunk. */
  "translator": { chunks: 11, kbytes: 596 },
  "website": { chunks: 11, kbytes: 600 },
};
console.log("\nB. Route entry weight");
for (const [route, budget] of Object.entries(ROUTE_BUDGETS)) {
  const file = path.join(NEXT, "server/app", route, "page_client-reference-manifest.js");
  if (!fs.existsSync(file)) { bad(route, "no client-reference manifest — did the route move?"); continue; }
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("= {", src.indexOf("__RSC_MANIFEST"));
  let manifest: { clientModules?: Record<string, { chunks?: string[] }> };
  try { manifest = JSON.parse(src.slice(start + 2).trim().replace(/;$/, "")); }
  catch { bad(route, "manifest could not be parsed"); continue; }
  const chunks = new Set<string>();
  for (const info of Object.values(manifest.clientModules ?? {})) {
    for (const c of info.chunks ?? []) if (c.endsWith(".js")) chunks.add(c);
  }
  const total = [...chunks].reduce((n, c) => n + sizeOf(c), 0);
  const label = `${route}: ${chunks.size} chunks / ${kb(total)} KB`;
  if (chunks.size <= budget.chunks && kb(total) <= budget.kbytes) ok(label);
  else bad(label, `budget ${budget.chunks} chunks / ${budget.kbytes} KB`);
}

/* ── C. Every app must have a budget ───────────────────────────────────────
   The rule that survives new apps: if a route ships and nobody wrote a
   number for it, this fails and asks for one. */
console.log("\nC. Coverage");
{
  const registry = fs.readFileSync(path.join(ROOT, "src/lib/navigation.ts"), "utf8");
  const routes = [...registry.matchAll(/route:\s*"\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  const active = [...new Set(routes)].filter((r) =>
    fs.existsSync(path.join(NEXT, "server/app", r, "page_client-reference-manifest.js")));
  const unbudgeted = active.filter((r) => !(r in ROUTE_BUDGETS));

  /* ⚠️ AND THE HEAVY ROUTES UNDER THEM — THIS IS WHERE THE WEIGHT HID.
     The scan above reads navigation.ts, whose `route:` entries are all
     top-level, so DETAIL pages were invisible to it. Measured 17/09/2026:
     /product-data was 698 KB and budgeted, while /product-data/[id] — the
     record every operator actually works in — was 1,257 KB and watched by
     nothing, and /products/[id] was 1,411 KB. The heaviest screens in the Hub
     were the ones no number covered.

     ⚠️ BUT NOT *EVERY* NESTED ROUTE. The first version of this check demanded
     a budget for all of them and named 190 — most of them static knowledge
     pages a few KB over the shared floor. A guard that asks for 190 numbers
     nobody will maintain is a guard that gets deleted, which is the same
     lesson the card-placeholder check already taught one section below.
     So the line is drawn by WEIGHT: a nested route only needs its own budget
     once it is heavy enough to matter. 800 KB is the shared floor (446 KB)
     plus roughly 350 KB of a route's own code — past that it is an app in its
     own right and deserves a number. */
  const HEAVY_NESTED_KB = 800;
  const nested: string[] = [];
  const walkApp = (dir: string, rel = "") => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const here = rel ? `${rel}/${e.name}` : e.name;
      if (fs.existsSync(path.join(dir, e.name, "page_client-reference-manifest.js"))) nested.push(here);
      walkApp(path.join(dir, e.name), here);
    }
  };
  walkApp(path.join(NEXT, "server/app"));
  const weigh = (route: string): number => {
    try {
      const src = fs.readFileSync(path.join(NEXT, "server/app", route, "page_client-reference-manifest.js"), "utf8");
      const start = src.indexOf("= {", src.indexOf("__RSC_MANIFEST"));
      const mf = JSON.parse(src.slice(start + 2).trim().replace(/;$/, "")) as
        { clientModules?: Record<string, { chunks?: string[] }> };
      const cs = new Set<string>();
      for (const info of Object.values(mf.clientModules ?? {})) for (const c of info.chunks ?? []) if (c.endsWith(".js")) cs.add(c);
      return kb([...cs].reduce((n, c) => n + sizeOf(c), 0));
    } catch { return 0; }
  };
  const heavyNested = nested
    .filter((r) => r.includes("/") && !(r in ROUTE_BUDGETS))
    .map((r) => ({ r, kb: weigh(r) }))
    .filter((x) => x.kb >= HEAVY_NESTED_KB)
    .sort((a, b) => b.kb - a.kb);
  const unbudgetedNested = heavyNested.map((x) => `${x.r} (${x.kb} KB)`);
  /* EVERY built app route must carry a budget. This is the part that answers
     the owner's actual worry — a NEW app cannot ship unwatched, because the
     build stops until someone measures it and writes the number down. Adding
     the line is thirty seconds; discovering the regression six months later
     costs what this whole session cost. */
  console.log(`  ${active.length} built app routes, ${Object.keys(ROUTE_BUDGETS).length} budgeted`);
  unbudgeted.length === 0
    ? ok("every app route has a budget", `${active.length} routes`)
    : bad("unbudgeted app routes", `${unbudgeted.join(", ")} — run \`npm run budgets\` to read their measured size, then add a line to ROUTE_BUDGETS (measured + ~12%)`);
  unbudgetedNested.length === 0
    ? ok(`no unbudgeted nested route is over ${HEAVY_NESTED_KB} KB`, `${nested.filter((r) => r.includes("/")).length} nested routes weighed`)
    : bad("unbudgeted HEAVY detail routes", `${unbudgetedNested.join(", ")} — a detail page this size needs its own line in ROUTE_BUDGETS`);
}

/* ── D. Boot document weight — the number the user actually waits for ──────
   Section B reads what a route DECLARES in its client-reference manifest, and
   that is not the same list the browser downloads: the /home document ships
   script tags that appear in no manifest at all.

   The honest ruler is the script list in the SERVER-RENDERED HTML. Do not
   measure this with performance.getEntriesByType("resource") — that counts the
   chunks the App Router prefetches for NEIGHBOURING routes as if they were
   boot, and document.outerHTML accumulates tags from every client-side
   navigation the tab has made. A full day went into hunting a 184 KB
   @supabase chunk that both rulers showed in the boot and that the document
   never requested; it is prefetch for Settings/Todo/Calendar, which is
   deliberate warm-up.

   The prerendered .html on disk is the same document Next serves, so this
   needs no server, no session and no browser. */
const BOOT_DOC_MAX_FILES = 22;
const BOOT_DOC_MAX_KB = 1750;   // measured 2026-08-09: worst is hr at 19 / 1569
/* Re-baselined 2026-09-25: 1036 → 974 KB once the sign-in screen, the QA
   tooling, the Super-Admin pickers and the Vercel beacons stopped riding the
   signed-in first download (they load when needed). Left at 1160, all 62 KB
   could have come back unseen. Was: 2026-08-13, 14 files / 1048 KB. */
const BOOT_DOC_ENTRY_MAX_KB = 1075;  // measured 2026-09-25: index 14 files / 974 KB, +~10%
console.log("\nD. Boot document (script tags in the server HTML)");
{
  const appDir = path.join(NEXT, "server/app");
  const docs = fs.readdirSync(appDir).filter((f) => f.endsWith(".html"));
  const measure = (file: string) => {
    const html = fs.readFileSync(path.join(appDir, file), "utf8");
    const files = [...new Set([...html.matchAll(/static\/chunks\/([\w.~%-]+\.js)/g)].map((m) => m[1]))];
    const bytes = files.reduce((n, f) => n + sizeOf(`static/chunks/${f}`), 0);
    return { route: file.replace(/\.html$/, ""), files: files.length, kb: kb(bytes) };
  };
  const rows = docs.map(measure).sort((a, b) => b.kb - a.kb);
  const worst = rows[0];
  console.log(`  ${rows.length} prerendered documents, heaviest: ${worst.route} ${worst.files} files / ${worst.kb} KB`);
  const over = rows.filter((r) => r.files > BOOT_DOC_MAX_FILES || r.kb > BOOT_DOC_MAX_KB);
  over.length === 0
    ? ok("every boot document within budget", `≤ ${BOOT_DOC_MAX_FILES} files / ${BOOT_DOC_MAX_KB} KB`)
    : bad("boot documents over budget", over.map((r) => `${r.route} ${r.files}/${r.kb}KB`).join(", "));
  /* The entry document every single user pays, every session, gets its own
     tighter line so it cannot drift up under cover of the global ceiling.

     This guard used to watch "home" — i.e. /home, the role dashboard. That
     screen had no entry point anywhere in the Hub and was removed; the route
     users actually land on is `/`, which Next prerenders as index.html. So the
     guard was protecting a screen nobody could reach while the real entry went
     unwatched. Same budget: index measured 14 files / 1048 KB against home's
     15 / 1055. */
  const entry = rows.find((r) => r.route === "index");
  if (!entry) bad("entry document", "no prerendered index.html — did the root route move?");
  else entry.kb <= BOOT_DOC_ENTRY_MAX_KB
    ? ok("entry boot document (/)", `${entry.files} files / ${entry.kb} KB ≤ ${BOOT_DOC_ENTRY_MAX_KB} KB`)
    : bad("entry boot document (/)", `${entry.files} files / ${entry.kb} KB > ${BOOT_DOC_ENTRY_MAX_KB} KB — every session pays this`);
}

/* ── E. The warm-start rule, as a guard ────────────────────────────────────
   This one is here because I broke it three times in one component in one
   day. Anything read from a client cache must be read in the useState
   INITIALISER — `products` initialises synchronously from the query cache, so
   a value seeded one effect later lays the screen out twice. That is what the
   owner saw as "the card jumps a little to the right then back". */
console.log("\nE. Warm-start seeding (no double layout)");
{
  const pl = fs.readFileSync(path.join(ROOT, "src/components/admin/ProductList.tsx"), "utf8");
  const seeded = (name: string) => new RegExp(`useState[^\\n]*\\(\\s*\\(\\)\\s*=>\\s*${name}\\(`).test(pl);
  seeded("readMetaCache")
    ? ok("taxonomy seeded at first render")
    : bad("taxonomy", "readMetaCache must be called in a useState initialiser, not an effect");
  seeded("readModelCache")
    ? ok("model maps seeded at first render")
    : bad("model maps", "readModelCache must be called in a useState initialiser, not an effect");
  /* Reserved space inside the CARD must be INVISIBLE — the first attempt
     drew 726 pulsing boxes at once (6 per card x 121) and the owner called
     that a flash too. Scoped to ProductCard on purpose: the infinite-scroll
     sentinel at the bottom SHOULD animate, because it means "more is coming"
     rather than "this will be replaced under you". The first version of this
     check flagged that sentinel — a guard that cries wolf gets ignored. */
  const cardStart = pl.indexOf("const ProductCard = memo(");
  /* memo(function ProductCard(...) closes with `});` at column 0 — the first
     top-level `const` after it is far away, and slicing to that swallowed the
     PAGE skeletons and made this fail on legitimate loading states. */
  const cardEnd = pl.indexOf("\n});", cardStart);
  /* ⚠️ STRIP COMMENTS BEFORE LOOKING. This matched the raw source, so writing
     a comment that NAMES the banned class — which is exactly what the code
     explaining why it was removed has to do — failed the build. A guard you
     cannot document around is a guard someone eventually deletes. */
  const cardBody = stripComments(cardStart < 0 ? "" : pl.slice(cardStart, cardEnd > 0 ? cardEnd : undefined), { line: "all" });
  if (cardStart < 0) bad("card", "ProductCard not found — did it move or get renamed?");
  !cardBody.includes("animate-pulse")
    ? ok("card reserves space without animating")
    : bad("card placeholder", "ProductCard contains animate-pulse — reserve the height, draw nothing");

  /* ── The rule the whole Hub is held to, not just this one screen ────────
     MEASURED ON PRODUCTION 2026-08-22, across the ten screens the owner
     works in: a route COMMITS in 63-493ms, but its data does not settle
     until 1.0-1.8s, because ONE api request costs 400-920ms on this network
     path and a screen that waits for it renders nothing meanwhile. Request
     count (2-10) and waterfall depth (1-3) were already fine, so there was
     nothing left to batch — the only lever is to stop waiting.

     Every mature list app had already reached that conclusion separately
     (Products, To-do, Contacts, Customers, CRM, HR, Notes, Finance, Home
     all warm-start from a stored snapshot). The two screens that felt slow,
     Purchases and Inventory, were exactly the two that never got it.

     So: an app landing screen may not open on a blocking spinner with no
     warm path behind it. This lists the landing screens and asserts each
     one either seeds from a snapshot or is honestly exempt. A NEW app added
     without a warm start fails the build the day it lands, which is the
     entire point of this file. */
  const WARM_REQUIRED: Array<{ label: string; file: string }> = [
    { label: "Purchases home",  file: "src/components/purchase/PurchaseHome.tsx" },
    { label: "Inventory home",  file: "src/components/inventory/InventoryDashboard.tsx" },
    { label: "Products list",   file: "src/components/admin/ProductList.tsx" },
    { label: "To-do",           file: "src/app/todo/page.tsx" },
    { label: "HR",              file: "src/components/hr/HRApp.tsx" },
  ];
  /* Any of the accepted spellings: the shared helper, or one of the
     hand-rolled snapshot readers that predate it. */
  const WARM_MARK = /useWarm\s*<|readWarm\s*<|readTodoSnap|readMetaCache|sessionStorage\.getItem|localStorage\.getItem/;
  for (const s of WARM_REQUIRED) {
    const p = path.join(ROOT, s.file);
    if (!fs.existsSync(p)) { bad(`warm start: ${s.label}`, `${s.file} not found — did it move?`); continue; }
    WARM_MARK.test(fs.readFileSync(p, "utf8"))
      ? ok(`warm start: ${s.label}`)
      : bad(`warm start: ${s.label}`,
            `${s.file} opens on a cold fetch. A request costs 400-920ms here, so the screen ` +
            `shows nothing for that long. Use useWarm/writeWarm from src/lib/warm-cache.ts ` +
            `and DERIVE (fresh ?? warm) — do not seed state from storage in a useState initialiser.`);
  }

  /* The warm cache must stay inside the sign-out wipe. session-caches.ts
     clears by prefix; a key invented outside `kx:` would survive a sign-out
     and paint one tenant's numbers into another account's session. */
  const wc = fs.readFileSync(path.join(ROOT, "src/lib/warm-cache.ts"), "utf8");
  /^const PREFIX = "kx:/m.test(wc)
    ? ok("warm cache is inside the sign-out wipe", "kx: prefix")
    : bad("warm cache prefix", "warm-cache.ts must key under `kx:` — session-caches.ts wipes by that prefix on sign-out");
  wc.includes("useSyncExternalStore")
    ? ok("warm cache hydrates without a mismatch")
    : bad("warm cache hydration", "reading storage during the first client render contradicts the server HTML — use useSyncExternalStore");
}

/* ── F. Aurora CSS: a state rule its own resting rule can outrank ──────────
   A NUMBER, like the rest of this file — the number is specificity.

   `:not()` contributes the specificity of its ARGUMENT. The Aurora field rule
   carried four type exclusions and scored (0,8,1); its `:focus` twin carried
   one and scored (0,6,1). `:focus` matched on every focused field in every
   converted app and the Hub-Blue ring never painted, because the resting rule
   won the cascade. Nothing was broken-looking enough to notice — the field
   simply had no focus state, for months.

   That is the whole class of defect: add an exclusion to a resting rule and
   its hover/focus/active twin silently stops applying. Impossible to catch by
   reading, trivial to catch by counting.

   The check pairs every state rule with resting rules that target the same
   thing (same scope root, same final element tag) and fails when the state
   rule cannot win. Validated against the real regression before shipping: it
   flags (0,6,1)-vs-(0,8,1) and clears the fixed (0,9,1).

   WHEN THIS FAILS: do not delete the resting rule's exclusions. Copy them onto
   the state selector so both sides score the same, then re-measure the state
   in a browser — matching a selector is not the same as painting. */
console.log("\nF. Aurora CSS state rules (specificity, not appearance)");
{
  const css = stripComments(fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8"), { lang: "css" });
  const STATES = [":focus-within", ":focus-visible", ":focus", ":hover", ":active", ":checked"];
  const TAGS = "input|textarea|select|button|a|summary|label";

  /** Selectors-4 specificity, with :is()/:not()/:where() folded in by counting
   *  their contents inline — :where() is 0 in the spec, but we do not use it
   *  in a way that matters here and over-counting it would only be stricter. */
  const spec = (s: string): [number, number, number] => [
    (s.match(/#[\w-]+/g) ?? []).length,
    (s.match(/\.[\w-]+/g) ?? []).length +
      (s.match(/\[[^\]]+\]/g) ?? []).length +
      (s.match(/:(?!:)(?!not\b)(?!is\b)(?!where\b)[a-z-]+/g) ?? []).length,
    (s.match(new RegExp(`(?<![\\w.\\-#\\[:])\\b(${TAGS})\\b`, "g")) ?? []).length,
  ];
  const wins = (a: [number, number, number], b: [number, number, number]) =>
    a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

  /* Split on TOP-LEVEL commas only. `:is(.kx-ai-form, .kx-pd, .kx-app)` is a
     comma list inside parentheses, and a naive `.split(",")` tears every scoped
     selector in the file into fragments — which then get their specificity
     counted on half a selector. The first version of this check did exactly
     that; it still caught the regression, but only because both sides happened
     to be torn the same way. */
  const splitTop = (group: string): string[] => {
    const out: string[] = [];
    let depth = 0, buf = "";
    for (const ch of group) {
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
      buf += ch;
    }
    out.push(buf);
    return out;
  };
  /* The BODY matters, not just the selector — and it matters PER PROPERTY.
     Specificity only decides between declarations of the same importance, so a
     state rule that shouts a property cannot be "outranked" on that property
     at any specificity. Reading the body as one boolean is not good enough and
     is actively dangerous: the field focus rule shouts `border-color` but
     leaves `box-shadow` quiet, so a rule-level flag would mark it safe while
     the RING — the whole point of the state — still silently loses. That is
     the original defect wearing a disguise.

     So: collect each declared property with its own importance, and compare
     only properties both rules actually set. Property names are matched
     exactly; a shorthand competing with a longhand (`background` vs
     `background-color`) is not modelled, which keeps the check from crying
     wolf at the cost of a gap worth remembering. */
  type Decl = Map<string, boolean>;
  const selectors: { sel: string; decls: Decl }[] = [];
  for (const [, group, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Decl = new Map();
    for (const [, prop, val] of (body ?? "").matchAll(/([-\w]+)\s*:([^;]*)/g)) {
      decls.set(prop!.trim(), /!\s*important/.test(val ?? ""));
    }
    for (const raw of splitTop(group!)) {
      const s = raw.trim().replace(/\s+/g, " ");
      if (s && !s.startsWith("@")) selectors.push({ sel: s, decls });
    }
  }
  /* Two rules can collide only if they can match the same element. Approximate
     that with (scope root, final target tag) — narrow enough that the guard
     does not cry wolf, which is the failure mode that gets a check ignored. */
  const key = (s: string) => {
    const parts = s.split(" ");
    const tag = new RegExp(`^(${TAGS})\\b`).exec(parts[parts.length - 1]!);
    return tag ? `${parts[0]}|${tag[1]}` : null;
  };
  const resting = selectors.filter((s) => !STATES.some((st) => s.sel.includes(st)));
  const stated = selectors.filter((s) => STATES.some((st) => s.sel.includes(st)));

  /* A resting rule that DELIBERATELY resets a region, and is expected to beat
     the chrome's state rules inside it. The A4 sheet is the only one: those
     fields are paper, and the owner asked for them "same as before" — no well,
     no ring, focused or not. Everything about it is intentional and measured
     (22 paper fields, all transparent with no box-shadow), so pairing it
     against the chrome focus rule is a true observation about a deliberate
     override rather than a defect. Keep this list to overrides you have
     actually looked at in a browser. */
  const DELIBERATE_REGION_RESET = [".quot-doc-inner", ".quot-a4-doc"];

  const losers: string[] = [];
  outer: for (const s of stated) {
    const k = key(s.sel);
    if (!k) continue;
    for (const r of resting) {
      if (key(r.sel) !== k) continue;
      if (DELIBERATE_REGION_RESET.some((c) => r.sel.includes(c) && !s.sel.includes(c))) continue;
      const specWins = wins(spec(s.sel), spec(r.sel));
      for (const [prop, sImp] of s.decls) {
        const rImp = r.decls.get(prop);
        if (rImp === undefined) continue;               // they do not compete on this one
        /* Cascade order: importance first, THEN specificity — and only for a
           property BOTH rules set. */
        if (sImp !== rImp ? sImp : specWins) continue;  // the state rule paints this property
        losers.push(`${s.sel}\n         loses "${prop}" to  ${r.sel}`);
        continue outer;
      }
    }
  }
  losers.length === 0
    ? ok("no state rule is outranked by its own resting rule", `${stated.length} state selectors`)
    : bad("state specificity", `${losers.length} rule(s) match but can never paint:\n       ${losers.join("\n       ")}`);
}

/** Filled by section G while the schema registry is in scope; read by K. */
const SCHEMA_SUBCATEGORY_CODES = new Set<string>();

/* ── G. Product-schema templates are fully trilingual ─────────────────────
   A NUMBER again: how many strings an operator can see that have no zh/ar.

   This is here because the failure is INVISIBLE. A missing key does not throw
   — `t()` falls back to English — so a Chinese or Arabic operator gets an
   English word in the middle of a translated form and nobody upstream ever
   finds out. Three separate variants of it were live at once on 2026-08-12:

     · 13 group keys written against the group ID while the form looks up the
       TITLE (`ts(\`g:${group.title}\`)`) — five shipped in the YILI batch
     · 63 option translations written into SPEC_NAME_I18N, which the form
       reads ONLY for `s:` keys, so none of them resolved
     · shared-group strings (`f:safety_features`, "Rated total power
       consumption.") missing once = English on all 28 templates at once

   All three are the same mistake — a key that exists but is never consulted —
   and reading the diff cannot catch any of them. Asserting against the live
   registry can, in a second.

   WHEN THIS FAILS: add the missing entry. Do NOT delete the description or
   drop the option to make it pass. And check the key you are about to reuse
   already MEANS what you think — `head_count` was frozen as "Detection Heads"
   long before someone needed it for press heads. */
console.log("\nG. Product-schema i18n (every operator-visible string)");
{
  const UI = SPEC_I18N as Record<string, Record<string, string> | undefined>;
  const DESC = SPEC_DESC_I18N as Record<string, Record<string, string> | undefined>;
  const NAME = SPEC_NAME_I18N as Record<string, Record<string, string> | undefined>;
  const LANGS = ["en", "zh", "ar"] as const;

  const gaps: string[] = [];
  /* en is not required on SPEC_DESC_I18N — the English IS the key there. */
  const need = (dict: typeof UI, key: string, langs: readonly string[]) => {
    const e = dict[key];
    if (!e) { gaps.push(key); return; }
    for (const l of langs) if (!e[l]?.trim()) gaps.push(`${key} (${l} empty)`);
  };

  const schemas = listSchemas();
  /* Section K runs after this block closes and cannot reach listSchemas, so the
     bound subcategory codes are captured here while they are in scope. */
  for (const sc of schemas) {
    const code = (sc as { subcategoryCode?: string }).subcategoryCode;
    if (code) SCHEMA_SUBCATEGORY_CODES.add(code);
  }
  let strings = 0;
  for (const s of schemas) {
    need(NAME, `s:${s.id}`, LANGS); strings++;
    for (const g of s.groups) {
      /* by TITLE, not id — this is the lookup SchemaSpecsSection performs */
      need(UI, `g:${g.title}`, LANGS); strings++;
      for (const f of g.fields) {
        need(UI, `f:${f.key}`, LANGS); strings++;
        if (f.description) { need(DESC, f.description, ["zh", "ar"]); strings++; }
        for (const o of f.options ?? []) { need(UI, `o:${o.value}`, LANGS); strings++; }
      }
    }
  }
  const unique = [...new Set(gaps)];
  unique.length === 0
    ? ok("every schema string has en/zh/ar", `${schemas.length} schemas, ${strings} strings`)
    : bad("schema i18n", `${unique.length} untranslated:\n       ${unique.slice(0, 25).join("\n       ")}` +
        (unique.length > 25 ? `\n       …and ${unique.length - 25} more` : ""));

  /* One key must not carry two meanings. o:single is already both "Single
     Phase" and "Single Head" in the two dictionaries; that is a known open
     item, so this reports rather than fails — but a NEW collision inside
     SPEC_I18N itself is a hard failure, because the last one loaded wins. */
  const src = fs.readFileSync(path.join(ROOT, "src/lib/product-schema/spec-i18n.ts"), "utf8");
  const mainBlock = src.slice(src.indexOf("export const SPEC_I18N"), src.indexOf("export const SPEC_NAME_I18N"));
  const seen = new Map<string, number>();
  for (const m of mainBlock.matchAll(/"((?:f|o|g):[^"]+)"\s*:/g)) seen.set(m[1]!, (seen.get(m[1]!) ?? 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  dupes.length === 0
    ? ok("no duplicate keys inside SPEC_I18N")
    : bad("duplicate i18n keys", `${dupes.join(", ")} — the later entry silently wins`);
}

/* ── H. Machine-Kind facets speak the governed vocabulary ─────────────────
   CL-0020 moved bed / feed / needle-count / duty off the subcategory shelf and
   onto `MachineKind.attributes`. That field is a free-form Record<string,string>,
   which is a fourth home for a vocabulary that already had three too many — and
   a free-form map does not fail on `bed` vs `bed_type`, or `heavy` vs `Heavy`.
   It just quietly stops matching, and the spec card it was supposed to trigger
   never appears.

   So the registry in src/lib/product-facets.ts is the only spelling allowed,
   and it mirrors facet-dictionary-master.md rather than inventing a parallel
   list. This asserts every kind against it.

   WHEN THIS FAILS: fix the spelling to match the dictionary. Add a facet only
   when a catalogue genuinely prints a distinction nothing else can carry — and
   mark it `proposed: true` until a CL entry confirms it. */
console.log("\nH. Machine-Kind facet vocabulary");
{
  const I18N = FACET_I18N as Record<string, Record<string, string> | undefined>;

  const badKeys: string[] = [], badValues: string[] = [], untranslated: string[] = [];
  let pairs = 0;
  for (const k of MACHINE_KINDS) {
    for (const [key, value] of Object.entries(k.attributes ?? {})) {
      pairs++;
      if (!(key in FACETS)) { badKeys.push(`${k.slug}: ${key}`); continue; }
      if (!isValidFacet(key, value)) badValues.push(`${k.slug}: ${key}="${value}"`);
      if (!I18N[`fk:${key}`]) untranslated.push(`fk:${key}`);
      /* open-vocabulary facets (application) are not enumerated, so their
         values are not expected to carry a label here */
      if (FACETS[key]!.values && !I18N[`fv:${value}`]) untranslated.push(`fv:${value}`);
    }
  }
  badKeys.length === 0
    ? ok("every facet key is in the registry", `${MACHINE_KINDS.length} kinds, ${pairs} facet pairs`)
    : bad("unknown facet key", [...new Set(badKeys)].join(", "));
  badValues.length === 0
    ? ok("every facet value is allowed")
    : bad("value not in the facet's list", [...new Set(badValues)].join(", "));
  const u = [...new Set(untranslated)];
  u.length === 0
    ? ok("every facet key and value has en/zh/ar")
    : bad("facet i18n", u.join(", "));

  /* A kind must be a preset of a stitch type, not of a configuration. If a
     doomed shelf ever reappears as someone's `subcategory`, catch it here. */
  const RETIRED = ["double-needle-machines", "multi-needle-machines", "heavy-duty-machines", "pattern-sewing-machines"];
  const relapsed = MACHINE_KINDS.filter((k) => RETIRED.includes(k.subcategory)).map((k) => k.slug);
  relapsed.length === 0
    ? ok("no kind filed under a retired configuration shelf")
    : bad("retired shelf", `${relapsed.join(", ")} — these describe a configuration, not a stitch (CL-0020)`);
}

/* ── I. One option value must not mean two things ─────────────────────────
   `SchemaSpecsSection` localises an option with `o:<value>`, so the key is the
   VALUE alone. Two different fields legitimately offer the same value — and
   when they mean different things, one of them renders the other's meaning.

   ENGLISH NEVER SHOWS IT. The schema's own `label` is the fallback, so the
   form looks correct in English while zh and ar carry the wrong word. Live
   examples found by this check, not by reading: a needle detector's
   `head_count: "single"` rendered as 单相 / "طور واحد" — single PHASE, borrowed
   from the lockstitch power field; a fusing machine's `fusing_type: "rotary"`
   as 旋梭 — rotary HOOK, a lockstitch part.

   The fix is a field-scoped key `o:<fieldKey>.<value>`, which the form reads
   first. It changes no stored value.

   A GATE THAT CRIES WOLF GETS IGNORED, so a collision passes if EITHER it is
   scoped, OR it is listed below as a case where the shared word is genuinely
   right for both fields ("Servo" vs "Servo Motor" is the same thing said twice,
   not two meanings). A NEW collision is in neither list and fails until someone
   decides which it is. */
console.log("\nI. Option-value collisions");
{
  const D = SPEC_I18N as Record<string, unknown>;

  /* Same concept, wordier on one field. The shared translation is correct for
     every owner, so scoping them would add keys and change nothing. */
  const SHARED_OK = new Set([
    "servo", "clutch", "manual", "semi_dry", "heavy", "denim", "wool", "standard",
    "large", "tubular", "woven", "mechanical", "anti_collision", "emergency_stop",
    "steam", "plaiter", "length_counter", "technical", "electric", "plc_touchscreen",
    "safety_valve", "delicate",
  ]);

  const labels = new Map<string, Set<string>>();
  const owners = new Map<string, Set<string>>();
  for (const s of listSchemas()) for (const g of s.groups) for (const f of g.fields) {
    for (const o of f.options ?? []) {
      if (!labels.has(o.value)) { labels.set(o.value, new Set()); owners.set(o.value, new Set()); }
      labels.get(o.value)!.add(o.label);
      owners.get(o.value)!.add(f.key);
    }
  }
  const unclassified: string[] = [];
  let collisions = 0, scoped = 0;
  for (const [value, ls] of labels) {
    if (ls.size < 2) continue;
    collisions++;
    if (SHARED_OK.has(value)) continue;
    /* every owning field must have its own key once the word means two things */
    const missing = [...owners.get(value)!].filter((fk) => !D[`o:${fk}.${value}`]);
    if (missing.length === 0) { scoped++; continue; }
    unclassified.push(`"${value}" (${[...ls].join(" | ")}) — no o:<field>.${value} for: ${missing.join(", ")}`);
  }
  unclassified.length === 0
    ? ok("every colliding value is scoped or declared shared",
         `${collisions} collisions: ${scoped} scoped, ${collisions - scoped} shared-by-design`)
    : bad("unclassified option collision",
          `${unclassified.length} value(s) mean two things with no field-scoped key:\n       ${unclassified.join("\n       ")}`);
}

/* ── J. Authorization inputs ───────────────────────────────────────────────
   Added 2026-08-13 after `dashboard_role` turned out to gate cost prices,
   bank balances and profit while being read from `accounts.preferences` — a
   value the user wrote themselves through an unchecked PATCH. The audit that
   followed found no second instance, and these two rules are what keep it
   that way. Neither is a style rule; both encode a hole that was live.

   J1. Nothing may make an authorization decision from accounts.preferences.
       The fix had to land on the READ, not the write: there are two writers
       (/api/me/preferences, since removed, and /api/accounts/[id]/preferences,
       which legitimately merges Settings slices), so closing one writer would
       have left the hole open through the other.

   J2. Every AI tool must declare requiredModule. tool-registry only calls
       checkModule() when the tool declares one — a tool without it runs
       ungated. 41 of 42 declare one; getUserPermissions is the documented
       exception because it returns the CALLER'S OWN permission grid. */
console.log("\nJ. Authorization inputs");
{
  const expSrc = fs.readFileSync(path.join(ROOT, "src/lib/experience/index.ts"), "utf8");
  const readsPrefs = /\bprefs\b|preferences\s*\./.test(
    expSrc.slice(expSrc.indexOf("export async function getUserExperience")));
  readsPrefs
    ? bad("getUserExperience reads preferences",
          "cost/bank/profit/approving must come from Roles & Permissions only (src/lib/experience) — never a preference")
    : ok("no authorization decision reads accounts.preferences", "visibility comes from Roles & Permissions");

  const toolsDir = path.join(ROOT, "src/lib/server/ai-agent/tools");
  const TOOL_NO_MODULE_OK = new Set(["getUserPermissions"]);
  const undeclared: string[] = [];
  let toolCount = 0;
  for (const file of fs.readdirSync(toolsDir).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(toolsDir, file), "utf8");
    const names = [...src.matchAll(/^\s*name:\s*"([^"]+)"/gm)].map((m) => m[1]);
    const declared = (src.match(/^\s*requiredModule:/gm) ?? []).length;
    toolCount += names.length;
    const gap = names.length - declared;
    if (gap > 0) {
      const unexplained = names.filter((n) => !TOOL_NO_MODULE_OK.has(n));
      if (unexplained.length >= gap) undeclared.push(`${file}: ${unexplained.slice(0, gap).join(", ")}`);
    }
  }
  undeclared.length === 0
    ? ok("every AI tool declares requiredModule", `${toolCount} tools, ${TOOL_NO_MODULE_OK.size} documented exception`)
    : bad("AI tool runs ungated",
          `tool-registry only calls checkModule() when requiredModule is set:\n       ${undeclared.join("\n       ")}`);
}

/* ── K. The Knowledge coding system mirrors the live taxonomy ──────────────
   OWNER RULE (2026-08-13): "any new code has to be added to the coding system
   in the Knowledge app also — this is a rule."

   It was already broken when the rule was stated: NINE subcategory codes were
   live in the taxonomy and absent from Knowledge (XSZ, XSBL, XAPT, XFAS, XFSS,
   XPHR, XPSC, XAS, XAT), three whole categories were missing, and two dead
   codes were still being taught — XSD/XSM, which CL-0020 turned into the
   needle_count attribute, plus XPRH, which CL-0021 recoded to XPHR and which
   appeared TWICE in the page with two different meanings.

   This gate compares the codes rendered by the Knowledge page against the ones
   the schema registry and facet layer know about. It cannot read the database
   (no network in the build), so it uses the shipped taxonomy constants as the
   reference — which is exactly the set a developer edits when they mint a code.
   A code that exists in one and not the other fails the build. */
console.log("\nK. Knowledge coding system vs the taxonomy");
{
  const kbPath = path.join(ROOT, "src/components/knowledge/product-coding/data.ts");
  const kb = fs.readFileSync(kbPath, "utf8");
  const kbCodes = new Set([...kb.matchAll(/\{ code: "(X[A-Z]{2,4})", label:/g)].map((m) => m[1]));

  /* Every subcategoryCode a schema binds to must be teachable. */
  const schemaCodes = SCHEMA_SUBCATEGORY_CODES;
  const untaught = [...schemaCodes].filter((c) => !kbCodes.has(c));
  untaught.length === 0
    ? ok("every code with a spec template is in the Knowledge coding system", `${schemaCodes.size} codes`)
    : bad("code has a spec template but is not taught in Knowledge",
          `${untaught.join(", ")} — add it to src/components/knowledge/product-coding/data.ts (owner rule)`);

  /* Retired shelves must not be taught as if they were still types. */
  /* XSD/XSM/XPRH were DELETED or recoded — they must not appear at all.
     XSH/XSS still exist as rows because their tokens hold live product codes
     (KOLEEX codes are never recycled), so they may be taught ONLY while the
     label says so — otherwise someone files a new machine under a dead shelf. */
  const GONE = ["XSD", "XSM", "XPRH"];
  const RETIRED_MUST_SAY_SO = ["XSH", "XSS"];
  const zombies = [
    ...GONE.filter((c) => kbCodes.has(c)),
    ...RETIRED_MUST_SAY_SO.filter((c) => {
      const row = kb.match(new RegExp(`\\{ code: "${c}", label: "([^"]*)"`));
      return kbCodes.has(c) && !/retired/i.test(row?.[1] ?? "");
    }),
  ];
  zombies.length === 0
    ? ok("no retired code is taught as live", `${GONE.length + RETIRED_MUST_SAY_SO.length} checked`)
    : bad("retired code still in the Knowledge coding system",
          `${zombies.join(", ")} — these were removed or recoded by CL-0020/CL-0021`);
}

/* ── J. The Koleex AI app's own weight ─────────────────────────────────────
   Section B reads a route's client-reference manifest, and /ai mounts its
   app through next/dynamic — so B measured the shell and never the app
   (deep check, 2026-09-24: 434 KB "for /ai" while the app itself was a
   further 372 KB nobody watched). The app chunk is found by a string only it
   contains; the markdown renderer must stay OUT of it (lazy since the deep
   check), and its size has a ceiling. Measured 115 KB after the deep check;
   the ceiling is that plus ~12%. */
console.log("\nJ. Koleex AI app chunk");
{
  const dir = path.join(NEXT, "static", "chunks");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")) : [];
  const app = files.filter((f) => fs.readFileSync(path.join(dir, f), "utf8").includes("koleex-ai-conversations-cache-v3"));
  if (app.length === 0) {
    bad("Koleex AI app chunk", "not found — did the cache key or the build move?");
  } else {
    const bytes = app.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    const MAX_KB = 130;
    kb(bytes) <= MAX_KB
      ? ok(`ai app: ${app.length} chunk(s) / ${kb(bytes)} KB`, `budget ${MAX_KB} KB`)
      : bad(`ai app: ${app.length} chunk(s) / ${kb(bytes)} KB`, `budget ${MAX_KB} KB`);
    const withMarkdown = app.filter((f) => /remark-gfm|micromark/.test(fs.readFileSync(path.join(dir, f), "utf8")));
    withMarkdown.length === 0
      ? ok("the markdown renderer is not in the app chunk", "lazy — loads with the first reply")
      : bad("the markdown renderer is back in the app chunk", withMarkdown.join(", "));
  }
}

console.log(`\n${fail === 0 ? "✓" : "✗"} budgets: ${pass} passed, ${fail} failed`);
if (fail > 0 && !REPORT_ONLY) {
  console.error("\nDo NOT raise a budget to make this pass. Find what was added.\n" +
    "Raise it only with a measurement and a reason in the commit message.");
  process.exit(1);
}
