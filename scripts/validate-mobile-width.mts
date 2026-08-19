#!/usr/bin/env node
/* validate:mobile-width — static guard against the two defects that made the
 * Hub "dance" on a phone. Both were real, both were found by measuring at
 * 375px, and neither had anything stopping it from coming back.
 *
 * A page that scrolls sideways is never a styling nit: the header drifts, taps
 * land on the wrong control, and the app reads as broken. The owner's rule is
 * absolute — nothing overflows the screen.
 *
 * PATTERN 1 — a hardcoded negative margin used to bleed to the screen edge.
 *   App shells wrap content in `px-4 md:px-6 lg:px-8`: 16px on a phone, 24
 *   from md. A section bleeding with -24px is right on a laptop and 8px too
 *   wide on a phone. Bleed with `var(--kx-bleed)`, which is defined from the
 *   same breakpoints in globals.css, so the two cannot disagree.
 *
 * PATTERN 2 — a grid whose items may not shrink.
 *   A grid track sizes to `min-width: auto`, so an item never gets narrower
 *   than its own content: one expense row measured 459px inside a 343px
 *   column and pushed the page to 475px. A grid holding rows of text needs
 *   `[&>*]:min-w-0` (or min-w-0 on the items) before any truncation works.
 *
 * Static, so it runs in CI with no browser. It cannot prove a page fits —
 * only measurement does that — but it does stop these two from returning.
 *
 * Run: node --import tsx scripts/validate-mobile-width.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const R = (p: string) => path.join(ROOT, p);

let failed = 0;
function ok(label: string, pass: boolean, detail = "") {
  console.log(`  ${pass ? "✓" : "✗"} ${label}${pass || !detail ? "" : ` — ${detail}`}`);
  if (!pass) failed += 1;
}

/** Every .tsx under src, excluding build output. */
function sources(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      sources(full, acc);
    } else if (e.name.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

const files = sources(R("src"));
const rel = (f: string) => path.relative(ROOT, f);

console.log("A. Bleed must follow the container's padding");

/* --kx-bleed has to exist, or the guidance below points at nothing. */
const css = fs.readFileSync(R("src/app/globals.css"), "utf8");
ok("--kx-bleed is defined", /:root\s*\{[^}]*--kx-bleed/.test(css));
ok("--kx-bleed tracks the md breakpoint",
  /min-width:\s*768px[^}]*\}[\s\S]{0,120}--kx-bleed/.test(css) ||
  /--kx-bleed[\s\S]{0,200}min-width:\s*768px/.test(css));

/* A negative inline margin of 24px (or 1.5rem) inside a component that also
   pads by the same amount is the bleed pattern — and at 375px it overflows. */
const bleedOffenders: string[] = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  /* JS style objects: marginInline: -24 with paddingInline: 24 */
  if (/marginInline:\s*-24\b/.test(src) && /paddingInline:\s*24\b/.test(src)) {
    bleedOffenders.push(`${rel(f)} (marginInline: -24)`);
  }
  /* Tailwind bleeds are fine when RESPONSIVE — `-mx-4 md:-mx-6 lg:-mx-8`
     shrinks to the phone gutter on its own. The defect is an UNPREFIXED
     -mx-6/-mx-8 with no -mx-4 base beside it: that applies 24px at every
     width, including the 16px one.

     (The first version of this check flagged all seven responsive chains in
     the repo. Every one was correct; the check was not. Verified by reading
     them before changing anything.) */
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const cls = m[1] ?? m[2] ?? "";
    if (!/(^|\s)-mx-(6|8)(\s|$)/.test(cls)) continue;   // unprefixed only
    if (/(^|\s)-mx-4(\s|$)/.test(cls)) continue;        // has a phone base
    if (!/\bpx-\d/.test(cls)) continue;                 // must be the bleed trick
    bleedOffenders.push(`${rel(f)}: ${cls.replace(/\s+/g, " ").slice(0, 50)}`);
  }
}
ok("no fixed-24px bleed that overflows a 375px screen",
  bleedOffenders.length === 0, bleedOffenders.join(" | "));

console.log("\nB. Grid items must be allowed to shrink");

/* The ExpensesApp defect: a <ul>/<ol> whose class is a bare `grid gap-N`
   (no explicit tracks) and whose children come from a .map — a list of
   full-width rows. Those hold names, companies and amounts that routinely
   exceed a phone's width, and `min-width: auto` stops the track shrinking.

   Narrowed deliberately. A first version flagged four more grids; all four
   were MEASURED at 375px and none leaked a pixel — they hold cards that are
   already narrow. A guard that cries wolf gets switched off, so it only
   watches the shape that actually broke. */
const gridOffenders: string[] = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/<(ul|ol)\b[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})[^>]*>\s*\n?\s*\{[^}]*\.map\(/g)) {
    const cls = m[2] ?? m[3] ?? "";
    if (!/\bgrid\b/.test(cls)) continue;
    if (/grid-cols-|grid-flow-col|auto-cols-/.test(cls)) continue;
    if (!/\bgap-\d/.test(cls)) continue;
    if (/min-w-0/.test(cls)) continue;
    gridOffenders.push(`${rel(f)}: <${m[1]}> ${cls.replace(/\s+/g, " ").slice(0, 44)}`);
  }
}
ok("single-column row grids let their items shrink",
  gridOffenders.length === 0, gridOffenders.slice(0, 4).join(" | "));

console.log("\nC. Content must clear the frosted ramp");

/* The shell offsets content by --kx-header-h, so a page starts under the
   solid header. But the progressive pane extends 3rem FURTHER as an approach
   ramp. On desktop a page's own top padding usually covers that; on an
   iPhone the safe-area grows the header, the ramp moves down with it, and
   whatever sits first lands INSIDE the blur before any scrolling — the owner
   photographed exactly that on a 17 Pro Max (the greeting, and Discuss's
   "New" button). .kx-below-ramp clears the same 3rem the ramp adds. */
ok(".kx-below-ramp exists", /\.kx-below-ramp\s*\{[^}]*padding-top:\s*3rem/.test(css));
ok("the phone-only variant exists and wins the cascade",
  /max-md\\:kx-below-ramp\s*\{[^}]*padding-top:\s*3rem\s*!important/.test(css));
/* Desktop keeps the header + 3rem ramp; PHONES get header height exactly.
   The ramp is a tall-window affordance — on a phone its soft bottom edge
   lands behind the wordmark, and because the bar is pure blur with no fill,
   that reads as the header smearing the logo. Three earlier attempts moved
   the LAYERS and left this height alone, which is why every measurement said
   "no overlap" while the phone kept looking wrong. */
ok("desktop keeps the header + 3rem ramp",
  /\.kx-pane-progressive\s*\{[^}]*height:\s*calc\(var\(--kx-header-h[^)]*\)\s*\+\s*3rem\)/.test(css));
ok("phones stop the blur at the header edge",
  /max-width:\s*767px[\s\S]{0,220}\.kx-pane-progressive\s*\{[^}]*height:\s*var\(--kx-header-h/.test(css));

/* THE HEADER BAR HAS NO FILL OF ITS OWN — "the bar is now the ground itself,
   frosted". Its glass IS the progressive pane's layers, which must therefore
   cover the whole pane including the bar.

   This check exists because I got it backwards: chasing "the blur covers the
   logo", I moved the layers to start BELOW the header. Measurements agreed
   (no blur box overlapped the logo) and the owner still saw the defect —
   because removing the blur from the bar leaves the wordmark sitting on raw
   scrolled content, which reads exactly like the header washing over it.
   Strip comments before matching: the rule's own note quotes the reverted
   value while explaining it. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
const paneItem = /\.kx-pane-progressive > i \{([^}]*)\}/.exec(cssCode)?.[1] ?? "";
ok("blur layers cover the whole pane, header included",
  /inset:\s*0/.test(paneItem) && !/top:\s*var\(--kx-header-h/.test(paneItem));
const barRule = /\.kx-mainheader[^{]*\{([^}]*)\}/.exec(cssCode)?.[1] ?? "";
ok("the header bar still has no fill of its own (the pane is its glass)",
  !/background(-color)?:\s*(?!transparent|none)[^;]*(rgb|#|hsl)/.test(barRule));

console.log("\n" + "─".repeat(60));
console.log(failed === 0 ? "✓ mobile-width: all checks passed" : `✗ mobile-width: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
