#!/usr/bin/env tsx

/* ===========================================================================
   DS1b-3 — AI Quotation Guard (structural, static analysis; no runtime).

   Protects the data_scope invariant for the AI agent:

     The AI has NO quotation read/list/show tool. createQuotationDraft is the
     ONLY tool that touches the `quotations` table, and only to:
       (a) count for numbering  → .select(..., { count:"exact", head:true })
       (b) insert a user-owned draft → .insert({ ... created_by: ctx.auth.account_id ... })
       (c) rollback-delete its OWN just-created draft → .delete()

   If a future AI tool adds a READER of existing quotations (a plain
   .select() that returns rows) WITHOUT routing through assertScopeShadowForRow
   / applyScope, this guard FAILS the build — because the AI must never be
   broader than the requesting user.

   Pure Node fs only — tsx-runnable, no DB, no behaviour.
   ========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const AI_DIR = "src/lib/server/ai-agent";
const QUOTATION_TOOL = join(AI_DIR, "tools/quotations.ts");

/* ── recursively collect every .ts file under the ai-agent dir ─────────── */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = walk(AI_DIR);

/* ── 1. Find every `.from("quotations")` across the WHOLE ai-agent and
       classify each usage. Anything that isn't an allowed write/count is a
       reader → fail. ───────────────────────────────────────────────────── */
const fromRe = /\.from\(\s*["']quotations["']\s*\)/g;
let totalQuotationFroms = 0;
let readers = 0;
const offenders: string[] = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(text)) !== null) {
    totalQuotationFroms++;
    // Window: from the match to ~200 chars ahead (covers the chained call).
    const window = text.slice(m.index, m.index + 220);
    const isCountHead = /count\s*:\s*["']exact["']\s*,\s*head\s*:\s*true/.test(window);
    const isInsert = /\.insert\s*\(/.test(window);
    const isDelete = /\.delete\s*\(/.test(window);
    const isSelect = /\.select\s*\(/.test(window);

    if (isCountHead) continue;           // (a) numbering — allowed
    if (isInsert) continue;              // (b) insert draft — allowed
    if (isDelete) continue;              // (c) rollback delete — allowed
    if (isSelect) {                      // a plain select that returns rows → READER
      readers++;
      offenders.push(`${file}: unguarded .from("quotations").select(...) reader`);
    } else {
      // Unknown shape — be conservative, treat as a potential reader.
      readers++;
      offenders.push(`${file}: unrecognised .from("quotations") usage (classify + add scope handling)`);
    }
  }
}

check("AI agent has at least the expected quotations usages", totalQuotationFroms >= 3, `found ${totalQuotationFroms}`);
check("NO unguarded AI quotation reader exists", readers === 0, offenders.join(" | "));

/* ── 2. The only file touching the quotations table is tools/quotations.ts ─ */
const filesTouchingQuotations = files.filter((f) =>
  /\.from\(\s*["']quotations["']\s*\)/.test(readFileSync(f, "utf8")),
);
check(
  "only tools/quotations.ts touches the quotations table",
  filesTouchingQuotations.length === 1 && filesTouchingQuotations[0] === QUOTATION_TOOL,
  filesTouchingQuotations.join(", "),
);

/* ── 3. createQuotationDraft is present, user-owned, and the only quotation
       WRITER; no reader-shaped tool name exists. ─────────────────────────── */
const qtext = readFileSync(QUOTATION_TOOL, "utf8");
const toolNames = [...qtext.matchAll(/name:\s*["']([^"']+)["']/g)].map((x) => x[1]);
check("createQuotationDraft tool present", toolNames.includes("createQuotationDraft"));
check(
  "no reader-shaped quotation tool name (list/show/get/search *quotation*)",
  !toolNames.some((n) => /(list|show|get|search|read|fetch).*quotation/i.test(n)),
  toolNames.join(", "),
);
check(
  "createQuotationDraft insert is user-owned (created_by: ctx.auth.account_id)",
  /created_by:\s*ctx\.auth\.account_id/.test(qtext),
);
check(
  "quotation numbering uses count/head only (no row-returning count select)",
  /\.select\(\s*["']id["']\s*,\s*\{\s*count:\s*["']exact["']\s*,\s*head:\s*true/.test(qtext),
);

/* ── 4. quotation_items is only ever inserted (child of the user-owned draft),
       never read-and-returned. ──────────────────────────────────────────── */
const itemsFromRe = /\.from\(\s*["']quotation_items["']\s*\)/g;
let itemReaders = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  let m: RegExpExecArray | null;
  while ((m = itemsFromRe.exec(text)) !== null) {
    const window = text.slice(m.index, m.index + 220);
    if (!/\.insert\s*\(/.test(window)) itemReaders++;
  }
}
check("quotation_items is insert-only in AI agent (no reader)", itemReaders === 0);

/* ── 5. registry wires quotationTools (sanity: the tool set is the audited one) */
const registry = readFileSync(join(AI_DIR, "tool-registry.ts"), "utf8");
check("tool-registry imports + spreads quotationTools", /quotationTools/.test(registry));

console.log(`\nai-quotation-guard: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
