#!/usr/bin/env node
/* validate:product-page-brand — on a product page the brand is a MARK, never
 * the word.
 *
 * Owner rule (19/09/2026): "don't ever write Koleex name as text — use the
 * original logo." One component draws it (components/brand/KoleexMark.tsx);
 * this guard makes sure the product page tree never routes around it:
 *
 *   1. No literal KOLEEX / Koleex in JSX text or string literals of the
 *      page tree. Allowed: asset paths (/brand/koleex-logo-*.svg), the
 *      koleexgroup.com domain, identifiers (KoleexMark, isKoleexBrand), the
 *      mark's own aria-label, and the browser-tab <title> in generateMetadata
 *      (a tab title is not the page).
 *   2. The `brand` prop is never rendered directly — `{brand}` inside JSX
 *      is exactly how the word gets back on the page — only handed to
 *      BrandMark.
 *
 * Both directions on every rule: the real files, and a mutated copy that
 * must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));

const FILES = [
  "src/app/products/[id]/page.tsx",
  "src/components/product-preview/ProductHero.tsx",
  "src/components/product-preview/ProductPreview.tsx",
  "src/components/product-preview/ProductRail.tsx",
  "src/components/product-preview/ProductKnowledge.tsx",
  "src/components/product-preview/ProductSpecs.tsx",
  "src/components/product-preview/ProductMedia.tsx",
  "src/components/product-preview/ProductCompare.tsx",
  "src/components/product-print/ProductPrintDoc.tsx",
  "src/app/products/[id]/print/page.tsx",
];

const code = (src: string) => stripComments(src);

/** Lines that write the brand as a word, after removing every allowed form. */
function brandWords(src: string): string[] {
  const cleaned = code(src)
    .replace(/generateMetadata[\s\S]*?\n}\n/, "")            // the tab title lives here
    .replace(/\/brand\/koleex-[a-z-]+\.svg/g, "")           // asset paths
    .replace(/koleexgroup\.com/g, "")                        // the domain
    .replace(/koleex:[a-z-]+/g, "")                          // window event names (koleex:ai-open)
    .replace(/[A-Za-z_]*[Kk]oleex[A-Za-z_]+/g, "")           // identifiers: KoleexMark, isKoleexBrand, koleexHub…
    .replace(/aria-label="KOLEEX"/g, "");
  return cleaned.split("\n").filter((l) => /\bkoleex\b/i.test(l)).map((l) => l.trim());
}
/** `{brand}` rendered straight into JSX (not as a prop value). */
const rawBrandRenders = (src: string) => code(src).split("\n").filter((l) => /(^|[^=])\{brand\}/.test(l)).map((l) => l.trim());

console.log("\n§1 the word never appears");
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const hits = brandWords(src);
  expect(hits.length === 0, `${rel} — no KOLEEX as text`, hits.join("\n      "));
}
{
  const src = fs.readFileSync(path.join(ROOT, FILES[1]), "utf8");
  const mutated = src.replace(/<BrandMark brand=\{p\.brand\}[^/]*\/>/, "<span>KOLEEX</span>");
  expect(mutated !== src, "  (mutation applied at the hero's brand line)");
  expect(brandWords(mutated).length === 1, "  (the rule sees the failure direction)");
}

console.log("\n§2 `brand` only reaches the page through BrandMark");
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const hits = rawBrandRenders(src);
  expect(hits.length === 0, `${rel} — no raw {brand} render`, hits.join("\n      "));
}
{
  const src = fs.readFileSync(path.join(ROOT, FILES[1]), "utf8");
  const mutated = src.replace(/<BrandMark brand=\{p\.brand\}[^/]*\/>/, "<span>{brand}</span>");
  expect(rawBrandRenders(mutated).length === 1, "  (the rule sees the failure direction)");
  expect(/import \{ BrandMark \} from "@\/components\/brand\/KoleexMark"/.test(src), "ProductHero imports BrandMark from the one mark component");
}

console.log(failed ? `\n✗ product page brand: ${failed} check(s) failed\n` : "\n✓ product page brand: all checks passed\n");
process.exit(failed ? 1 : 0);
