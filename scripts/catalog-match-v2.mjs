/* v2: instead of comparing pre-extracted tokens, search for each DB
   product's model code as a SUBSTRING anywhere in any OCR page.
   The catalog often combines models (XC-1610Z/1810Z) or formats
   them with spaces (XA-1105 PTC), so token-level extraction misses
   them. Substring search catches all those forms. */

import fs from "node:fs/promises";
import path from "node:path";
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

const OCR_DIR = "/tmp/koleex-catalog-pages";

// Load all OCR'd pages once. Pre-normalize each so we can do
// substring search efficiently.
const files = (await fs.readdir(OCR_DIR))
  .filter(f => f.startsWith("ocr-pg-") && f.endsWith(".txt"))
  .sort();

const pages = [];
for (const f of files) {
  const pageNum = parseInt(f.match(/(\d+)\.txt$/)[1], 10);
  const raw = await fs.readFile(path.join(OCR_DIR, f), "utf8");
  // Normalized: uppercase, strip whitespace+punct  → preserves alphanumerics + hyphens
  const norm = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  pages.push({ page: pageNum, raw, norm });
}

const { data: products } = await supabase
  .from("products")
  .select("id, slug, product_name, category_slug, subcategory_slug");

const matches = [];
const unmatched = [];

for (const p of products) {
  const probe = p.product_name.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (probe.length < 4) {
    unmatched.push({ ...p, reason: "probe too short" });
    continue;
  }
  const hits = pages.filter(pg => pg.norm.includes(probe));
  if (hits.length > 0) {
    matches.push({
      product_id: p.id,
      slug: p.slug,
      product_name: p.product_name,
      category_slug: p.category_slug,
      pages: hits.map(h => h.page),
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

console.log(`\n── MATCH RESULTS (v2 substring) ──`);
console.log(`Matched:   ${matches.length} / ${products.length} products  (${(matches.length/products.length*100).toFixed(0)}%)`);
console.log(`Unmatched: ${unmatched.length}`);

const byCat = {};
for (const p of products) byCat[p.category_slug] = byCat[p.category_slug] || { total: 0, matched: 0 };
for (const p of products) byCat[p.category_slug].total++;
for (const m of matches) byCat[m.category_slug].matched++;
console.log(`\n── BY CATEGORY ──`);
for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  ${cat.padEnd(35)} ${s.matched.toString().padStart(3)} / ${s.total.toString().padStart(3)}  (${(s.matched/s.total*100).toFixed(0)}%)`);
}

console.log(`\n── SAMPLE 15 STILL UNMATCHED ──`);
for (const u of unmatched.slice(0, 15)) console.log(`  ${u.slug}`);
