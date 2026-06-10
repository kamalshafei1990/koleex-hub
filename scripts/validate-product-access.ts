#!/usr/bin/env tsx

/* ===========================================================================
   P0-A — product API access validator (static source assertions).

   product-access.ts is `server-only`, so this validator asserts on FILE
   CONTENT rather than imports:
     1. Public column projections exclude every secret field.
     2. SECRET field lists contain the expected entries.
     3. EVERY write handler (POST/PATCH/PUT/DELETE) in every product API
        route is gated: body contains requireAuth AND a Product Data gate
        (hasProductDataAccess or requireModuleAccess).
     4. The taxonomy routes use a kind whitelist (no raw table name from URL).
     5. list-view only exposes suppliers behind canSeeSecrets.
     6. search escapes ilike wildcards.
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

/* ── 1+2. projections + secret lists ─────────────────────────────────── */
const access = read("src/lib/server/product-access.ts");

function extractArray(src: string, name: string): string {
  const start = src.indexOf(`export const ${name}`);
  if (start < 0) return "";
  // Slice from the array literal's "[" (after "=") to its closing "]" so the
  // "]" inside a `readonly string[]` type annotation doesn't end the slice.
  const open = src.indexOf("[", src.indexOf("=", start));
  const end = src.indexOf("]", open);
  return src.slice(open, end);
}
const pubProduct = extractArray(access, "PUBLIC_PRODUCT_COLUMNS");
const pubModel = extractArray(access, "PUBLIC_MODEL_COLUMNS");
const secretProduct = extractArray(access, "SECRET_PRODUCT_FIELDS");
const secretModel = extractArray(access, "SECRET_MODEL_FIELDS");

check("PUBLIC_MODEL_COLUMNS excludes cost_price", !pubModel.includes("cost_price"));
check("PUBLIC_MODEL_COLUMNS excludes supplier", !/"supplier"/.test(pubModel));
check("PUBLIC_MODEL_COLUMNS excludes moq", !/"moq"/.test(pubModel));
check("PUBLIC_PRODUCT_COLUMNS excludes hs_code", !pubProduct.includes("hs_code"));
check("PUBLIC_PRODUCT_COLUMNS excludes moq", !/"moq"/.test(pubProduct));
check("SECRET_MODEL_FIELDS lists cost_price + supplier + moq",
  secretModel.includes("cost_price") && secretModel.includes("supplier") && secretModel.includes("moq"));
check("SECRET_PRODUCT_FIELDS lists hs_code + moq",
  secretProduct.includes("hs_code") && secretProduct.includes("moq"));

/* ── 3. every write handler is gated ─────────────────────────────────── */
const WRITE_ROUTES = [
  "src/app/api/products/route.ts",
  "src/app/api/products/[id]/route.ts",
  "src/app/api/products/[id]/media/route.ts",
  "src/app/api/products/[id]/media/[mediaId]/route.ts",
  "src/app/api/products/[id]/related/route.ts",
  "src/app/api/products/[id]/translations/route.ts",
  "src/app/api/products/[id]/market-prices/route.ts",
  "src/app/api/products/[id]/sewing-specs/route.ts",
  "src/app/api/products/brands/route.ts",
  "src/app/api/products/attributes/route.ts",
  "src/app/api/product-models/route.ts",
  "src/app/api/product-models/[id]/route.ts",
  "src/app/api/taxonomy/[kind]/route.ts",
  "src/app/api/taxonomy/[kind]/[rowId]/route.ts",
];

const WRITE_METHODS = ["POST", "PATCH", "PUT", "DELETE"] as const;

for (const route of WRITE_ROUTES) {
  const src = read(route);
  /* Split the file at each exported handler; the body of handler N is the
     text up to handler N+1. Gate helpers defined at module level (gate(),
     gatePD(), gateProductData()) count when the body calls them. */
  const matches = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)];
  for (let i = 0; i < matches.length; i++) {
    const method = matches[i][1];
    if (!(WRITE_METHODS as readonly string[]).includes(method)) continue;
    const bodyStart = matches[i].index ?? 0;
    const bodyEnd = i + 1 < matches.length ? (matches[i + 1].index ?? src.length) : src.length;
    const body = src.slice(bodyStart, bodyEnd);
    const gated =
      (/requireAuth\(\)/.test(body) &&
        (/hasProductDataAccess\(/.test(body) || /requireModuleAccess\(/.test(body))) ||
      /await gate(PD|ProductData)?\(/.test(body); // delegated to a module-level gate
    check(`${route} ${method} is auth+PD gated`, gated);
    if (/await gate(PD|ProductData)?\(/.test(body)) {
      check(
        `${route} module gate calls requireAuth + PD check`,
        /requireAuth\(\)/.test(src) &&
          (/hasProductDataAccess\(/.test(src) || /requireModuleAccess\(/.test(src)),
      );
    }
  }
}

/* ── 4. taxonomy whitelist ───────────────────────────────────────────── */
for (const f of ["src/app/api/taxonomy/[kind]/route.ts", "src/app/api/taxonomy/[kind]/[rowId]/route.ts"]) {
  const src = read(f);
  check(`${f} uses TAXONOMY_KINDS whitelist`,
    src.includes("TAXONOMY_KINDS") && src.includes("divisions") && src.includes(".includes("));
}

/* ── 5. list-view supplier gating ────────────────────────────────────── */
const listView = read("src/app/api/products/list-view/route.ts");
check("list-view selects supplier column only when canSeeSecrets",
  /canSeeSecrets\s*\?\s*`product_id, supplier/.test(listView));
check("list-view populates suppliers only behind canSeeSecrets",
  /canSeeSecrets && row\.supplier/.test(listView));

/* ── 6. search escapes ilike wildcards ───────────────────────────────── */
const search = read("src/app/api/products/search/route.ts");
check("search escapes % and _ in query", /replace\(\/\[%_\]\/g/.test(search));

/* ── 7. P0-B client direct-access guard ──────────────────────────────────
   No client-bundle file (under src/, not under src/app/api/, NOT marked
   `import "server-only"`) may call `.from("<product master table>")`.
   Server-only files + API routes legitimately use the service-role client. */
const FORBIDDEN_TABLES = [
  "products", "product_models", "product_media", "related_products",
  "product_translations", "model_translations", "product_market_prices",
  "product_sewing_specs", "divisions", "categories", "subcategories",
];
const fromRe = new RegExp(`\\.from\\(\\s*["'\`](${FORBIDDEN_TABLES.join("|")})["'\`]`);

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
}

const srcFiles: string[] = [];
walk(join(ROOT, "src"), srcFiles);
const offenders: string[] = [];
for (const full of srcFiles) {
  const rel = relative(ROOT, full).replace(/\\/g, "/");
  if (rel.startsWith("src/app/api/")) continue;          // API routes = server
  const src = readFileSync(full, "utf8");
  if (/^\s*import\s+["']server-only["']/m.test(src)) continue; // server-only OK
  if (fromRe.test(src)) offenders.push(rel);
}
check(
  `no client file calls .from("<product table>") (offenders: ${offenders.join(", ") || "none"})`,
  offenders.length === 0,
);

console.log(`\nproduct-access: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
