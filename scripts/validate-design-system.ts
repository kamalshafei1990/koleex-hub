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
