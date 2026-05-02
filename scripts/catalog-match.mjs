/* Match catalog model codes to our 630 product slugs.
   - Loads OCR'd models from /tmp/koleex-catalog-models.json
   - Loads DB products via Supabase
   - For each DB slug, tries exact + fuzzy matches against catalog tokens
   - Writes /tmp/koleex-catalog-matches.json with the union and reports counts */

import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await fs.readFile("/Users/kamalshafei/Desktop/Koleex HUB/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const catalog = JSON.parse(await fs.readFile("/tmp/koleex-catalog-models.json", "utf8"));

const { data: products } = await supabase
  .from("products")
  .select("id, slug, product_name, category_slug, subcategory_slug");

console.log(`Catalog tokens: ${catalog.length}`);
console.log(`DB products:    ${products.length}`);

// Normalize for fuzzy matching: lowercase + strip non-alphanum + common OCR confusions
function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function fuzzy(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/o/g, "0")        // letter O → digit 0
    .replace(/l/g, "1")        // letter l → digit 1
    .replace(/i/g, "1")        // letter I → digit 1
    .replace(/b/g, "8")        // letter B → digit 8 (rare but happens)
    .replace(/q/g, "0");       // letter Q → digit 0
}

// Build catalog index keyed by normalized + fuzzy
const catByNorm = new Map();
const catByFuzzy = new Map();
for (const c of catalog) {
  catByNorm.set(norm(c.model), c);
  catByFuzzy.set(fuzzy(c.model), c);
}

const matches = [];
const unmatched = [];

for (const p of products) {
  const slugN = norm(p.slug);
  const slugF = fuzzy(p.slug);
  let hit = catByNorm.get(slugN) || catByFuzzy.get(slugF);
  if (hit) {
    matches.push({
      product_id: p.id,
      slug: p.slug,
      product_name: p.product_name,
      category_slug: p.category_slug,
      catalog_model: hit.model,
      catalog_pages: hit.pages,
    });
  } else {
    unmatched.push({
      product_id: p.id,
      slug: p.slug,
      product_name: p.product_name,
      category_slug: p.category_slug,
    });
  }
}

await fs.writeFile("/tmp/koleex-catalog-matches.json", JSON.stringify(matches, null, 2));
await fs.writeFile("/tmp/koleex-catalog-unmatched.json", JSON.stringify(unmatched, null, 2));

console.log(`\n── MATCH RESULTS ──`);
console.log(`Matched:    ${matches.length} / ${products.length} products  (${(matches.length / products.length * 100).toFixed(0)}%)`);
console.log(`Unmatched:  ${unmatched.length}`);

console.log(`\n── BREAKDOWN BY CATEGORY ──`);
const byCat = {};
for (const p of products) {
  byCat[p.category_slug] = byCat[p.category_slug] || { total: 0, matched: 0 };
  byCat[p.category_slug].total++;
}
for (const m of matches) byCat[m.category_slug].matched++;
for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  ${cat.padEnd(35)} ${s.matched.toString().padStart(3)} / ${s.total.toString().padStart(3)}  (${(s.matched/s.total*100).toFixed(0)}%)`);
}

console.log(`\n── SAMPLE 10 UNMATCHED (DB has them, catalog OCR didn't surface) ──`);
for (const u of unmatched.slice(0, 10)) console.log(`  ${u.slug}`);
