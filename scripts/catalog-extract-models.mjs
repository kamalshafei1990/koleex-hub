/* Walk every OCR'd catalog page, find model-code-shaped tokens
   (e.g. XS-3810D-A-PL, XSI-008-12064P-D-VPL, XC-2100AS), and emit
   a JSON array of { page, model, surrounding_text } so we can match
   against the products table. */

import fs from "node:fs/promises";
import path from "node:path";

const OCR_DIR = "/tmp/koleex-catalog-pages";

// Model-code regex — matches our products' shape:
//   prefix letters (1-4) [-/] alphanumeric
//   length >= 4 chars total
const MODEL_RE = /\b([A-Z][A-Z0-9]{0,3}[-\/][A-Z0-9][A-Z0-9-\/]{1,40}[A-Z0-9])\b/g;

const files = (await fs.readdir(OCR_DIR))
  .filter(f => f.startsWith("ocr-pg-") && f.endsWith(".txt"))
  .sort();

const found = new Map();   // model -> { pages: Set, sample_context }
const allModels = new Set();

for (const f of files) {
  const page = parseInt(f.match(/(\d+)\.txt$/)[1], 10);
  const text = await fs.readFile(path.join(OCR_DIR, f), "utf8");
  const matches = [...text.matchAll(MODEL_RE)].map(m => m[1]);
  for (const m of matches) {
    // Filter false positives: too long (> 40 chars) or has unusual structure
    if (m.length < 4 || m.length > 40) continue;
    // Reject if it doesn't have at least one digit (e.g. "PROFILE-OF-A" wouldn't be a real model)
    if (!/\d/.test(m)) continue;
    allModels.add(m);
    if (!found.has(m)) found.set(m, { pages: new Set(), sample: "" });
    found.get(m).pages.add(page);
    if (!found.get(m).sample) {
      // Capture ~200 chars around first occurrence for context
      const i = text.indexOf(m);
      found.get(m).sample = text.slice(Math.max(0, i - 80), i + 200).replace(/\s+/g, " ").trim();
    }
  }
}

const out = [];
for (const [model, info] of found.entries()) {
  out.push({
    model,
    pages: [...info.pages].sort((a, b) => a - b),
    sample: info.sample,
  });
}
out.sort((a, b) => a.pages[0] - b.pages[0]);

await fs.writeFile("/tmp/koleex-catalog-models.json", JSON.stringify(out, null, 2));
console.log(`Found ${out.length} distinct model-shaped tokens across ${files.length} pages.`);
console.log(`Top 20 by pages:`);
for (const m of out.slice(0, 20)) {
  console.log(`  p${m.pages[0]}\t${m.model}`);
}
