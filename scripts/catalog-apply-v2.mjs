/* Apply v2 extracted names to products.product_name.
   Final filter: split obvious 2-product concats, drop spec-header
   strays. Then UPDATE in batches. */

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

const items = JSON.parse(await fs.readFile("/tmp/koleex-extracted-v2.json", "utf8"));

function clean(name) {
  let n = name.trim();
  // Split on a duplicated "machine" — two product titles concatenated
  // ("Direct drive servo cutting machine Round knife cutting machine")
  const matches = [...n.matchAll(/\bmachine\b/gi)];
  if (matches.length >= 2) {
    const idx = matches[0].index + matches[0][0].length;
    n = n.slice(0, idx).trim();
  }
  // Reject if it ends mid-word ("for", "of", "the")
  if (/\b(for|of|the|to|with|and|in|on)$/i.test(n)) return null;
  // Reject if it includes parens with only spec data
  if (/\([\d.×x*\s]+\)/.test(n)) return null;
  // Reject names that are spec-table column labels (start with
  // a verb + "high/depth/width/length" pattern)
  if (/^(Cutting|Stitch|Bed|Working)\s+(high|depth|length|width|height)\b/i.test(n)) return null;
  // Names containing parens must end with "Machine" (or similar) —
  // anything else is likely a stray spec annotation.
  if (/\(/.test(n) && !/(Machine|Cutter|System|Press|Iron|Boiler)\)?\s*$/i.test(n)) return null;
  // Reject very short or very long
  if (n.length < 14 || n.length > 80) return null;
  // Title case the first letter
  return n.charAt(0).toUpperCase() + n.slice(1);
}

const dryRun = process.argv.includes("--dry");
let applied = 0, skipped = 0;
const samples = [];

for (const it of items) {
  const cleaned = clean(it.catalog_name);
  if (!cleaned) { skipped++; continue; }
  if (dryRun) {
    if (samples.length < 15) samples.push({ pn: it.product_name, name: cleaned });
    applied++;
    continue;
  }
  const { error } = await supabase
    .from("products")
    .update({ product_name: cleaned, brand: "Koleex" })
    .eq("id", it.product_id);
  if (error) { skipped++; console.error(`  ✗ ${it.product_name}: ${error.message}`); }
  else applied++;
}

console.log(`Applied: ${applied}\nSkipped: ${skipped}`);
if (dryRun) {
  console.log("\n── 15 SAMPLES ──");
  for (const s of samples) console.log(`  ${s.pn.padEnd(28)} → "${s.name}"`);
}
