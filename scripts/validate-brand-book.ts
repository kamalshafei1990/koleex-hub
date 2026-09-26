#!/usr/bin/env tsx

/* ===========================================================================
   validate-brand-book — the KOLEEX Brand Guidelines' table of contents holds
   together.

   Checks (no network, no database):
     01  140 chapters, numbered 1..140 with no gap or repeat.
     02  Every slug is unique and kebab-case.
     03  The parts cover 1..140 exactly, in order, with no overlap.
     04  Every chapter has an English, Chinese and Arabic title.
     05  Every READY chapter has a view in the registry, and every view in
         the registry belongs to a READY chapter (read from the source file,
         so a view for a chapter nobody marked ready is caught too).
     06  Every file the chapters offer for download exists under public/.
     07  Every chapter the book cross-references (<Ref n={…} />) exists.
   ========================================================================== */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { BOOK_CHAPTERS, BOOK_PARTS } from "../src/lib/brand-book/chapters";

const ROOT = resolve(__dirname, "..");
const fails: string[] = [];
const fail = (rule: string, msg: string) => fails.push(`${rule}  ${msg}`);

/* 01 */
if (BOOK_CHAPTERS.length !== 140) fail("01", `expected 140 chapters, found ${BOOK_CHAPTERS.length}`);
BOOK_CHAPTERS.forEach((c, i) => { if (c.n !== i + 1) fail("01", `row ${i + 1} is numbered ${c.n}`); });

/* 02 */
const slugs = new Set<string>();
for (const c of BOOK_CHAPTERS) {
  if (slugs.has(c.slug)) fail("02", `duplicate slug ${c.slug}`);
  slugs.add(c.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)) fail("02", `slug not kebab-case: ${c.slug}`);
}

/* 03 */
let expect = 1;
for (const p of BOOK_PARTS) {
  if (p.from !== expect) fail("03", `part ${p.n} starts at ${p.from}, expected ${expect}`);
  if (p.to < p.from) fail("03", `part ${p.n} ends before it starts`);
  expect = p.to + 1;
}
if (expect !== 141) fail("03", `parts end at ${expect - 1}, expected 140`);

/* 04 */
for (const c of BOOK_CHAPTERS) {
  for (const l of ["en", "zh", "ar"] as const) {
    if (!c.title[l]?.trim()) fail("04", `chapter ${c.n} has no ${l} title`);
  }
}

/* 05 */
const registry = readFileSync(join(ROOT, "src/components/knowledge/brand-book/registry.tsx"), "utf8");
const viewSlugs = new Set([...registry.matchAll(/^\s*"([a-z0-9-]+)":\s*dynamic\(/gm)].map((m) => m[1]));
for (const c of BOOK_CHAPTERS.filter((x) => x.ready)) {
  if (!viewSlugs.has(c.slug)) fail("05", `chapter ${c.n} (${c.slug}) is ready but has no view`);
}
for (const s of viewSlugs) {
  const c = BOOK_CHAPTERS.find((x) => x.slug === s);
  if (!c) fail("05", `view "${s}" matches no chapter`);
  else if (!c.ready) fail("05", `view "${s}" exists but chapter ${c.n} is not marked ready`);
}

/* 06 + 07 */
const dir = join(ROOT, "src/components/knowledge/brand-book");
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => join(dir, f)),
  ...readdirSync(join(dir, "chapters")).map((f) => join(dir, "chapters", f)),
];
const known = new Set(BOOK_CHAPTERS.map((c) => c.n));
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:href|src)=?[:=]?\s*[{]?\s*["'`](\/(?:brand|icon)[^"'`]*\.(?:svg|png|webp|zip|css|json))["'`]/g)) {
    if (!existsSync(join(ROOT, "public", m[1]))) fail("06", `${f.slice(ROOT.length + 1)} offers ${m[1]}, which is not in public/`);
  }
  for (const m of src.matchAll(/<Ref n=\{(\d+)\}/g)) {
    if (!known.has(Number(m[1]))) fail("07", `${f.slice(ROOT.length + 1)} refers to chapter ${m[1]}, which does not exist`);
  }
}
/* The Hub mark files are built by a function; check the ones the book uses. */
for (const v of ["for-dark", "for-light", "mono-dark", "mono-light"]) {
  const p = `/brand/hub-logo/koleex-hub-logo-${v}-e.png`;
  if (!existsSync(join(ROOT, "public", p))) fail("06", `missing ${p}`);
}
for (const v of ["for-dark", "for-light"]) {
  const p = `/brand/hub-logo/koleex-hub-stacked-${v}-e.png`;
  if (!existsSync(join(ROOT, "public", p))) fail("06", `missing ${p}`);
}

const ready = BOOK_CHAPTERS.filter((c) => c.ready).length;
if (fails.length) {
  console.error(`validate-brand-book: ${fails.length} problem(s)\n` + fails.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
console.log(`validate-brand-book: OK — 140 chapters in ${BOOK_PARTS.length} parts, ${ready} ready, ${viewSlugs.size} views, downloads and cross-references resolve.`);
