/* Apply extracted taglines + brand to matched products.
   Quality filter: reject taglines that look like spec-table OCR
   junk (lots of digits/symbols, pipes, parens-only). */

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

const dryRun = process.argv.includes("--dry");
const items = JSON.parse(await fs.readFile("/tmp/koleex-extracted.json", "utf8"));

function cleanTagline(t) {
  if (!t) return null;
  // Strip duplicated tagline (multi-column OCR sometimes joins them)
  // Take only the first occurrence by splitting at suspicious markers
  const cleaned = t
    .replace(/\s+/g, " ")
    .replace(/^\(\s*/, "")
    .replace(/\s*\)$/, "")
    .trim();

  if (cleaned.length < 12) return null;
  if (cleaned.length > 120) return null;
  if (cleaned.includes("|")) return null;       // spec table separator
  if (/[X×]\s*\d/.test(cleaned)) return null;   // dimensions like "895 X 405"
  if (cleaned.split(" ").length < 3) return null; // need ≥3 words

  // Reject if too many non-letter characters (likely spec junk)
  const letters = cleaned.match(/[A-Za-z]/g)?.length || 0;
  if (letters / cleaned.length < 0.55) return null;

  // Detect duplicated phrase: "Foo bar Foo bar" — keep just the first half
  const words = cleaned.split(" ");
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(" ");
    const b = words.slice(half).join(" ");
    if (a === b) return a;
  }

  // Title case detection: must have at least one Capitalized word
  if (!/[A-Z][a-z]/.test(cleaned)) return null;

  return cleaned;
}

let applied = 0, skippedQuality = 0, errors = 0;
const samples = [];

for (const it of items) {
  const tagline = cleanTagline(it.tagline);
  if (!tagline) { skippedQuality++; continue; }

  const update = {
    excerpt: tagline,
    brand: "Koleex",
  };

  if (dryRun) {
    if (samples.length < 12) samples.push({ name: it.product_name, tagline });
    applied++;
    continue;
  }

  const { error } = await supabase
    .from("products")
    .update(update)
    .eq("id", it.product_id);
  if (error) {
    errors++;
    console.error(`  ✗ ${it.product_name}: ${error.message}`);
  } else {
    applied++;
    if (applied % 50 === 0) console.log(`  ... ${applied} applied`);
  }
}

console.log(`\nApplied:           ${applied}`);
console.log(`Skipped (quality): ${skippedQuality}`);
console.log(`Errors:            ${errors}`);
if (dryRun) {
  console.log(`\n── 12 SAMPLES (DRY RUN) ──`);
  for (const s of samples) console.log(`  [${s.name}] → "${s.tagline}"`);
}
