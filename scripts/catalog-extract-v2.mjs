/* v2 extraction with strict quality filter + multi-page fallback.
   For each matched product, try EVERY page it appears on, picking
   the cleanest tagline. Reject anything that looks like spec-table
   junk, sibling-product collision, or short fragments. */

import fs from "node:fs/promises";

const matches = JSON.parse(await fs.readFile("/tmp/koleex-catalog-matches.json", "utf8"));
const pageCache = {};
async function getPageLines(p) {
  if (!pageCache[p]) {
    const text = await fs.readFile(`/tmp/koleex-catalog-pages/ocr-pg-${String(p).padStart(3, "0")}.txt`, "utf8");
    pageCache[p] = text.split("\n").map(l => l.trim());
  }
  return pageCache[p];
}

const NORM = (s) => s.toUpperCase().replace(/[^A-Z0-9-]/g, "");

// Words that strongly suggest a real product description.
const NOUN_RE = /\b(machine|machines|cutter|cutting|sewing|hemming|attaching|setter|press|presser|ironing|iron|fusing|spreader|spreading|inspection|folder|folding|packer|packing|embroidery|knitting|stitch|stitching|overlock|chainstitch|interlock|coverstitch|lockstitch|button|buttonhole|bartack|tape|edge|trimmer|drilling|drill|pleating|smocking|gathering|fagoting|picot|station|system|unit|head|conveyor|table|boiler|steam|loom|dryer|sealer|inspector|detector|printer|printing|press|presser|laminator|fuser|setter|hemmer|surger|serger|warping|relaxing|folder|cuff|collar|placket|sleeve|elastic|gather|seam|seamer|slitter|slitting|laser|knife|blade|scissor|tacker|attach|setter|labeler|labelling|fitter|hot|cold|stamping|drilling)\b/i;

// Reject these section/category headers.
const BAD_HEAD_RE = /^(FEATURES?|SPECIFICATION|TECHNICAL|MODEL\b|POWER\b|VOLTAGE\b|CORE FEATURES?|USAGE|ADVANTAGES|OPTIONAL|SMART CONTROL)\s*$/i;
const MODEL_RE = /^[A-Z][A-Z0-9]{0,3}[-\/][A-Z0-9][A-Z0-9-\/\s]{2,}$/;

function looksLikeName(line) {
  if (!line) return false;
  const t = line.trim();
  if (t.length < 12 || t.length > 100) return false;
  if (BAD_HEAD_RE.test(t)) return false;
  if (t.includes("|")) return false;
  if (/^\W/.test(t) && !/^\(/.test(t)) return false;     // starts with punct (allow leading paren)
  if (/[X×]\s*\d{2,}/.test(t)) return false;             // dimensions
  // Must NOT be just a model code (or composite of them)
  if (/^[A-Z]{1,4}[-\/][A-Z0-9-\/]+(\s+[A-Z]{1,4}[-\/][A-Z0-9-\/]+){1,5}$/.test(t)) return false;
  // Must contain a machine-noun word
  if (!NOUN_RE.test(t)) return false;
  // Must have ≥ 50% letters
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters / t.length < 0.6) return false;
  // Reject if duplicated halves
  const words = t.split(/\s+/);
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    if (words.slice(0, half).join(" ") === words.slice(half).join(" ")) return null;
  }
  return true;
}

// Find all candidate names on a page that appear within 5 lines AFTER
// the model code's first occurrence.
async function tryExtract(probe, page) {
  const lines = await getPageLines(page);
  for (let i = 0; i < lines.length; i++) {
    if (!NORM(lines[i]).includes(probe)) continue;
    // Look at the next 5 lines for a clean tagline
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const candidate = lines[j].trim();
      if (looksLikeName(candidate)) return candidate.replace(/\s+/g, " ");
    }
  }
  return null;
}

const out = [];
let extracted = 0;

for (const m of matches) {
  let name = null;
  for (const page of m.pages) {
    name = await tryExtract(m.probe, page);
    if (name) break;
  }
  if (name) {
    extracted++;
    out.push({
      product_id: m.product_id,
      product_name: m.product_name,
      catalog_name: name,
      pages: m.pages,
    });
  }
}

await fs.writeFile("/tmp/koleex-extracted-v2.json", JSON.stringify(out, null, 2));
console.log(`Extracted clean names: ${extracted} / ${matches.length}`);
console.log(`\n── 20 SAMPLES ──`);
for (const s of out.slice(0, 20)) {
  console.log(`  ${s.product_name.padEnd(28)} → "${s.catalog_name}"`);
}
