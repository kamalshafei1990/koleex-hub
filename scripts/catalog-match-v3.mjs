/* v3: progressively-shortened probe matching.
   Filenames sometimes carry extra suffixes the catalog doesn't use
   (e.g. XE-1201N-C 1.png lists in the catalog as just "XE-1201N").
   For each DB product, try the full probe; if no hit, drop trailing
   tokens until we find a hit (or run out of shortenings). */

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
const files = (await fs.readdir(OCR_DIR)).filter(f => f.startsWith("ocr-pg-") && f.endsWith(".txt")).sort();

const pages = [];
for (const f of files) {
  const pageNum = parseInt(f.match(/(\d+)\.txt$/)[1], 10);
  const raw = await fs.readFile(path.join(OCR_DIR, f), "utf8");
  const norm = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  pages.push({ page: pageNum, raw, norm });
}

function pageHits(probe) {
  return pages.filter(pg => pg.norm.includes(probe));
}

/** Generate progressively-shorter probes from a model code.
 *  Always preserves the leading prefix (e.g. "XE-1201N").
 *  Stops when the probe gets too short to be unique. */
function probesFor(name) {
  const norm = name.toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const probes = [norm];
  let current = norm;
  while (current.length > 6) {
    // Drop the trailing hyphen-segment OR trailing 1-2 char letter+digit
    const m = current.match(/^(.+?)-([^-]+)$/);
    if (!m) break;
    if (m[1].length < 5) break;
    current = m[1];
    if (!probes.includes(current)) probes.push(current);
  }
  return probes;
}

const { data: products } = await supabase
  .from("products")
  .select("id, slug, product_name, category_slug, subcategory_slug");

const matches = [];
const unmatched = [];

for (const p of products) {
  const probes = probesFor(p.product_name);
  let bestMatch = null;
  let usedProbe = null;
  for (const probe of probes) {
    const hits = pageHits(probe);
    if (hits.length > 0) {
      bestMatch = hits;
      usedProbe = probe;
      break;
    }
  }
  if (bestMatch) {
    matches.push({
      product_id: p.id,
      slug: p.slug,
      product_name: p.product_name,
      category_slug: p.category_slug,
      pages: bestMatch.map(h => h.page),
      probe: usedProbe,
      probe_was_shortened: usedProbe !== probes[0],
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

console.log(`Matched:   ${matches.length} / ${products.length}  (${(matches.length/products.length*100).toFixed(0)}%)`);
console.log(`  exact:     ${matches.filter(m => !m.probe_was_shortened).length}`);
console.log(`  shortened: ${matches.filter(m => m.probe_was_shortened).length}`);
console.log(`Unmatched: ${unmatched.length}`);

const byCat = {};
for (const p of products) byCat[p.category_slug] = byCat[p.category_slug] || { total: 0, matched: 0 };
for (const p of products) byCat[p.category_slug].total++;
for (const m of matches) byCat[m.category_slug].matched++;
console.log(`\n── BY CATEGORY ──`);
for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  ${cat.padEnd(35)} ${s.matched.toString().padStart(3)} / ${s.total.toString().padStart(3)}  (${(s.matched/s.total*100).toFixed(0)}%)`);
}
