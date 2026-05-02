/* Re-classify Industrial Sewing Machines products from the
   default `lockstitch-machines` bucket into their REAL sub-category
   (overlock / interlock / double-needle / chainstitch / multi-needle /
   pattern-sewing / heavy-duty / special), based on their descriptive
   product name (filled from the catalog earlier).

   Strategy:
     1. Pull every product currently in industrial-sewing-machines.
     2. Match the product_name against an ordered list of regex
        patterns — most specific first so "double-needle chainstitch"
        falls into double-needle, not chainstitch.
     3. UPDATE subcategory_slug. Products whose name already IS the
        model code (no descriptive name extracted) stay in lockstitch
        as a default — they need manual review anyway.
     4. Report distribution before / after. */

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

// Order matters — most specific first.
const RULES = [
  // Specialty cycle / decorative / utility heads → special-machines
  { sub: "special-machines",          re: /\b(buttonhole|button.?hole|button.?attach|button setting|button sewing|bartack|bar.?tack|blindstitch|blind.?stitch|smocking|shirring|elastic.?band|elastic.?attach|elastic attaching|elastic insert|elastic shirring|elastic thread|picot|pleating|fagoting|ultrasonic|tape edge|carpet binding|belt loop attach|belt.?loop|sleeve placket|collar runstitcher|yoke attach|felling|basting|pintuck|zigzag.*shoe|zig.?zag.*shoe|automatic feed|auto.?feed)\b/i },
  // Pattern sewing — programmable XY heads
  { sub: "pattern-sewing-machines",   re: /\b(pattern sewing|programmable pattern|electronic pattern|template sewer|labeling.*machine|label.*machine|tacking station)\b/i },
  // Multi-needle (3+ needles)
  { sub: "multi-needle-machines",     re: /\b(multi.?needle|3.?needle|4.?needle|5.?needle|6.?needle|8.?needle|12.?needle|13.?needles|33.?needle|quilting)\b/i },
  // Double-needle (2 needles only)
  { sub: "double-needle-machines",    re: /\b(double.?needle|twin.?needle|2.?needle)\b/i },
  // Coverstitch / interlock
  { sub: "interlock-machines",        re: /\b(coverstitch|cover.?stitch|interlock|inter.?lock|flatlock|flat.?lock)\b/i },
  // Overlock / serger
  { sub: "overlock-machines",         re: /\b(overlock|over.?lock|over.?seaming|serger|3.?thread.*overedg|edging machine)\b/i },
  // Chainstitch (single-needle chain)
  { sub: "chainstitch-machines",      re: /\b(chainstitch|chain.?stitch|chain stitch)\b/i },
  // Heavy-duty
  { sub: "heavy-duty-machines",       re: /\b(heavy.?duty|jeans special|leather sewing|denim special)\b/i },
  // Lockstitch (catch-all for industrial sewing)
  { sub: "lockstitch-machines",       re: /\b(lockstitch|lock.?stitch|direct.?drive sewing|industrial sewing|computer.?ised lockstitch|computerized lockstitch)\b/i },
];

function classify(name) {
  if (!name) return null;
  for (const r of RULES) {
    if (r.re.test(name)) return r.sub;
  }
  return null;
}

const dryRun = process.argv.includes("--dry");

// Pull every product in industrial-sewing-machines along with its
// primary model code (so we can keep products with no descriptive
// name in the default bucket).
const { data: products, error } = await supabase
  .from("products")
  .select("id, product_name, slug, subcategory_slug, product_models(model_name)")
  .eq("category_slug", "industrial-sewing-machines");
if (error) throw error;

console.log(`Industrial Sewing Machines: ${products.length} products\n`);

const before = {};
const after = {};
const updates = [];
let unchanged = 0;
let unclassified = 0;

for (const p of products) {
  before[p.subcategory_slug] = (before[p.subcategory_slug] || 0) + 1;
  const modelName = (p.product_models?.[0]?.model_name) || "";
  const hasDistinctName = p.product_name && p.product_name.toLowerCase() !== modelName.toLowerCase();
  if (!hasDistinctName) {
    after[p.subcategory_slug] = (after[p.subcategory_slug] || 0) + 1;
    unclassified++;
    continue;
  }
  const newSub = classify(p.product_name);
  if (!newSub) {
    after[p.subcategory_slug] = (after[p.subcategory_slug] || 0) + 1;
    unclassified++;
    continue;
  }
  if (newSub === p.subcategory_slug) {
    unchanged++;
    after[newSub] = (after[newSub] || 0) + 1;
    continue;
  }
  updates.push({ id: p.id, name: p.product_name, from: p.subcategory_slug, to: newSub });
  after[newSub] = (after[newSub] || 0) + 1;
}

console.log("BEFORE:");
for (const [k, v] of Object.entries(before).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${v}`);
}
console.log("\nAFTER (projected):");
for (const [k, v] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${v}`);
}
console.log(`\nWill move:    ${updates.length}`);
console.log(`Already correct: ${unchanged}`);
console.log(`Unclassified (kept as-is): ${unclassified}`);

if (dryRun) {
  console.log("\n── 12 SAMPLE MOVES ──");
  for (const u of updates.slice(0, 12)) console.log(`  ${u.from} → ${u.to}: ${u.name}`);
  process.exit(0);
}

// Apply
let applied = 0, errs = 0;
for (const u of updates) {
  const { error: e } = await supabase
    .from("products")
    .update({ subcategory_slug: u.to })
    .eq("id", u.id);
  if (e) { errs++; console.error(`  ✗ ${u.name}: ${e.message}`); }
  else { applied++; if (applied % 50 === 0) console.log(`  ... ${applied}/${updates.length}`); }
}
console.log(`\nApplied: ${applied}\nErrors:  ${errs}`);
