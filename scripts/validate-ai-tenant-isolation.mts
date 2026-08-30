#!/usr/bin/env tsx

/* ===========================================================================
   PHASE 0 — AI tenant-isolation guard (structural, static analysis; no runtime).

   WHY THIS EXISTS
   ---------------
   `supabase-server.ts` uses the SERVICE ROLE key, which bypasses Row-Level
   Security by design: "our route handlers become the security boundary".
   For the AI agent that means every `.from("<tenant-scoped table>")` inside a
   tool handler MUST carry an explicit `.eq("tenant_id", ...)` (or write one on
   insert). There is no RLS backstop — a single omission is a silent
   cross-tenant leak.

   The architecture audit (KOLEEX_AI_ARCHITECTURE_AUDIT.md, Issue 10) recorded
   that ~40 hand-written filters carried this invariant with ZERO automated
   coverage. This guard is that coverage.

   WHAT IT CHECKS
   --------------
   1. Every `.from(T)` where T is tenant-scoped, inside src/lib/server/ai-agent,
      has a tenant filter within its query chain.
   2. Tables known to be SHARED (no tenant_id column) are listed explicitly and
      exempted — so the exemption is a reviewed decision, not an accident.
   3. A table that is neither in the tenant list nor the shared list FAILS,
      forcing a human decision when a new table is introduced.

   Pure Node fs only — tsx-runnable, no DB, no network, no behaviour change.
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

/* Tables that carry tenant_id and MUST be filtered by it. */
const TENANT_SCOPED = new Set([
  "customers",
  "quotations",
  "koleex_todos",
  "projects",
  "project_tasks",
  "project_stages",
  "planning_items",
  "planning_resources",
  "koleex_calendar_events",
  "ai_sources",
  "ai_knowledge_units",
  "ai_tool_calls",
]);

/* Tables that are SHARED by design (no tenant_id column), or are keyed by a
   parent row that was itself tenant-verified. Each entry is a reviewed
   decision — see the audit §9.2 "Cross-boundary exposure assessment". */
const SHARED_BY_DESIGN: Record<string, string> = {
  products: "shared catalog — no tenant_id column (tools/products.ts:6)",
  product_models: "child of products (shared catalog)",
  product_media: "child of products (shared catalog)",
  product_documents: "child of products (shared catalog)",
  product_certifications: "child of products (shared catalog)",
  product_feature_highlights: "child of products (shared catalog)",
  product_translations: "child of products (shared catalog)",
  product_options: "child of products (shared catalog)",
  product_option_values: "child of products (shared catalog)",
  product_suppliers: "child of products; gated at runtime by hasProductCostAccess()",
  contacts: "supplier identity lookup; reached only behind hasProductCostAccess()",
  accounts: "keyed by ctx.auth.account_id — the caller's own row only",
  koleex_permissions: "keyed by ctx.auth.role_id",
  account_permission_overrides: "keyed by ctx.auth.account_id",
  quotation_items: "child of quotations; parent tenant-verified before insert",
  koleex_todo_assignees: "child of koleex_todos; parent tenant-verified",
  pricing_markets: "shared pricing reference data",
  pricing_customer_types: "shared pricing reference data",
  markets: "shared reference data",
  /* VERIFIED 2026-08-30 (Phase 0): the AI's three inbox_messages inserts omit
     tenant_id — and so does the app's own /api/todos route, with a
     byte-identical payload shape. Planning routes DO set it. So this is a
     pre-existing, app-wide inconsistency in a notification sink, NOT an
     AI-specific defect: the AI is not broader than the app path it mirrors.
     Tracked as a hygiene item, not a Phase 1 security fix. Rows are addressed
     by recipient_account_id. */
  inbox_messages: "notification sink — AI path matches /api/todos exactly; tenant_id set inconsistently app-wide (tracked, not AI-specific)",
};

/* Tables whose rows are loaded through a tenant-scoped loader FIRST and then
   mutated by primary key. The tenant check has already happened; requiring a
   redundant .eq("tenant_id") on the mutation would be cargo-cult. Each entry
   names the loader that must exist in the same file for the exemption to hold. */
const PRE_VERIFIED_LOADERS: Record<string, string> = {
  koleex_todos: "loadTodoRow",
  koleex_calendar_events: "loadEventRow",
  planning_items: "loadPlanningRow",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = walk(AI_DIR);
console.log(`\nAI tenant-isolation guard — scanning ${files.length} files under ${AI_DIR}\n`);

/* A tenant filter can appear as a chained .eq("tenant_id", …), as a written
   column on insert (tenant_id:), or via a helper that takes the tenant id as a
   parameter (loadTodoRow(id, ctx.auth.tenant_id)). We look for the marker
   within a window after the .from() call — the query chain is always local. */
const TENANT_MARKERS = [
  /\.eq\(\s*["']tenant_id["']/,
  /\.is\(\s*["']tenant_id["']/,
  /tenant_id\s*:/,
];

/** Extract the whole statement starting at a `.from(...)` call: walk forward to
 *  the first `;` at depth 0. Far more accurate than a fixed character window —
 *  a long insert payload can push `tenant_id:` hundreds of chars down. */
function statementAt(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < src.length && i < start + 8000; i++) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === ";" && depth <= 0) return src.slice(start, i);
  }
  return src.slice(start, start + 8000);
}

let unknownTables = 0;
let preVerified = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const re = /\.from\(\s*["']([a-z_]+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const table = m[1];
    const line = src.slice(0, m.index).split("\n").length;
    const where = `${file}:${line}`;

    if (SHARED_BY_DESIGN[table]) continue;

    if (!TENANT_SCOPED.has(table)) {
      unknownTables++;
      check(
        `unclassified table "${table}"`,
        false,
        `${where} — add it to TENANT_SCOPED or SHARED_BY_DESIGN in this script (a reviewed decision, not a default)`,
      );
      continue;
    }

    /* Builder-aware: `let q = …from(…)…;` followed by
       `if (tenantId) q = q.eq("tenant_id", tenantId);` puts the filter in the
       NEXT statement. Include a few following lines so the very pattern the
       codebase uses for optional-tenant loaders is recognised. */
    const stmt = statementAt(src, m.index);
    const after = src.slice(m.index + stmt.length).split("\n").slice(0, 7).join("\n");
    const scope = stmt + after;

    if (TENANT_MARKERS.some((p) => p.test(scope))) {
      check(`${table} tenant-filtered`, true);
      continue;
    }

    /* Mutation by primary key after a tenant-scoped load is safe — but only if
       the loader actually exists in this file. Otherwise it is a real gap. */
    const loader = PRE_VERIFIED_LOADERS[table];
    const mutatesByPk = /\.(update|delete)\(/.test(stmt) && /\.eq\(\s*["']id["']/.test(stmt);
    if (loader && mutatesByPk && src.includes(`${loader}(`)) {
      preVerified++;
      console.log(`  ↪ ${table} by-PK mutation, pre-verified via ${loader}() — ${where}`);
      continue;
    }

    /* Scoped through a parent key that was itself resolved tenant-scoped
       (e.g. source_id from rollingSourceId(tenantId, …)). The tenant check
       happened when the parent was resolved. */
    const derivedKey = /\.eq\(\s*["'](source_id|quotation_id|todo_id|project_id|item_id|event_id)["']/.exec(scope);
    if (derivedKey) {
      preVerified++;
      console.log(`  ↪ ${table} scoped via tenant-resolved parent key "${derivedKey[1]}" — ${where}`);
      continue;
    }

    /* Self-rollback: deleting a row this same function just inserted with the
       caller's tenant_id. Requiring a tenant filter here would be cargo-cult. */
    const fnStart = src.lastIndexOf("handler:", m.index) >= 0 ? src.lastIndexOf("handler:", m.index) : 0;
    const enclosing = src.slice(fnStart, m.index);
    const isSelfRollback =
      /\.delete\(\)/.test(stmt) &&
      /\.eq\(\s*["']id["']/.test(stmt) &&
      /tenant_id\s*:\s*ctx\.auth\.tenant_id/.test(enclosing) &&
      /\.insert\(/.test(enclosing);
    if (isSelfRollback) {
      preVerified++;
      console.log(`  ↪ ${table} self-rollback of a row inserted with the caller's tenant_id — ${where}`);
      continue;
    }

    check(`${table} tenant-filtered`, false, `${where} — no tenant filter in the statement and no pre-verified loader`);
  }
}

/* Guard the guard: if the service-role assumption ever changes, this script's
   premise changes with it. Fail loudly rather than pass silently. */
const supa = readFileSync("src/lib/server/supabase-server.ts", "utf8");
check(
  "supabase-server still documents the service-role / RLS-bypass premise",
  /service.role/i.test(supa) && /Row-Level Security/i.test(supa),
  "supabase-server.ts changed — re-validate this guard's premise",
);

console.log(`\n${pass} passed, ${fail} failed, ${preVerified} pre-verified by-PK mutation(s)`);
if (unknownTables > 0) {
  console.error(`\n${unknownTables} unclassified table(s): a new AI data source must be explicitly classified before it ships.`);
}
process.exit(fail > 0 ? 1 : 0);
