#!/usr/bin/env tsx
/* validate:contacts-i18n
 *
 * WHY THIS EXISTS. src/lib/translations/contacts.ts had grown to 1,637 keys x 3
 * languages — 287 KB of source, 200 KB minified — and all 33 contacts
 * components imported the whole thing. Measured 17/09/2026: /suppliers/[id] was the heaviest route left in the Hub at 1,054 KB because
 * of it. Nine of the eleven importers read fewer than eighty keys.
 *
 * The strings now live one file per namespace under translations/contacts/ and
 * each screen imports only what it uses. Two ways that silently comes undone:
 *   · someone imports the `contactsT` union again — 287 KB back, nothing looks
 *     wrong because every key still resolves
 *   · someone adds a t("orders.…") to a screen that never imported orders —
 *     `t()` returns the key itself, and only a reader notices
 * Both fail the build here.
 *
 * Run: npm run validate:contacts-i18n
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NS_DIR = "src/lib/translations/contacts";
const COMPONENTS = "src/components";
const LANGS = ["en", "zh", "ar"] as const;

let failures = 0;
const fail = (m: string, d?: string) => { failures++; console.error(`  ✗ ${m}${d ? `\n      ${d}` : ""}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const nsFiles = fs.readdirSync(path.join(ROOT, NS_DIR))
  .filter((f) => f.endsWith(".ts") && f !== "__none__.ts")
  .map((f) => f.slice(0, -3));

/** key → the namespace that defines it. */
const owner = new Map<string, string>();
const dupes: string[] = [];
for (const n of nsFiles) {
  const src = fs.readFileSync(path.join(ROOT, NS_DIR, `${n}.ts`), "utf8");
  const body = src.slice(src.indexOf("= {"));
  for (const m of body.matchAll(/^\s{2}"([^"]+)":/gm)) {
    if (owner.has(m[1])) dupes.push(m[1]); else owner.set(m[1], n);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}
const files = walk(COMPONENTS).filter((f) => fs.readFileSync(path.join(ROOT, f), "utf8").includes("translations/contacts"));

console.log(`\nA. The split holds — ${nsFiles.length} namespaces, ${owner.size} keys, ${files.length} contacts components`);
dupes.length
  ? fail(`${dupes.length} key(s) defined in more than one namespace file`, [...new Set(dupes)].slice(0, 8).join(", "))
  : ok("no key is defined twice");

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  const name = path.basename(f);
  /* ⚠️ The union, and the module that re-exports it. Importing either brings
     all 51 namespaces, and every key still resolves — so nothing looks wrong. */
  if (/^\s*import\s*\{[^}]*\bcontactsT\b/m.test(src)) {
    fail(`${name} imports the contactsT union`, "287 KB back on this route. Import the namespaces it reads from translations/contacts/<ns>.");
    continue;
  }
  const imported = new Set([...src.matchAll(/from "@\/lib\/translations\/contacts\/([a-zA-Z-]+)"/g)].map((m) => m[1]));
  const called = [...new Set([...src.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]))].filter((k) => owner.has(k));
  const uncovered = called.filter((k) => !imported.has(owner.get(k)!));
  if (uncovered.length) {
    fail(`${name} calls ${uncovered.length} key(s) it does not import`,
         uncovered.slice(0, 5).map((k) => `${k} → needs ${owner.get(k)}`).join(", ") +
         "\n      t() returns the key itself — the screen shows \"orders.title\" to an operator.");
  }
}
if (!failures) ok("every component imports exactly the namespaces it calls");

console.log("\nB. Three languages, everywhere");
{
  let bad = 0, total = 0;
  for (const n of nsFiles) {
    const src = fs.readFileSync(path.join(ROOT, NS_DIR, `${n}.ts`), "utf8");
    for (const m of src.matchAll(/^\s{2}"([^"]+)":\s*\{([\s\S]*?)\}\s*,?\s*$/gm)) {
      total++;
      if (LANGS.some((l) => !new RegExp(`\\b${l}\\s*:`).test(m[2]))) { bad++; if (bad <= 5) fail(`${n}: "${m[1]}" is missing a language`); }
    }
  }
  if (!bad) ok(`all ${total} entries carry en/zh/ar`);
}

console.log(failures === 0 ? "\n✓ contacts i18n: all checks passed" : `\n✗ ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
