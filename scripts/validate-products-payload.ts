/* ===========================================================================
   validate-products-payload — the two catalogue apps stay LIGHT on the wire.

   Static checks over the source (no network, no build), written after the
   22 Sep 2026 pass that took a Product Data open from ~830 KB to ~430 KB
   and a Products open from nine sequential price calls to two. Each check
   guards one of those gains against the way it was lost the first time:

     1. No client code asks /api/products for the FULL 88-column row —
        neither the URL nor the fetchProducts() helper that wraps it.
        Purchases, Suppliers, Landed Cost, To-do and Inbox each did — 978 KB
        to fill a dropdown. Every client call must carry ?view=list or ?paged=1.
     2. /api/products/signals is POST-by-ids only, chunks its `.in()` reads,
        and has no GET. The GET read the whole catalogue (and every contact)
        on every open; 394 ids in one `.in()` URL is a `fetch failed`.
     3. The FOB engine chunks its `.in()` reads too — the catalogue now sends
        "everything still unpriced" in one call.
     4. ProductList fetches signals by POST, keyed on the loaded ids, and
        prices in two calls (first screen, then the rest).
     5. LIST_PRODUCT_COLUMNS stays a short projection without the prose
        columns (excerpt alone was 45% of the list response).
     6. The first list page carries per-division counts — what hides the
        empty divisions without a second request.

   Run: npm run validate:products-payload
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "./lib/strip-comments";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
/* Comments are stripped before matching so a guard cannot trip on its own
   documentation (the products-i18n guard did exactly that once). */
const code = (p: string) => stripComments(read(p), { line: "all" });

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const p = join(dir, e);
    const st = statSync(join(ROOT, p));
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

console.log("\nproducts-payload");

/* ── 1. no full-row /api/products from client code ─────────────────────── */
{
  const clientFiles = [...walk("src/components"), ...walk("src/lib")]
    .filter((p) => !p.startsWith("src/lib/server/"))
    .filter((p) => !/\.test\.tsx?$/.test(p));
  const offenders: string[] = [];
  /* A bare "/api/products" followed by a quote/backtick, i.e. no query
     string. `/api/products?` and `/api/products/<sub-route>` are fine. */
  const bare = /["'`]\/api\/products["'`]/;
  /* …and the helper that wraps the same full read. */
  const helper = /\bfetchProducts\(\)/;
  for (const p of clientFiles.concat(walk("src/app").filter((p) => /\.tsx?$/.test(p) && !p.startsWith("src/app/api/")))) {
    const src = code(p);
    if (!bare.test(src) && !helper.test(src)) continue;
    /* products-admin.ts keeps the generic helper for the editor's own
       full-row reads (create/edit need every column); everything list-like
       goes through fetchProductsSlim. */
    if (p === "src/lib/products-admin.ts") continue;
    offenders.push(relative(ROOT, join(ROOT, p)));
  }
  check("no client file fetches the full /api/products row", offenders.length === 0,
    offenders.length ? `offenders: ${offenders.join(", ")}` : "");
}

/* ── 2. signals: POST by ids, chunked, no GET ──────────────────────────── */
{
  const s = code("src/app/api/products/signals/route.ts");
  check("signals exports POST and not GET", /export async function POST\(/.test(s) && !/export async function GET\(/.test(s));
  check("signals reads the posted ids", /body\.ids/.test(s) && /MAX_IDS/.test(s));
  check("signals scopes every per-product read through inChunks", (s.match(/inChunks</g) ?? []).length >= 5);
  check("signals scopes the product read to the tenant", /\.eq\("tenant_id", auth\.tenant_id\)/.test(s));
  check("signals ships one supplier dictionary, not an object per product", /suppliers,\s*allSuppliers/.test(s) && /supplier: \{ id: string \| null; name\?: string \} \| null/.test(s));
}

/* ── 3. FOB engine chunks its id reads ─────────────────────────────────── */
{
  const s = code("src/lib/server/products-fob.ts");
  check("products-fob reads links and models through inChunks", (s.match(/inChunks</g) ?? []).length >= 2);
  const c = code("src/lib/server/in-chunks.ts");
  check("in-chunks keeps each URL well under the client's limit", /IN_CHUNK = 150/.test(c));
}

/* ── 4. ProductList: signals by POST per page; prices in two calls ─────── */
{
  const s = code("src/components/admin/ProductList.tsx");
  const postSignals = /fetch\("\/api\/products\/signals",\s*\{\s*method: "POST"/.test(s);
  check("ProductList posts signals for the ids it holds", postSignals);
  check("ProductList never GETs the whole-catalogue signals", !/fetch\("\/api\/products\/signals",\s*\{\s*credentials/.test(s));
  check("ProductList prices the first screen, then the rest in one call", /fobTailRef\.current \? all\.slice\(0, FOB_MAX_IDS\)/.test(s));
  check("ProductList hides divisions with no products", /divisionCounts\[d\.slug\] \?\? 0\) > 0/.test(s));
}

/* ── 5. list projection stays short ────────────────────────────────────── */
{
  const s = read("src/lib/server/product-access.ts");
  const m = s.match(/export const LIST_PRODUCT_COLUMNS = \[([\s\S]*?)\]\.join/);
  const cols = m ? stripComments(m[1], { line: "keep" }).split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean) : [];
  check("LIST_PRODUCT_COLUMNS is a short projection", cols.length > 0 && cols.length <= 16, `${cols.length} columns`);
  check("LIST_PRODUCT_COLUMNS carries no prose columns", !cols.includes("excerpt") && !cols.includes("description") && !cols.includes("specs"));
}

/* ── 6. first page carries division counts ─────────────────────────────── */
{
  const s = code("src/app/api/products/route.ts");
  check("list page 1 counts products per division", /divisionsPromise/.test(s) && /groupCounts = \{[\s\S]*?\.\.\.groupCounts, divisions \}/.test(s));
}

/* ── 7. ONE home for a model's packing ─────────────────────────────────
   Until 2026-09-22 a member's crates could be typed in two places — the
   Packing & Logistics tab (products.logistics, family-wide) and a legacy
   card on the Variants tab writing ten per-model columns — and neither
   knew about the other. The member home is product_models
   .logistics_overrides; the legacy columns are frozen and read by nothing. */
{
  const legacy = /\b(carton_dimensions|container_20ft_qty|box_include|extra_accessories)\b/;
  check("Variants tab renders no per-model packing inputs", !legacy.test(code("src/components/admin/form-sections/ModelsSection.tsx")));
  check("editor state carries no legacy packing columns",
    !legacy.test(code("src/types/product-form.ts")) && !legacy.test(code("src/components/admin/ProductForm.tsx")));
  check("model PATCH refuses the legacy packing columns", !legacy.test(code("src/app/api/product-models/[id]/route.ts")));
  check("profile packing sheet never reads the model row's legacy packing", !/m\("net_weight"\)|m\("carton_dimensions"\)/.test(code("src/components/admin/ProductProfile.tsx")));
  check("AI product knowledge reads logistics_overrides, not the legacy columns",
    /logistics_overrides/.test(code("src/lib/server/ai-agent/product-knowledge.ts")) && !legacy.test(code("src/lib/server/ai-agent/product-knowledge.ts")));
  check("member packing rides logistics_overrides end to end",
    ["src/components/admin/ProductForm.tsx", "src/app/api/product-models/[id]/route.ts", "src/lib/server/product-detail.ts", "src/components/admin/ProductProfile.tsx"]
      .every((f) => /logistics_overrides/.test(code(f))));
}

/* ── 8. the category rail FILTERS (owner, 22 Sep 2026) ────────────────── */
{
  const s = code("src/components/admin/ProductList.tsx");
  check("category rail no longer jumps to section anchors", !/href=\{`#cat-/.test(s));
  check("category rail cards are pressed buttons bound to the category filter", /aria-pressed=\{on\}/.test(s) && /setFilterCat\(c\.slug\)/.test(s));
  check("category rail counts come from the server facets", /groupCounts\?\.facets\?\.categories/.test(s));
  check("category selection rides the address (?cat=)", /searchParams\.set\("cat", filterCat\)/.test(s));
  const r = code("src/app/api/products/route.ts");
  check("list page 1 facets drop the category and subcategory filters", /k !== "category" && k !== "subcategory"/.test(r) && /groupCounts\.facets = /.test(r));
}

console.log(`\nproducts-payload: ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
