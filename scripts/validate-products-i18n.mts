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
for (const [label, src] of [["list", listSrc], ["editor", fullSrc]] as const) {
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
