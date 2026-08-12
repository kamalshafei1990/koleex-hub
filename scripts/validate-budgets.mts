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
 * Run: npm run build && node --import tsx scripts/validate-budgets.mts
 *      node --import tsx scripts/validate-budgets.mts --report   (print, never fail)
 *
 * WHEN A BUDGET FAILS: do not raise the number to make it pass. Find what was
 * added. Raise a budget only with a measurement and a reason in the commit —
 * a budget that drifts upward on every commit is not a budget.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

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
  "home": { chunks: 10, kbytes: 560 },
  "accounts": { chunks: 12, kbytes: 880 },
  "ai": { chunks: 10, kbytes: 508 },
  "calendar": { chunks: 12, kbytes: 824 },
  "catalogs": { chunks: 15, kbytes: 1124 },
  "commercial-policy": { chunks: 11, kbytes: 665 },
  "contacts": { chunks: 10, kbytes: 508 },
  "crm": { chunks: 10, kbytes: 514 },
  "customers": { chunks: 10, kbytes: 515 },
  "database": { chunks: 11, kbytes: 549 },
  "discuss": { chunks: 10, kbytes: 508 },
  "documents": { chunks: 10, kbytes: 514 },
  "employees": { chunks: 12, kbytes: 851 },
  "expenses": { chunks: 13, kbytes: 722 },
  "finance": { chunks: 14, kbytes: 999 },
  "hr": { chunks: 14, kbytes: 1136 },
  "inbox": { chunks: 12, kbytes: 839 },
  "inventory": { chunks: 13, kbytes: 675 },
  "invoices": { chunks: 10, kbytes: 514 },
  "issues": { chunks: 12, kbytes: 712 },
  "knowledge": { chunks: 11, kbytes: 520 },
  "landed-cost": { chunks: 11, kbytes: 577 },
  "management": { chunks: 12, kbytes: 983 },
  "markets": { chunks: 11, kbytes: 772 },
  "notes": { chunks: 10, kbytes: 513 },
  "planning": { chunks: 10, kbytes: 514 },
  "price-calculator": { chunks: 12, kbytes: 803 },
  "product-data": { chunks: 12, kbytes: 796 },
  "products": { chunks: 12, kbytes: 791 },
  "projects": { chunks: 10, kbytes: 514 },
  "purchase": { chunks: 11, kbytes: 549 },
  "quotations": { chunks: 13, kbytes: 880 },
  "roles": { chunks: 12, kbytes: 816 },
  "sales": { chunks: 12, kbytes: 810 },
  "settings": { chunks: 14, kbytes: 1071 },
  "software-center": { chunks: 10, kbytes: 551 },
  "suppliers": { chunks: 10, kbytes: 515 },
  "todo": { chunks: 12, kbytes: 964 },
  "translator": { chunks: 11, kbytes: 595 },
  "website": { chunks: 10, kbytes: 531 },
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
  /* EVERY built app route must carry a budget. This is the part that answers
     the owner's actual worry — a NEW app cannot ship unwatched, because the
     build stops until someone measures it and writes the number down. Adding
     the line is thirty seconds; discovering the regression six months later
     costs what this whole session cost. */
  console.log(`  ${active.length} built app routes, ${Object.keys(ROUTE_BUDGETS).length} budgeted`);
  unbudgeted.length === 0
    ? ok("every app route has a budget", `${active.length} routes`)
    : bad("unbudgeted app routes", `${unbudgeted.join(", ")} — run \`npm run budgets\` to read their measured size, then add a line to ROUTE_BUDGETS (measured + ~12%)`);
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
const BOOT_DOC_HOME_MAX_KB = 1160;  // measured: home 15 files / 1055 KB
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
  /* Home is the entry every single user pays, every session — it gets its own
     tighter line so it cannot drift up under cover of the global ceiling. */
  const home = rows.find((r) => r.route === "home");
  if (!home) bad("home document", "no prerendered home.html — did the route move?");
  else home.kb <= BOOT_DOC_HOME_MAX_KB
    ? ok("home boot document", `${home.files} files / ${home.kb} KB ≤ ${BOOT_DOC_HOME_MAX_KB} KB`)
    : bad("home boot document", `${home.files} files / ${home.kb} KB > ${BOOT_DOC_HOME_MAX_KB} KB — every session pays this`);
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
  const cardBody = cardStart < 0 ? "" : pl.slice(cardStart, cardEnd > 0 ? cardEnd : undefined);
  if (cardStart < 0) bad("card", "ProductCard not found — did it move or get renamed?");
  !cardBody.includes("animate-pulse")
    ? ok("card reserves space without animating")
    : bad("card placeholder", "ProductCard contains animate-pulse — reserve the height, draw nothing");
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
  const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
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
  const selectors: string[] = [];
  for (const [, group] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const raw of splitTop(group!)) {
      const s = raw.trim().replace(/\s+/g, " ");
      if (s && !s.startsWith("@")) selectors.push(s);
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
  const resting = selectors.filter((s) => !STATES.some((st) => s.includes(st)));
  const stated = selectors.filter((s) => STATES.some((st) => s.includes(st)));

  const losers: string[] = [];
  for (const s of stated) {
    const k = key(s);
    if (!k) continue;
    for (const r of resting) {
      if (key(r) !== k) continue;
      if (!wins(spec(s), spec(r))) {
        losers.push(`${s}\n         is outranked by  ${r}`);
        break;
      }
    }
  }
  losers.length === 0
    ? ok("no state rule is outranked by its own resting rule", `${stated.length} state selectors`)
    : bad("state specificity", `${losers.length} rule(s) match but can never paint:\n       ${losers.join("\n       ")}`);
}

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
  /* Resolved at runtime, like the other validators that reach into src/:
     a literal "…/x.ts" specifier fails `tsc` unless allowImportingTsExtensions
     is on, and turning that on for one line is not worth it. */
  const { listSchemas } = await import(
    path.resolve(__dirname, "../src/lib/product-schema/index.ts")
  ) as typeof import("../src/lib/product-schema/index.js");
  const { SPEC_I18N, SPEC_DESC_I18N, SPEC_NAME_I18N } = await import(
    path.resolve(__dirname, "../src/lib/product-schema/spec-i18n.ts")
  ) as typeof import("../src/lib/product-schema/spec-i18n.js");
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

console.log(`\n${fail === 0 ? "✓" : "✗"} budgets: ${pass} passed, ${fail} failed`);
if (fail > 0 && !REPORT_ONLY) {
  console.error("\nDo NOT raise a budget to make this pass. Find what was added.\n" +
    "Raise it only with a measurement and a reason in the commit message.");
  process.exit(1);
}
