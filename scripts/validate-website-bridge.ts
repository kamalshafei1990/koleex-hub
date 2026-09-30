/* ---------------------------------------------------------------------------
   validate:website-bridge — the Hub ↔ website bridge (27/09/2026).

   The bridge is the one place Hub data leaves for a public audience, so the
   rules that keep it safe are pinned here rather than remembered:
     · every /api/website/v1 route opens with the shared-key check, and the
       bridge is inert (503) until a key is configured;
     · only ACTIVE + VISIBLE products of the host company, never a price, a
       cost, a supplier, an MOQ or an HS code — not in a selected column, and
       not in a product page (loader audience "public" + scrubForWebsite);
     · job postings go out without the salary;
     · every Hub write that changes what the website shows asks it to refresh
       (revalidateWebsite), and that ask is inert until both env vars exist;
     · a failed read is an error, never a partial or "not found" answer —
       the website keeps what it is handed for an hour (30/09/2026).
   --------------------------------------------------------------------------- */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./lib/strip-comments";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}
const code = (p: string) => stripComments(readFileSync(p, "utf8"));
/* A function's body, from its own name to the next function's. Markers are
   code, never comments — stripComments removes those, and a missing marker
   (-1) would silently widen the slice to the end of the file. */
function between(src: string, from: string, to: string | null): string {
  const a = src.indexOf(from);
  const b = to === null ? src.length : src.indexOf(to, a + 1);
  if (a < 0 || b < 0) { failures.push(`marker missing: ${a < 0 ? from : to}`); console.log(`  ✗ marker missing: ${a < 0 ? from : to}`); return ""; }
  return src.slice(a, b);
}

const BRIDGE = "src/lib/server/website-bridge.ts";
const CATALOG = "src/lib/server/website-catalog.ts";
const ROUTES = "src/app/api/website/v1";
const DETAIL = "src/lib/server/product-detail.ts";

/* ── 1. The key check and the inert default ── */
console.log("\n1. Shared key, inert until configured");
const bridge = code(BRIDGE);
check("the key is compared in constant time", /timingSafeEqual\(given, expected\)/.test(bridge));
check("no key configured → 503, never an open door", /if \(!key\) return bridgeJson\(\{[^}]*\}, 503\)/.test(bridge));
check("a wrong key → 401", /bridgeJson\(\{ error: "Unauthorized" \}, 401\)/.test(bridge));
check("answers are never cached by a CDN", /"Cache-Control": "no-store"/.test(bridge));
check("the refresh ask is inert without both env vars", /if \(!url \|\| !key \|\| tags\.length === 0\) return;/.test(bridge));
check("the refresh runs after the response (after), with a timeout", /after\(run\)/.test(bridge) && /AbortSignal\.timeout\(\d+\)/.test(bridge));
check("the refresh logs tags and timing, never data", !/console\.[a-z]+\([^)]*JSON\.stringify/.test(bridge));
check("the host company is the only tenant (is_host)", /\.eq\("is_host", true\)/.test(bridge));

/* ── 2. Every route ── */
console.log("\n2. Every /api/website/v1 route");
const routeFiles: string[] = [];
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "route.ts") routeFiles.push(p);
  }
})(ROUTES);
check("the bridge has its 7 routes", routeFiles.length === 7);
for (const f of routeFiles) {
  const src = code(f);
  const rel = f === join(ROUTES, "route.ts") ? "(index)" : f.replace(`${ROUTES}/`, "").replace("/route.ts", "");
  const gate = src.indexOf("requireWebsiteBridge(req)");
  const firstData = Math.min(...["supabaseServer", "listWebsite", "websiteTaxonomy", "websitePage", "websiteProductId", "loadPublicSchemaProduct", "websiteTenantId()"].map((k) => { const i = src.indexOf(k, gate + 1); return i < 0 ? Infinity : i; }));
  check(`${rel}: opens with the key check, before any read`, gate >= 0 && /if \(denied\) return denied;/.test(src) && gate < firstData);
  check(`${rel}: reads only (GET)`, /export async function GET\(/.test(src) && !/export async function (POST|PUT|PATCH|DELETE)\(/.test(src));
  check(`${rel}: never touches the database directly`, !/supabaseServer/.test(src));
}

/* ── 3. What a visitor may see ── */
console.log("\n3. Products: active, visible, host company, no price");
const catalog = code(CATALOG);
const FORBIDDEN = /(price|cost|supplier|moq|hs_code|reference_model|margin|internal|salary)/i;
const selects = Array.from(catalog.matchAll(/\.select\(\s*(["'`])([\s\S]*?)\1/g)).map((m) => m[2]);
const listCols = /const LIST_COLUMNS = "([^"]+)"/.exec(catalog)?.[1] ?? "";
check("the list columns carry nothing internal", !!listCols && !FORBIDDEN.test(listCols));
check("no selected column anywhere is internal", selects.length >= 10 && selects.every((s) => !FORBIDDEN.test(s)));
const listFn = between(catalog, "export async function listWebsiteProducts", "async function productCards");
check("the list is the host company's, active and visible", /\.eq\("tenant_id", tenantId\)/.test(listFn) && /\.eq\("status", "active"\)/.test(listFn) && /\.eq\("visible", true\)/.test(listFn));
const idFn = between(catalog, "export async function websiteProductId", "export async function websiteTaxonomy");
check("a product page is the host company's, active and visible", /\.eq\("tenant_id", tenantId\)/.test(idFn) && /\.eq\("status", "active"\)/.test(idFn) && /\.eq\("visible", true\)/.test(idFn));
const taxFn = between(catalog, "export async function websiteTaxonomy", "export async function listWebsitePages");
check("taxonomy counts only what the website shows", /\.eq\("status", "active"\)\.eq\("visible", true\)/.test(taxFn));
check("taxonomy counts every product, paged (not the first 1000)", /allRowsOrThrow<TallyRow>\("website taxonomy"/.test(taxFn) && !/\.limit\(\d+\)/.test(taxFn));
check("search text is stripped of PostgREST wildcards and separators", /replace\(\/\[\^\\p\{L\}\\p\{N\}\\s-\]\/gu/.test(catalog));
const searchFn = between(catalog, "async function searchHits", "export async function listWebsiteProducts");
check("search matches every word on its own, in the product, its models and its translations",
  new Set((/for \(const w of words\) \{\n([\s\S]*?)\n  \}/.exec(searchFn)?.[1] ?? "").match(/(\w+) = \1\.ilike\("search_text", `%\$\{w\}%`\)/g) ?? []).size === 3
  && /from\("products"\)/.test(searchFn) && /from\("product_models"\)/.test(searchFn) && /from\("product_translations"\)/.test(searchFn));
check("a search hit is the host company's, active and visible — direct or via a model/translation",
  (searchFn.match(/\.eq\("tenant_id", tenantId\)\.eq\("status", "active"\)\.eq\("visible", true\)/g) ?? []).length === 2);
check("model/translation hits are checked in chunks (no URL of thousands of ids)", /inChunks<Hit>\(extra,/.test(searchFn));
check("a hidden or discontinued model never makes a product findable", /\.eq\("visible", true\)\.or\("status\.is\.null,status\.neq\.discontinued"\)/.test(searchFn));
check("the website never reads a supplier table (a supplier's name or code finds nothing)", !/from\("(product_suppliers|contacts|suppliers|supplier_[a-z_]+)"\)/.test(catalog));
const allRowsSrc = code("src/lib/server/all-rows.ts");
check("reads that must see every row page past the API's 1000-row cap (lib/server/all-rows)",
  /import \{ allRowsOrThrow \} from "@\/lib\/server\/all-rows";/.test(catalog) && !/const API_PAGE/.test(catalog)
  && /export const API_PAGE = 1000;/.test(allRowsSrc) && /if \(rows\.length < size\) return \{ data: out, error: null \};/.test(allRowsSrc));
check("the last-line scrub drops price, cost, supplier, MOQ, HS code, FOB and tenant keys",
  /const INTERNAL_KEY = \/\(price\|cost\|supplier\|moq\|margin\|hs_\?code\|fob\|tenant\)\/i;/.test(catalog));
const detailRoute = code(join(ROUTES, "products/[slug]/route.ts"));
check("a product page goes through the host/active/visible gate first", /websiteProductId\(slug\)/.test(detailRoute));
check("a product page uses the loader's PUBLIC audience, read strictly", /loadPublicSchemaProduct\(id, \{ audience: "public", strict: true \}\)/.test(detailRoute));
check("a product page is scrubbed before it leaves", /scrubForWebsite\(product\)/.test(detailRoute));
const detail = code(DETAIL);
check("the public audience is not a price audience", /PRICE_AUDIENCES[^=]*= new Set\(\["internal", "customer"\]\)/.test(detail));

console.log("\n4. Pages and careers");
const pageFn = between(catalog, "export async function websitePage(", "export async function listWebsiteJobs");
check("only visible sections and elements", (pageFn.match(/\.eq\("visible", true\)/g) ?? []).length === 2);
const jobsFn = between(catalog, "export async function listWebsiteJobs", null);
check("only open postings that have not closed", /\.in\("status", \["open", "published"\]\)/.test(jobsFn) && /closes_at\.is\.null,closes_at\.gte\./.test(jobsFn));
check("no salary goes out", !/salary/.test(jobsFn));

/* ── 5. The Hub asks the website to refresh ── */
console.log("\n5. Writes that change the website refresh it");
const HOOKS: Array<[string, number, string]> = [
  ["src/app/api/products/route.ts", 1, "products"],
  ["src/app/api/products/[id]/route.ts", 2, "products"],
  ["src/app/api/product-media/route.ts", 1, "products"],
  ["src/app/api/product-media/[id]/route.ts", 2, "products"],
  ["src/app/api/products/[id]/media/route.ts", 1, "products"],
  ["src/app/api/products/[id]/media/[mediaId]/route.ts", 2, "products"],
  ["src/app/api/product-translations/route.ts", 1, "products"],
  ["src/app/api/product-translations/[id]/route.ts", 1, "products"],
  ["src/app/api/products/[id]/translations/route.ts", 1, "products"],
  ["src/app/api/product-models/route.ts", 1, "products"],
  ["src/app/api/product-models/[id]/route.ts", 2, "products"],
  ["src/app/api/product-templates/[slug]/values/[productId]/route.ts", 1, "products"],
  ["src/app/api/product-options/route.ts", 2, "products"],
  ["src/app/api/products/brands/route.ts", 2, "products"],
  ["src/app/api/products/attributes/route.ts", 2, "products"],
  ["src/app/api/taxonomy/[kind]/route.ts", 1, "taxonomy"],
  ["src/app/api/taxonomy/[kind]/[rowId]/route.ts", 2, "taxonomy"],
  ["src/app/api/products/save-cost-from-quotation/route.ts", 1, "products"],
  ["src/app/api/hr/data/route.ts", 1, "jobs"],
];
for (const [file, n, tag] of HOOKS) {
  const src = existsSync(file) ? code(file) : "";
  const calls = src.match(/revalidateWebsite\(\[[^\]]*\]\)/g) ?? [];
  check(`${file.replace("src/app/api/", "")}: ${n} refresh call(s) with "${tag}"`, calls.length === n && calls.every((c) => c.includes(`"${tag}"`)));
}
/* The sweep: any API route that writes a table the website shows must ask it
   to refresh, or be named here with the reason it doesn't. A new write route
   fails this check until it does one or the other. */
const SHOWN = ["products", "product_media", "product_models", "product_translations", "product_options", "product_option_values", "divisions", "categories", "subcategories", "hr_job_postings"];
const NOT_SHOWN: Record<string, string> = {
  /* "<route file>": "why the website never shows what it writes", */
};
const writesShown = new RegExp(`from\\(\\s*"(${SHOWN.join("|")})"\\s*\\)\\s*\\.(update|insert|upsert|delete)\\(`);
const apiFiles: string[] = [];
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "route.ts") apiFiles.push(p);
  }
})("src/app/api");
const unhooked = apiFiles.filter((f) => {
  const src = code(f);
  return writesShown.test(src) && !/revalidateWebsite\(\[/.test(src) && !NOT_SHOWN[f];
});
check(`every route that writes what the website shows refreshes it${unhooked.length ? ` — missing: ${unhooked.join(", ")}` : ""}`, apiFiles.length > 100 && unhooked.length === 0);
check("each exemption still writes a shown table (no stale excuses)", Object.keys(NOT_SHOWN).every((f) => existsSync(f) && writesShown.test(code(f))));
const hr = code("src/app/api/hr/data/route.ts");
check("hr/data refreshes only for job postings, only on a write", /if \(q\.op !== "select" && q\.table === "hr_job_postings"\) revalidateWebsite\(\["jobs"\]\)/.test(hr));

/* ── 6. A failed read is an error, never a partial answer ── */
console.log("\n6. A failed read never goes out as a partial answer");
const loaderFn = between(detail, "export async function loadPublicSchemaProduct(", null);
const fetchFn = between(detail, "async function fetchProduct(", "function failOnReadError(");
check("the loader's strict reading throws on any failed read (lib/server/product-detail failOnReadError)",
  /function failOnReadError\([^)]*\): void \{\s*const bad = results\.find\(\(r\) => r\.error\);\s*if \(bad\?\.error\) throw new Error/.test(detail));
check("strict covers the product itself, by slug and by id", (fetchFn.match(/if \(strict\) failOnReadError\(\[(bySlug|byId)\], "product"\);/g) ?? []).length === 2);
check("strict covers the eight reads of a product page before any is used",
  /const reads = await Promise\.all\(\[/.test(loaderFn)
  && /\]\);\s*if \(strict\) failOnReadError\(reads, "product detail"\);\s*const \[\{ data: subcat \}[^\]]*\] = reads;/.test(loaderFn));
check("strict covers the options and the compare band's photos",
  /if \(strict\) failOnReadError\(\[optionValueRead\], "product options"\);/.test(loaderFn) && /if \(strict\) failOnReadError\(\[sibRead\], "product siblings"\);/.test(loaderFn));
check("a failed product lookup throws (never read as \"not found\")", /const \{ data, error \} = await supabaseServer/.test(idFn) && /if \(error\) throw new Error\(`website product: /.test(idFn));
check("a site page's three reads throw when they fail",
  ["pageError", "sectionError", "elementError"].every((e) => new RegExp(`if \\(${e}\\) throw new Error`).test(pageFn)));
check("the careers' department read throws when it fails", /if \(deptError\) throw new Error/.test(jobsFn));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
