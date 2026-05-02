/* Per-product extraction.
   For each matched product, find the section in the OCR'd page text
   and pull out:
     · tagline    → 1-line title that follows the model code
     · description → next paragraph (2-6 lines), capped 500 chars
   Skip if no clean tagline can be derived. */

import fs from "node:fs/promises";

const matches = JSON.parse(await fs.readFile("/tmp/koleex-catalog-matches.json", "utf8"));
const pageCache = {};
async function getPage(p) {
  if (!pageCache[p]) {
    pageCache[p] = await fs.readFile(`/tmp/koleex-catalog-pages/ocr-pg-${String(p).padStart(3, "0")}.txt`, "utf8");
  }
  return pageCache[p];
}

const NORM = (s) => s.toUpperCase().replace(/[^A-Z0-9-]/g, "");
// Stop the description if we hit one of these section headers or a
// new model code, otherwise keep concatenating.
const STOP_RE = /^(FEATURES?|SPECIFICATION|SPECIFICATIONS?|TECHNICAL\s+(DATA|SPECS?)|MODEL\b|POWER\b|VOLTAGE\b|MOTOR\b|DIMENSION|USAGE|CORE\s+FEATURES?)/i;
const MODEL_LINE_RE = /^\s*[A-Z]{1,4}[-\/][A-Z0-9][A-Z0-9-\/]{2,}\b/;

function looksLikeTagline(line) {
  if (!line) return false;
  if (line.length < 6 || line.length > 120) return false;
  if (STOP_RE.test(line)) return false;
  if (MODEL_LINE_RE.test(line)) return false;
  // Must contain at least 2 alphabetic words
  const words = line.match(/[A-Za-z]+/g) || [];
  return words.length >= 2;
}

function cleanText(s) {
  return s.replace(/\s+/g, " ").trim();
}

const out = [];

for (const m of matches) {
  const probe = m.probe;
  const text = await getPage(m.pages[0]);
  const lines = text.split("\n").map(l => l.trim());

  const idxs = [];
  for (let i = 0; i < lines.length; i++) {
    if (NORM(lines[i]).includes(probe)) idxs.push(i);
  }
  if (idxs.length === 0) continue;
  const i = idxs[0];

  // Tagline — first plausible line within next 3
  let tagline = null;
  for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
    if (looksLikeTagline(lines[j])) { tagline = cleanText(lines[j]); break; }
  }
  if (!tagline) continue;

  // Description — next 2-6 lines after the tagline, until a stop
  const descParts = [];
  let started = false;
  for (let j = i + 2; j < Math.min(i + 30, lines.length); j++) {
    const ln = lines[j];
    if (!ln) continue;
    if (STOP_RE.test(ln)) break;
    if (MODEL_LINE_RE.test(ln)) break;
    // Skip very short lines (likely OCR fragments)
    if (ln.length < 20) continue;
    descParts.push(ln);
    started = true;
    if (descParts.length >= 4) break;
  }
  const description = cleanText(descParts.join(" ")).slice(0, 500) || null;

  out.push({
    product_id: m.product_id,
    product_name: m.product_name,
    page: m.pages[0],
    tagline,
    description,
  });
}

await fs.writeFile("/tmp/koleex-extracted.json", JSON.stringify(out, null, 2));

console.log(`Extracted: ${out.length}`);
console.log(`  with tagline:     ${out.filter(o => o.tagline).length}`);
console.log(`  with description: ${out.filter(o => o.description).length}`);
console.log(`\n── 8 SAMPLES ──`);
for (const s of out.slice(0, 8)) {
  console.log(`\n[${s.product_name}] (page ${s.page})`);
  console.log(`  tagline: ${s.tagline}`);
  console.log(`  description: ${(s.description || "").slice(0, 200)}…`);
}
