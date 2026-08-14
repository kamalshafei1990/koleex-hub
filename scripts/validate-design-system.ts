#!/usr/bin/env tsx

/* ===========================================================================
   UNI-39 — Design-system drift detector.

   Locks in the unification work (UNI-1..UNI-38) by failing CI when a
   contributor inlines something that already has a shared source of truth.
   Each assertion is a regex scan over src/ — no Supabase, no runtime.

   Assertions:
     01  No `border-l-{tone}-500/70` accent declarations outside
         src/lib/accentColors.ts (use ACCENT.* instead).
     02  No `chipBg:   "bg-{tone}-500/10"` accent shape outside
         src/lib/accentColors.ts.
     03  No `searchPlaceholder="Search …"` string literals — every app
         must go through useSearchPlaceholder().
     04  No `lucide-react` import — the Hub uses src/components/icons/ui/
         and src/components/ui/RrIcon.tsx exclusively.
     05  No `placeholder="Search …..."` (three dots) — use the ellipsis
         character (…) for consistency.
     06  No local re-implementation of the canonical Button: every
         `<button …rounded-md…bg-white…>` action button should go through
         @/components/ui/Button. (Heuristic — flags new ad-hoc cases.)
     07  No local KpiCard: every "KPI tile" must use @/components/ui/KpiCard.
         (Heuristic — flags new local definitions named `KpiCard`.)
     08  A full-bleed list row that declares `role="button"` must carry
         `data-kx-keep-hover`. See the block comment on that rule below.
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC  = join(ROOT, "src");

interface Finding { file: string; line: number; text: string; rule: string; }

const findings: Finding[] = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function scan(rule: string, files: string[], pattern: RegExp, allowlist: RegExp[] = []) {
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (allowlist.some((re) => re.test(rel))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      if (pattern.test(text)) findings.push({ file: rel, line: i + 1, text: text.trim(), rule });
    });
  }
}

const files = walk(SRC);

scan(
  "01 accent border literal",
  files,
  /border-l-(blue|teal|amber|violet|rose|emerald|sky|indigo|pink)-500\/70/,
  [/src\/lib\/accentColors\.ts$/],
);

scan(
  "02 accent chip literal",
  files,
  /chipBg:\s*["`']bg-(blue|teal|amber|violet|rose|emerald|sky|indigo|pink)-500\/10/,
  [/src\/lib\/accentColors\.ts$/],
);

// Rule 03 only catches the "Search X, Y, Z…" canonical pattern used by app
// chrome (PageHeader). It deliberately ignores short single-noun pickers like
// "Search employees…" because those live inside drawer/picker components,
// not app-level search bars.
scan(
  "03 inline searchPlaceholder (app chrome)",
  files,
  /searchPlaceholder=["'`]Search [^"'`{,]+,[^{]/,
  [/src\/lib\/searchPlaceholders\.ts$/],
);

scan(
  "04 lucide-react import",
  files,
  /from\s+["']lucide-react["']/,
  [],
);

scan(
  "05 three-dot ellipsis in Search placeholder",
  files,
  /placeholder=["'`]Search[^"'`]*\.\.\.["'`]/,
  [],
);

// FinanceUi.KpiCard and ExecutiveDashboard.KpiCard are intentional rich
// variants (sparkline/delta/currency for Finance; primary/secondary tier
// for the executive cockpit) — neither fits the lean shared KpiCard yet.
// Allowlisting them documents the exception explicitly so unrelated drift
// still gets caught.
scan(
  "07 local KpiCard redefinition",
  files,
  /^(?:export\s+)?(?:default\s+)?function\s+KpiCard\b/,
  [
    /src\/components\/ui\/KpiCard\.tsx$/,
    /src\/components\/executive\/ExecutiveDashboard\.tsx$/,
    /src\/components\/finance\/FinanceUi\.tsx$/,
  ],
);

/* ── 08 — full-bleed row + role="button" must opt out of Aurora's control hover
   ───────────────────────────────────────────────────────────────────────────
   globals.css (~2369) forces a Hub-Blue `border-color` and a 3% white fill with
   `!important` on `:is(button, a, summary, [role="button"])` inside a converted
   app. It is written for CONTROLS. A list row that declares `role="button"` so
   it can be opened from the keyboard gets caught by it too — and on a full-bleed
   row with `border-radius: 0` that is not a rim, it is a hard blue box around
   the whole row. Owner reported it on the Contacts directory twice: rounding
   the highlight did not fix it, because the border is on the row and the row IS
   the full-bleed box.

   `data-kx-keep-hover` is that rule's own documented escape hatch. Stamp it on
   the row and the row keeps whatever hover it defines for itself.

   ⚠️ Do NOT "fix" a new violation by adding another `:not()` to the CSS
   selector. It already sits at (0,8,0) and other rules depend on being
   outranked by it; every `:not()` adds (0,1,0) and moves that target.

   ⚠️ DETECTION MUST RESOLVE THE ELEMENT, NOT A WINDOW. A ±20-line window around
   the divider was tried and is useless: it returned 28 findings, nearly all of
   them `<div className="p-2 border-b …">` padding wrappers, `<tr>`s and `<li>`s
   that merely happened to sit near some button. The divider class has to be
   traced to the element that actually carries it, and only then is that element
   checked for being one the CSS selector matches.

   Two shapes carry it, and both occur in this repo:
     A  inline  — `<button … className="… border-b …">`
     B  hoisted — `const cls = \`… border-b …\`` used later as `className={cls}`
   B is how the Settings nav rows are written, and an earlier version of this
   rule that only walked UP from the divider missed all of them. */
{
  const ROW_DIVIDER = /border-b border-\[var\(--border-faint\)\]/;
  /* What the Aurora selector matches. A plain <div> row is NOT in it unless it
     declares role="button" — which is why the wrappers above must not flag. */
  const INTERACTIVE_TAG = /^\s*<\s*(button|a|Link|summary)\b/;
  const ANY_TAG = /^\s*<\s*[A-Za-z]/;

  for (const file of files) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, "utf8").split("\n");

    /** Read the open tag that starts at `start`, up to its closing `>`. */
    const openTagAt = (start: number): { text: string; head: string } | null => {
      if (!ANY_TAG.test(lines[start])) return null;
      const buf: string[] = [];
      for (let j = start; j < lines.length && j - start < 30; j++) {
        buf.push(lines[j]);
        if (/>\s*$/.test(lines[j]) || /\/>\s*$/.test(lines[j])) break;
      }
      return { text: buf.join("\n"), head: lines[start] };
    };
    /** Walk up from `i` to the line that opens the element containing it. */
    const elementStart = (i: number): number | null => {
      for (let j = i; j >= 0 && i - j < 30; j--) if (ANY_TAG.test(lines[j])) return j;
      return null;
    };
    const check = (start: number, reportLine: number, reportText: string) => {
      const tag = openTagAt(start);
      if (!tag) return;
      const isInteractive = INTERACTIVE_TAG.test(tag.head) || /role=["']button["']/.test(tag.text);
      if (!isInteractive) return;
      if (/data-kx-keep-hover/.test(tag.text)) return;
      findings.push({ file: rel, line: reportLine + 1, text: reportText.trim(), rule: "08 interactive row divider without data-kx-keep-hover" });
    };

    lines.forEach((text, i) => {
      if (!ROW_DIVIDER.test(text)) return;

      /* B — is this divider inside a hoisted `const NAME = ...`? Then the
         element to check is wherever NAME is spread into a className. */
      let varName: string | null = null;
      for (let j = i; j >= 0 && i - j < 8; j--) {
        const m = lines[j].match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/);
        if (m) { varName = m[1]; break; }
        if (ANY_TAG.test(lines[j])) break;   // an element opened first → shape A
      }
      if (varName) {
        const use = new RegExp(`className=\\{\\s*\`?[^}]*\\b${varName}\\b`);
        let found = false;
        lines.forEach((l, k) => {
          if (!use.test(l)) return;
          found = true;
          const s = elementStart(k);
          if (s !== null) check(s, i, text);
        });
        if (found) return;
      }

      /* A — the divider sits in the element's own className. */
      const s = elementStart(i);
      if (s !== null) check(s, i, text);
    });
  }
}

if (findings.length === 0) {
  console.log("✓ Design-system drift detector — all checks passed.");
  process.exit(0);
}

console.error("✗ Design-system drift detector found", findings.length, "issue(s):\n");
const byRule = new Map<string, Finding[]>();
for (const f of findings) {
  const list = byRule.get(f.rule) ?? [];
  list.push(f);
  byRule.set(f.rule, list);
}
for (const [rule, list] of byRule) {
  console.error(`  [${rule}] (${list.length})`);
  for (const f of list.slice(0, 20)) {
    console.error(`    ${f.file}:${f.line}  ${f.text.slice(0, 120)}`);
  }
  if (list.length > 20) console.error(`    … and ${list.length - 20} more`);
  console.error("");
}
process.exit(1);
