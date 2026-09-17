#!/usr/bin/env tsx
/* validate:products-i18n
 *
 * WHY THIS EXISTS. `t(key, fallback)` returns the fallback when the key is
 * missing, so a key nobody ever defined looks completely fine in English and
 * shows ENGLISH to every Chinese and Arabic operator — no error, no log, no
 * warning. Eight keys in ProductList had been in that state (`list.colCost`,
 * `state.sessionExpiredTitle`, the whole `card.missing.*` family…) and nothing
 * caught them; they were found by hand while splitting the dictionary.
 *
 * It also guards the split itself. products-list-i18n.ts exists so the
 * catalogue does not download the editor's 1,070 packing/supplier/hero keys.
 * That only holds while the list imports the SMALL dictionary — one
 * absent-minded `PRODUCTS_UI_I18N` import silently puts 173 KB back.
 *
 * Run: npm run validate:products-i18n
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LIST_DICT = "src/lib/products-list-i18n.ts";
const FULL_DICT = "src/lib/products-ui-i18n.ts";
const LIST_UI = "src/components/admin/ProductList.tsx";
const PREVIEW_DICT = "src/lib/products-preview-i18n.ts";
const PREVIEW_UI = "src/components/product-preview/ProductPreview.tsx";
const LANGS = ["en", "zh", "ar"] as const;

let failures = 0;
const fail = (m: string, d?: string) => { failures++; console.error(`  ✗ ${m}${d ? `\n      ${d}` : ""}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

function keysOf(src: string): string[] {
  const i = src.indexOf("Translations = {");
  return [...src.slice(i).matchAll(/^\s{2}"([^"]+)":/gm)].map((m) => m[1]);
}

const listSrc = read(LIST_DICT);
const fullSrc = read(FULL_DICT);
const uiSrc = read(LIST_UI);
const previewSrc = read(PREVIEW_DICT);
const previewUiSrc = read(PREVIEW_UI);
const previewKeys = new Set(keysOf(previewSrc));

const listKeys = new Set(keysOf(listSrc));
const fullKeys = new Set(keysOf(fullSrc));

console.log("\nA. The split holds");
/* The whole point: the catalogue must not import the editor's dictionary. */
/* An IMPORT, not a mention — the file's own comment explains what it stopped
   importing and must not trip its own guard. */
if (/^\s*import\s*\{[^}]*\bPRODUCTS_UI_I18N\b/m.test(uiSrc)) {
  fail("ProductList imports PRODUCTS_UI_I18N",
       "That puts all 1,070 editor keys back into the catalogue's bundle. Import PRODUCTS_LIST_I18N.");
} else ok("ProductList imports only PRODUCTS_LIST_I18N");

if (!/\.\.\.PRODUCTS_LIST_I18N/.test(fullSrc)) {
  fail("PRODUCTS_UI_I18N no longer spreads PRODUCTS_LIST_I18N",
       "The editor would stop resolving every list key — silently, via fallbacks.");
} else ok("PRODUCTS_UI_I18N spreads the list dictionary");

const both = [...listKeys].filter((k) => fullKeys.has(k));
both.length
  ? fail(`${both.length} key(s) defined in BOTH files`, both.slice(0, 8).join(", "))
  : ok(`no key is defined twice — ${listKeys.size} list + ${fullKeys.size} editor`);

/* The customer-facing product page carries the same rule, for the same
   reason — it was reading 52 of 1,070. */
if (/^\s*import\s*\{[^}]*\bPRODUCTS_UI_I18N\b/m.test(previewUiSrc)) {
  fail("ProductPreview imports PRODUCTS_UI_I18N",
       "That puts the editor's 1,015 keys back onto /products/[id], the heaviest page in the Hub.");
} else ok("ProductPreview imports only PRODUCTS_PREVIEW_I18N");
if (!/\.\.\.PRODUCTS_PREVIEW_I18N/.test(fullSrc)) {
  fail("PRODUCTS_UI_I18N no longer spreads PRODUCTS_PREVIEW_I18N", "The editor would lose every preview.* key, silently.");
} else ok("PRODUCTS_UI_I18N spreads the preview dictionary");
{
  const dup = [...previewKeys].filter((k) => fullKeys.has(k) || listKeys.has(k));
  dup.length
    ? fail(`${dup.length} preview key(s) defined in another file too`, dup.slice(0, 8).join(", "))
    : ok(`preview dictionary is disjoint — ${previewKeys.size} keys`);
  const lits = [...new Set([...previewUiSrc.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]))];
  const miss = lits.filter((k) => !previewKeys.has(k));
  miss.length
    ? fail(`${miss.length} key(s) called by ProductPreview are not defined`, miss.join(", "))
    : ok(`all ${lits.length} ProductPreview keys are defined`);
}

/* ⚠️ spec-i18n is 445 KB and English does not need a byte of it — the schema
   label IS the English label, and where the two disagreed the dictionary was
   silently overriding 61 of them. A static import here puts all of it back on
   every visitor in every language, and nothing on screen would look wrong. */
if (/^\s*import\s+\{[^}]*SPEC_I18N[^}]*\}\s+from/m.test(previewUiSrc)) {
  fail("ProductPreview statically imports SPEC_I18N",
       "445 KB back on the heaviest page in the Hub, in every language. Load it with await import() for zh/ar only.");
} else ok("spec-i18n is loaded on demand, not on every visit");
if (!/import\(\s*["']@\/lib\/product-schema\/spec-i18n["']\s*\)/.test(previewUiSrc)) {
  fail("ProductPreview never loads SPEC_I18N at all",
       "zh/ar would read English spec labels with no error — the exact silent failure this file guards.");
} else ok("zh/ar still get the spec dictionary");

console.log("\nB. Every key the list calls exists");
/* Literals. */
const literals = [...new Set([...uiSrc.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]))];
const missing = literals.filter((k) => !listKeys.has(k));
missing.length
  ? fail(`${missing.length} key(s) called by ProductList are not defined`,
         missing.join(", ") + "\n      Each renders its English fallback to zh/ar users.")
  : ok(`all ${literals.length} literal keys are defined`);

/* Template families: t(`card.missing.${k}`) needs the whole family present. */
const prefixes = [...new Set([...uiSrc.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)].map((m) => m[1]))];
for (const p of prefixes) {
  const family = [...listKeys].filter((k) => k.startsWith(p));
  family.length
    ? ok(`template family \`${p}*\` — ${family.length} keys`)
    : fail(`template family \`${p}*\` has NO keys`,
           "Every value it is called with falls back, in every language.");
}

console.log("\nC. Three languages, everywhere");
for (const [label, src] of [["list", listSrc], ["preview", previewSrc], ["editor", fullSrc]] as const) {
  /* Entries span lines when a translation is long, so the body is matched
     lazily across newlines up to the closing brace of THAT entry. Matching
     `[^}]*` only saw single-line entries and called every wrapped one
     incomplete — a validator with false positives stops being read. */
  const entries = [...src.matchAll(/^\s{2}"([^"]+)":\s*\{([\s\S]*?)\}\s*,?\s*$/gm)];
  const bad = entries.filter(([, , b]) => LANGS.some((l) => !new RegExp(`\\b${l}\\s*:`).test(b)));
  bad.length
    ? fail(`${bad.length} ${label} entr(ies) missing a language`, bad.slice(0, 6).map((m) => m[1]).join(", "))
    : ok(`${label}: all ${entries.length} single-line entries carry en/zh/ar`);
}

console.log(failures === 0 ? "\n✓ products i18n: all checks passed" : `\n✗ ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
