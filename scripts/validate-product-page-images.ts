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
 *
 * §4 (27/09/2026): a photo can only show if it was saved at all.
 * product_media.type has a CHECK constraint (valid_media_type), so every
 * insert must use one of its 13 values. ProductMediaType must be that same
 * list. Quotation photos were saved as "image", rejected by the database,
 * and dropped without a trace.
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
  "src/components/product-preview/ProductHero.tsx",
  "src/components/product-preview/ProductPreview.tsx",
  "src/components/product-preview/ProductHighlights.tsx",
  "src/components/product-preview/ProductOptions.tsx",
  "src/components/product-preview/ProductPacking.tsx",
  "src/components/product-preview/ProductMedia.tsx",
  "src/components/product-preview/ProductCompare.tsx",
  "src/components/product-preview/ProductRail.tsx",
  "src/app/products/[id]/page.tsx",
  "src/components/product-print/ProductPrintDoc.tsx",
];

/* Strip comments so a guard cannot trip on its own documentation. */
const code = (src: string) => stripComments(src);

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
expect(total >= 10, `the rule saw the real images (${total} found; 14 on 19/09/2026 after the legacy view retired)`,
  "if the count collapsed, the <img> matcher is broken and the guard is passing on nothing");

/* Failure direction: un-wrap one src on a copy and make sure it is caught. */
const previewSrc = fs.readFileSync(path.join(ROOT, FILES.find((f) => f.endsWith("/ProductHero.tsx"))!), "utf8");
const mutated = previewSrc.replace("src={IMG.hero(heroImage)}", "src={heroImage}");
expect(mutated !== previewSrc, "  (mutation applied — the hero site is where it was)");
expect(imgSrcs(mutated).some((e) => !wrapped(e)), "  (the rule sees the failure direction)");

console.log("\n§2 the LCP image is preloaded with its sized URL");
const page = code(fs.readFileSync(path.join(ROOT, FILES.find((f) => f.endsWith("/page.tsx"))!), "utf8"));
expect(/preload\(\s*lcp\s*,\s*\{\s*as:\s*"image"/.test(page), "page.tsx preloads the hero/poster");
expect(/IMG\.poster\(/.test(page) && /IMG\.hero\(/.test(page), "…using the SAME IMG sizes the hero renders",
  "a preload of a different URL than the <img> is a second download, not a head start");

console.log("\n§3 the client tree never imports the product-schema barrel");
/* index.ts imports every spec template (532 KB of source) to build the
   server-side registry. A client module that imports ONE helper through it
   ships the lot. The helpers live in leaf modules; import those. */
const CLIENT_TREE = [
  "src/components/product-preview/ProductPreview.tsx",
  "src/components/product-preview/ProductHero.tsx",
  "src/components/product-preview/ProductHighlights.tsx",
  "src/components/product-preview/ProductOptions.tsx",
  "src/components/product-preview/ProductPacking.tsx",
  "src/components/product-preview/ProductCompliance.tsx",
  "src/components/product-preview/ProductPriceInternal.tsx",
  "src/components/product-preview/ProductKeyFigures.tsx",
  "src/components/product-preview/ProductSpecs.tsx",
  "src/components/product-preview/ProductKnowledge.tsx",
  "src/components/product-preview/ProductMedia.tsx",
  "src/components/product-preview/ProductCompare.tsx",
  "src/components/product-preview/ProductRail.tsx",
  "src/components/product-preview/shared.tsx",
  "src/components/product-print/ProductPrintDoc.tsx",
];
const barrelImport = /from\s+"@\/lib\/product-schema"/;
for (const rel of CLIENT_TREE) {
  const src = code(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  expect(!barrelImport.test(src), `${rel} — no import from the @/lib/product-schema barrel`,
    "import the helper from its leaf module (visibility.ts / visual-options.ts / derived.ts)");
}
{
  const src = code(fs.readFileSync(path.join(ROOT, CLIENT_TREE[0]), "utf8"));
  const mutated = src.replace('from "@/lib/product-schema/visibility"', 'from "@/lib/product-schema"');
  expect(mutated !== src && barrelImport.test(mutated), "  (the rule sees the failure direction)");
}

console.log("\n§4 every photo the Hub saves has a type product_media accepts");
/* product_media.type has a CHECK constraint, valid_media_type, with exactly
   these 13 values (read from pg_constraint, 27/09/2026). The database
   rejects any other type. save-cost-from-quotation saved "image" and never
   read the error, so every photo saved from a quotation was dropped without
   a trace. The union the renderers switch on must be this same list, and
   every insert must use one of its values. */
const DB_MEDIA_TYPES = ["main_image", "gallery", "packing_photo", "label", "logo_detail", "manual", "ar_3d", "video", "model_image", "datasheet", "brochure", "certificate", "parts_list"];
const unionSrc = /export type ProductMediaType =([^;]+);/.exec(code(fs.readFileSync(path.join(ROOT, "src/types/supabase.ts"), "utf8")))?.[1] ?? "";
const unionTypes = [...unionSrc.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
expect(unionTypes.length === DB_MEDIA_TYPES.length && DB_MEDIA_TYPES.every((t) => unionTypes.includes(t)),
  `ProductMediaType is the database's list (${unionTypes.length} of ${DB_MEDIA_TYPES.length})`, `union: ${unionTypes.join(", ")}`);

/** The text between a call's "(" and its matching ")", stepping over strings. */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++; continue; }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return "";
}
/** Every literal `type:` a product_media insert/upsert or a createProductMedia(…) call writes. */
function mediaTypesWritten(src: string): string[] {
  const out: string[] = [];
  const s = code(src);
  for (const m of s.matchAll(/\.from\(\s*["']product_media["']\s*\)\s*\.(?:insert|upsert)\(|\bcreateProductMedia\(/g)) {
    const args = callArgs(s, m.index + m[0].length - 1);
    for (const t of args.matchAll(/\btype:\s*["']([^"']+)["']/g)) out.push(t[1]);
  }
  return out;
}
function walkCode(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, f);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) { if (f !== "node_modules") walkCode(rel, out); }
    else if (/\.(ts|tsx|mjs|js)$/.test(f) && !/^validate-/.test(f)) out.push(rel);
  }
  return out;
}
const written: Array<{ file: string; type: string }> = [];
for (const rel of [...walkCode("src"), ...walkCode("scripts")]) {
  for (const type of mediaTypesWritten(fs.readFileSync(path.join(ROOT, rel), "utf8"))) written.push({ file: rel, type });
}
const unknown = written.filter((w) => !DB_MEDIA_TYPES.includes(w.type));
expect(unknown.length === 0, `every product_media insert writes a known type (${written.length} literal types seen)`,
  unknown.map((w) => `${w.file}: type "${w.type}"`).join("\n      "));
expect(written.length >= 6, "the matcher saw the real inserts (6 on 27/09/2026: quotation ×2, Main Photo slot, model photo, catalog import, catalog retry)",
  "if the count collapsed, the insert matcher is broken and the guard is passing on nothing");
const quoteRoute = fs.readFileSync(path.join(ROOT, "src/app/api/products/save-cost-from-quotation/route.ts"), "utf8");
const quote = code(quoteRoute);
expect((quote.match(/const \{ error: photoErr \} = await supabaseServer\.from\("product_media"\)\.insert\(/g) ?? []).length === 2 && (quote.match(/if \(photoErr\)/g) ?? []).length === 2,
  "a quotation photo reads its insert error (both paths)", "an unread insert error is how every quotation photo disappeared");
{
  const mutated = quoteRoute.replace('type: "main_image"', 'type: "image"');
  expect(mutated !== quoteRoute && mediaTypesWritten(mutated).includes("image"), "  (the rule sees the failure direction)");
}

console.log(failed ? `\n✗ product page images: ${failed} check(s) failed\n` : "\n✓ product page images: all checks passed\n");
process.exit(failed ? 1 : 0);
