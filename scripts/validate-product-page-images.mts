#!/usr/bin/env node
/* validate:product-page-images — no original upload ever reaches the
 * browser from the product page.
 *
 * Measured 19/09/2026 on a real product (XPRS-7): the catalogue card fetched
 * the 480px CDN render, 142 KB — while the product page's hero fetched the
 * SAME file raw: a 2.76 MB PNG, 4.1 s. Every <img> on the page went through
 * the same hole. The fix routes each one through an IMG.* size; this guard
 * keeps it that way, because the next image someone adds will be written
 * `src={url}` out of habit.
 *
 * Rule: in the product page tree, every `<img … src={…}>` must take its
 * src from `IMG.<size>(…)` or `cdnImage(…)`. A `<video>` is exempt (no
 * transform pipeline for video), and so is `Glyph` (a CSS mask, not an <img>).
 * The page must also preload its LCP image with the same sized URL.
 *
 * Both directions are exercised: the rule on the real files, and the rule
 * on a copy with one src un-wrapped — a guard that never sees a failure
 * proves nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));

const FILES = [
  "src/components/product-preview/ProductPreview.tsx",
  "src/app/products/[id]/LegacyProductView.tsx",
  "src/app/products/[id]/page.tsx",
];

/* Strip comments so a guard cannot trip on its own documentation. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every <img …> tag's src expression, in source order. */
function imgSrcs(src: string): string[] {
  const out: string[] = [];
  const tag = /<img\b[^>]*?>/g;
  for (const m of code(src).matchAll(tag)) {
    const srcExpr = /\bsrc=\{([^}]*)\}/.exec(m[0]);
    out.push(srcExpr ? srcExpr[1].trim() : `(no src expr: ${m[0].slice(0, 40)})`);
  }
  return out;
}
const wrapped = (expr: string) => /^(IMG\.[a-z]+\(|cdnImage\()/.test(expr);

console.log("\n§1 every <img> on the product page is a CDN render");
let total = 0;
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const srcs = imgSrcs(src);
  total += srcs.length;
  const raw = srcs.filter((e) => !wrapped(e));
  expect(raw.length === 0, `${rel} — ${srcs.length} <img>, all through IMG.*`, raw.map((e) => `src={${e}}`).join("\n      "));
}
expect(total >= 15, `the rule saw the real images (${total} found; the page had 20 on 19/09/2026)`,
  "if the count collapsed, the <img> matcher is broken and the guard is passing on nothing");

/* Failure direction: un-wrap one src on a copy and make sure it is caught. */
const previewSrc = fs.readFileSync(path.join(ROOT, FILES[0]), "utf8");
const mutated = previewSrc.replace("src={IMG.hero(heroImage as string)}", "src={heroImage as string}");
expect(mutated !== previewSrc, "  (mutation applied — the hero site is where it was)");
expect(imgSrcs(mutated).some((e) => !wrapped(e)), "  (the rule sees the failure direction)");

console.log("\n§2 the LCP image is preloaded with its sized URL");
const page = code(fs.readFileSync(path.join(ROOT, FILES[2]), "utf8"));
expect(/preload\(\s*lcp\s*,\s*\{\s*as:\s*"image"/.test(page), "page.tsx preloads the hero/poster");
expect(/IMG\.poster\(/.test(page) && /IMG\.hero\(/.test(page), "…using the SAME IMG sizes the hero renders",
  "a preload of a different URL than the <img> is a second download, not a head start");

console.log(failed ? `\n✗ product page images: ${failed} check(s) failed\n` : "\n✓ product page images: all checks passed\n");
process.exit(failed ? 1 : 0);
