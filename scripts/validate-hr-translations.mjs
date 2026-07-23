#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   validate:hr-translations — every hr.* key the HR app asks for must exist.

   Why: t() falls back to returning the KEY when it is missing, so a typo or a
   forgotten entry ships as literal "hr.emergencyNamePlaceholder" rendered in
   the UI. That is exactly what reached production on 2026-07-23 — typecheck
   and build both passed, because a missing translation is not a type error.

   Only literal t("hr.…") calls are checked. Template-literal keys
   (t(`hr.${code}`)) are dynamic by design and skipped — the leave-type and
   status maps resolve at runtime and have their own fallbacks.

   Run: node scripts/validate-hr-translations.mjs
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DICT = "src/lib/translations/hr.ts";
const ROOTS = ["src/components/hr", "src/app/hr"];

/* ── Keys the dictionary defines ── */
const dictSrc = readFileSync(DICT, "utf8");
const defined = new Set(
  [...dictSrc.matchAll(/"(hr\.[A-Za-z0-9_.]+)"\s*:/g)].map(([, k]) => k),
);
if (defined.size < 50) {
  console.error(`✗ Only parsed ${defined.size} keys from ${DICT} — parser out of date?`);
  process.exit(1);
}

/* ── Keys the components use ── */
function walk(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap(walk);
const missing = [];
const usedCount = new Map();

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const [, key] of src.matchAll(/\bt\(\s*"(hr\.[A-Za-z0-9_.]+)"/g)) {
    usedCount.set(key, (usedCount.get(key) ?? 0) + 1);
    if (!defined.has(key)) missing.push({ file, key });
  }
}

/* ── Report ── */
console.log(`  ✓ ${defined.size} hr.* keys defined`);
console.log(`  ✓ ${usedCount.size} distinct hr.* keys used across ${files.length} files`);

if (missing.length) {
  console.error("\nvalidate:hr-translations FAILED — these keys render as raw text:\n");
  for (const { file, key } of missing) console.error(`  ✗ ${key}   (${file})`);
  console.error(`\nAdd them to ${DICT} with en/zh/ar values.`);
  process.exit(1);
}

/* Every entry must carry all three languages — a missing zh/ar silently
   falls back to English, which reads as "not translated yet". */
const incomplete = [...dictSrc.matchAll(/"(hr\.[A-Za-z0-9_.]+)"\s*:\s*\{([^}]*)\}/g)]
  .filter(([, , body]) => !/\ben\s*:/.test(body) || !/\bzh\s*:/.test(body) || !/\bar\s*:/.test(body))
  .map(([, k]) => k);

if (incomplete.length) {
  console.error("\nvalidate:hr-translations FAILED — entries missing a language:\n");
  for (const k of incomplete) console.error(`  ✗ ${k}`);
  process.exit(1);
}
console.log("  ✓ every entry has en + zh + ar");

console.log("\nvalidate:hr-translations passed");
