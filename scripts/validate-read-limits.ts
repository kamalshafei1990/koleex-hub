/* ---------------------------------------------------------------------------
   validate:read-limits — no read may count on more than 1000 rows (27/09/2026).

   The Supabase API returns at most 1000 rows a read, silently: `.limit(10000)`
   and `.range(0, 4999)` on a 3,806-row table both returned exactly 1000 rows
   and no error. 84 reads asked for more; three pages were already wrong the
   day it was measured (Super Admin usage, AI usage, staff readiness).

   The rules pinned here:
     · a read that needs every row goes through lib/server/all-rows (pages of
       1000 until a short page), with the query sorted in a stable order;
     · a `.limit()` above 1000 — or `.range(0, N)` past 1000 rows — is allowed
       only where the read can never return more than 1000 rows, listed in
       BOUNDED below with the reason. A new one fails this check until it
       pages or is listed, and a listed read that is gone fails it too.
   --------------------------------------------------------------------------- */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./lib/strip-comments";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}

const API_CAP = 1000;

/* Reads that keep a limit above 1000 because they can never return more
   than 1000 rows. Key: file | table | limit. */
const BOUNDED: Record<string, string> = {
  "src/app/api/cron/ai-brief/route.ts|accounts|2000": "internal staff accounts that chose an AI brief hour — at most one per staff member",
  "src/app/api/planning/workload/route.ts|planning_resources|2000": "employee planning resources — one per staff member",
  "src/lib/server/reports/control-data.ts|invoice_payments|5000": "payments of at most 100 invoices a read (chunks of 100) — a few per invoice",
  "src/lib/server/reports/core.ts|koleex_employees|2000": "employees — bounded by the staff count",
  "src/lib/server/reports/core.ts|accounts|2000": "the accounts of those employees — one each",
  "src/lib/server/reports/hr-data.ts|koleex_employees|3000": "employees — bounded by the staff count",
  "src/lib/server/reports/hr-data.ts|hr_appraisals|3000": "appraisals of ONE cycle — at most one per employee",
  "src/lib/server/reports/hr-data.ts|work_reports|2000": "grievance reports inside one report window — rare",
  "src/lib/server/reports/office.ts|koleex_employees|3000": "employees — bounded by the staff count",
};

/* Calls that pass a query built elsewhere: the helper itself, and a wrapper
   whose own call sites are checked for their sort instead. */
const WRAPPERS: Record<string, string> = {
  "src/lib/server/all-rows.ts": "",
  "src/app/api/suppliers/sourcing/overview/route.ts": "ofSuppliers",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const code = new Map(walk("src").map((f) => [f, stripComments(readFileSync(f, "utf8"), { line: "all" })] as const));

/* ── 1. The helper ── */
console.log("\n1. lib/server/all-rows reads every row");
const helper = code.get("src/lib/server/all-rows.ts") ?? "";
check("pages of 1000 (the API's cap)", /export const API_PAGE = 1000;/.test(helper));
check("each page asks for the next range", /await query\.range\(from, from \+ size - 1\)/.test(helper) && /from \+= API_PAGE/.test(helper));
check("stops at the first short page", /if \(rows\.length < size\) return \{ data: out, error: null \};/.test(helper));
check("a failed page fails the read (first error wins)", /if \(error\) return \{ data: null, error \};/.test(helper));
check("a read that reaches its ceiling says so in the log, never silently", /console\.error\(`\[all-rows\] \$\{label\}: stopped at \$\{max\} rows/.test(helper));

/* ── 2. The sweep ── */
console.log("\n2. No read asks for more than 1000 rows");
const exported = new Map<string, number>();
const objects = new Map<string, string>();
for (const src of code.values()) {
  for (const m of src.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*number)?\s*=\s*([0-9][0-9_]*)\s*;/g)) exported.set(m[1], Number(m[2].replace(/_/g, "")));
  for (const m of src.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{([^{}]*)\}/g)) objects.set(m[1], m[2]);
}
/** A named limit's value: `const X = 20_000` in the file or exported
 *  anywhere; `X.prop` from an exported object of numbers. null = unknown. */
const valueOf = (ident: string, src: string): number | null => {
  const [id, prop] = ident.split(".");
  if (prop) {
    const body = new RegExp(`const\\s+${id}\\s*=\\s*\\{([^{}]*)\\}`).exec(src)?.[1] ?? objects.get(id);
    const m = body ? new RegExp(`\\b${prop}\\s*:\\s*([0-9][0-9_]*)`).exec(body) : null;
    return m ? Number(m[1].replace(/_/g, "")) : null;
  }
  const m = new RegExp(`(?:const|let)\\s+${id}\\s*(?::\\s*number)?\\s*=\\s*([0-9][0-9_]*)\\b`).exec(src);
  return m ? Number(m[1].replace(/_/g, "")) : exported.get(id) ?? null;
};
/** The most rows an expression can ask for: literals and named limits,
 *  arithmetic evaluated, and the larger side of a `? :`. null = it depends
 *  on a value only known at run time (a parameter, a list's length). */
function rowsAskedBy(expr: string, src: string): number | null {
  let unknown = false;
  const resolved = expr.replace(/\b([A-Z][A-Z0-9_]*(?:\.[a-zA-Z]\w*)?)\b/g, (id) => {
    const v = valueOf(id, src);
    if (v === null) { unknown = true; return "0"; }
    return String(v);
  }).replace(/(\d)_(?=\d)/g, "$1");
  if (!unknown) { const n = arithmetic(resolved); if (n !== null) return n; }
  const branches = /\?/.test(resolved) ? resolved.split(/[?:]/).slice(1) : [];
  const literals = branches.map((b) => arithmetic(b)).filter((n): n is number => n !== null);
  return literals.length ? Math.max(...literals) : null;
}
/** Plain arithmetic on numbers (+ - * and parentheses), else null. */
function arithmetic(s: string): number | null {
  if (!/^[\d\s+\-*()]+$/.test(s)) return null;
  try { const n = Number(Function(`"use strict"; return (${s});`)()); return Number.isFinite(n) ? n : null; } catch { return null; }
}
type Hit = { key: string; where: string };
const hits: Hit[] = [];
for (const [file, src] of code) {
  for (const m of src.matchAll(/\.(limit|range)\(/g)) {
    const args = argsAt(src, m.index + m[0].length - 1);
    let n: number | null;
    if (m[1] === "limit") n = rowsAskedBy(args, src);
    else {
      const parts = args.split(",");
      n = parts.length >= 2 && parts[0].trim() === "0" ? (rowsAskedBy(parts[1], src) ?? -1) + 1 : null;
    }
    if (n === null || n <= API_CAP) continue;
    const froms = [...src.slice(Math.max(0, m.index - 2500), m.index).matchAll(/\.from\(\s*(?:"([a-z0-9_]+)"|([A-Za-z_][\w.]*))\s*\)/g)];
    const last = froms[froms.length - 1];
    const table = last ? (last[1] ?? `<${last[2]}>`) : "<unknown>";
    const line = src.slice(0, m.index).split("\n").length;
    hits.push({ key: `${file}|${table}|${n}`, where: `${file}:~${line} (${table}, ${n})` });
  }
}
const unlisted = hits.filter((h) => !BOUNDED[h.key]);
check(`every read over 1000 rows pages or is listed as bounded${unlisted.length ? ` — ${unlisted.map((h) => h.where).join("; ")}` : ""}`, unlisted.length === 0);
const stale = Object.keys(BOUNDED).filter((k) => hits.filter((h) => h.key === k).length !== 1);
check(`every bounded entry is still one real read (no stale excuses)${stale.length ? ` — ${stale.join("; ")}` : ""}`, stale.length === 0);
check("every bounded entry says why", Object.values(BOUNDED).every((r) => r.trim().length >= 12));

/* ── 3. Paged reads are sorted ── */
console.log("\n3. Every paged read has a stable order");
/** The text of the call's arguments: from "(" to its matching ")", stepping
 *  over string and template literals. */
function argsAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return "";
}
const unsorted: string[] = [];
let paged = 0;
for (const [file, src] of code) {
  const wrapper = WRAPPERS[file];
  if (wrapper === "") continue;
  const names = wrapper ? ["allRows", "allRowsOrThrow", wrapper] : ["allRows", "allRowsOrThrow"];
  for (const m of src.matchAll(new RegExp(`(?<![\\w.])(${names.join("|")})(?:<[^>()]*>)?\\(`, "g"))) {
    const before = src.slice(Math.max(0, m.index - 30), m.index);
    if (/function\s+$|const\s+$/.test(before)) continue;
    const args = argsAt(src, m.index + m[0].length - 1);
    if (wrapper && m[1] !== wrapper && /^\s*q\s*,/.test(args)) continue;
    paged++;
    if (!/\.order\(/.test(args)) unsorted.push(`${file}:~${src.slice(0, m.index).split("\n").length}`);
  }
}
check(`paged reads found (${paged})`, paged >= 70);
check(`each is sorted (.order(…), id last as the tiebreaker)${unsorted.length ? ` — unsorted: ${unsorted.join("; ")}` : ""}`, unsorted.length === 0);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
