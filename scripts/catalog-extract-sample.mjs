/* Sample 8 matched products. For each, show the OCR text from the
   first matched page so we can judge how clean the per-product
   extraction will be. */

import fs from "node:fs/promises";
import path from "node:path";

const matches = JSON.parse(await fs.readFile("/tmp/koleex-catalog-matches.json", "utf8"));
const pageCache = {};
async function getPage(p) {
  if (!pageCache[p]) {
    pageCache[p] = await fs.readFile(`/tmp/koleex-catalog-pages/ocr-pg-${String(p).padStart(3, "0")}.txt`, "utf8");
  }
  return pageCache[p];
}

// Pick 8 matches across categories
const seen = new Set();
const sample = [];
for (const m of matches) {
  if (seen.has(m.category_slug)) continue;
  seen.add(m.category_slug);
  sample.push(m);
  if (sample.length >= 8) break;
}

for (const m of sample) {
  const page = m.pages[0];
  const text = await getPage(page);
  console.log(`\n══ ${m.product_name}  (page ${page}, category=${m.category_slug}) ══`);
  // Find the probe in the text and grab surrounding context
  const probe = m.probe;
  const upper = text.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const idx = upper.indexOf(probe);

  // Slice a window of raw text around the model — but raw text has
  // lots of whitespace; cap the window at ~600 chars.
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const matchingLineIdx = lines.findIndex(l => l.toUpperCase().replace(/[^A-Z0-9-]/g, "").includes(probe));
  const window = lines.slice(Math.max(0, matchingLineIdx - 2), matchingLineIdx + 12).join("\n");
  console.log(window);
}
