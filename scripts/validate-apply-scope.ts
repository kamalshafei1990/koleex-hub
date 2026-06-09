#!/usr/bin/env tsx

/* ===========================================================================
   DS1a — applyScope adoption-layer validator (pure, no DB).

   Proves the DS1a safety invariants:
     · applyScope NEVER modifies the query (same reference back)
     · enforce mode THROWS (no hide-path exists)
     · off → no clause; shadow → wouldApplyClause computed but query untouched
     · SA bypass / all → no clause; own/private → owner (+null if policy=tenant)
     · department degrades to own (Quotations has no department column)
     · evaluator keeps own + null-owner; detects would_zero
     · scope-flags default off; enforce env is clamped to off
   ========================================================================== */

import {
  applyScope,
  computeWouldApplyClause,
  evaluateScopeOverRows,
  evaluateSingleRowScope,
  assertScopeShadowForRow,
  recordScopeShadowForSingleRow,
  toScopeContext,
  SCOPE_POLICY,
  type EffectiveScope,
} from "../src/lib/server/apply-scope";
import { getScopeMode, getAiScopeMode } from "../src/lib/server/scope-flags";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ctxA = toScopeContext({ account_id: A, tenant_id: "T", role_id: "R", is_super_admin: false });
const POL = SCOPE_POLICY["Quotations"];

/* ── toScopeContext ──────────────────────────────────────────────────── */
check("toScopeContext maps fields + defaults", ctxA.account_id === A && ctxA.tenant_id === "T" && ctxA.can_view_private === false && ctxA.department === null);

/* ── computeWouldApplyClause ─────────────────────────────────────────── */
check("clause own → owner + null", computeWouldApplyClause("own", ctxA, POL) === `created_by.eq.${A},created_by.is.null`);
check("clause private → owner + null (policy=tenant)", computeWouldApplyClause("private", ctxA, POL) === `created_by.eq.${A},created_by.is.null`);
check("clause all → null", computeWouldApplyClause("all", ctxA, POL) === null);
check("clause bypass → null", computeWouldApplyClause("bypass", ctxA, POL) === null);

/* ── applyScope: NEVER modifies query, enforce throws ────────────────── */
const sentinel = { __q: true };

async function run() {
  // off → unchanged, no clause
  const off = await applyScope(sentinel, ctxA, "Quotations", { mode: "off", effectiveScope: "own" });
  check("off → same query reference", off.query === sentinel);
  check("off → applied false, no clause", off.meta.applied === false && off.meta.wouldApplyClause === null);

  // shadow own → query unchanged, clause computed
  const sh = await applyScope(sentinel, ctxA, "Quotations", { mode: "shadow", effectiveScope: "own" });
  check("shadow → same query reference (NO-OP)", sh.query === sentinel);
  check("shadow → applied still false", sh.meta.applied === false);
  check("shadow own → wouldApplyClause present", sh.meta.wouldApplyClause === `created_by.eq.${A},created_by.is.null`);

  // SA bypass → no clause
  const sa = await applyScope(sentinel, ctxA, "Quotations", { mode: "shadow", effectiveScope: "bypass" });
  check("shadow bypass → no clause", sa.meta.wouldApplyClause === null);

  // all → no clause
  const all = await applyScope(sentinel, ctxA, "Quotations", { mode: "shadow", effectiveScope: "all" });
  check("shadow all → no clause", all.meta.wouldApplyClause === null);

  // department degrades to own
  const dept = await applyScope(sentinel, ctxA, "Quotations", { mode: "shadow", effectiveScope: "department" });
  check("department degrades to own", dept.meta.degraded === "dept_to_own" && dept.meta.effectiveScope === "own");

  // missing config → no_config, no clause, query unchanged
  const noc = await applyScope(sentinel, ctxA, "Nope", { mode: "shadow", effectiveScope: "own" });
  check("missing config → no_config + no clause", noc.meta.degraded === "no_config" && noc.meta.wouldApplyClause === null && noc.query === sentinel);

  // enforce throws
  let threw = false;
  try { await applyScope(sentinel, ctxA, "Quotations", { mode: "enforce" as never, effectiveScope: "own" }); }
  catch { threw = true; }
  check("enforce mode THROWS (no hide-path)", threw);

  /* ── single-row assert helper (off / enforce / shadow) ─────────────── */
  const fakeDb = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data_scope: "own" } }) }) }) }) }),
  };
  const offV = await assertScopeShadowForRow({ row: ownerRow, ctx: ctxA, module: "Quotations", endpoint: "t", db: fakeDb as never, mode: "off" });
  check("assertScopeShadowForRow off → null (no-op, no scope resolution)", offV === null);
  let threwRow = false;
  try { await assertScopeShadowForRow({ row: ownerRow, ctx: ctxA, module: "Quotations", endpoint: "t", db: fakeDb as never, mode: "enforce" as never }); }
  catch { threwRow = true; }
  check("assertScopeShadowForRow enforce THROWS (no hide-path)", threwRow);
  const shV = await assertScopeShadowForRow({ row: otherRow, ctx: ctxA, module: "Quotations", endpoint: "t", db: fakeDb as never, mode: "shadow" });
  check("assertScopeShadowForRow shadow → verdict, non-owner would_allow false", shV !== null && shV.would_allow === false);

  /* ── DS1b-2a: extra-field passthrough (invoice conversion shadow) ───── */
  const captured: string[] = [];
  const origInfo = console.info;
  console.info = (...a: unknown[]) => { captured.push(a.map(String).join(" ")); };
  recordScopeShadowForSingleRow({
    module: "Quotations", endpoint: "POST /api/invoices/from-quotation", ctx: ctxA,
    row: otherRow, effectiveScope: "own",
    extra: { source_route: "invoice_from_quotation", quotation_id: "q-1", invoice_permission_present: true, quotations_permission_present: false },
  });
  // assertScopeShadowForRow should also forward extra into the log
  await assertScopeShadowForRow({
    row: otherRow, ctx: ctxA, module: "Quotations", endpoint: "POST /api/invoices/from-quotation",
    db: fakeDb as never, mode: "shadow",
    extra: { source_route: "invoice_from_quotation", invoice_permission_present: true, quotations_permission_present: false },
  });
  console.info = origInfo;
  const rec = JSON.parse(captured[0].replace("[scope-shadow] ", ""));
  check("extra fields passthrough (source_route)", rec.source_route === "invoice_from_quotation");
  check("extra fields passthrough (permission flags)", rec.invoice_permission_present === true && rec.quotations_permission_present === false);
  check("extra passthrough keeps verdict (non-owner would_allow false)", rec.would_allow === false && rec.quotation_id === "q-1");
  check("assertScopeShadowForRow forwards extra into log", captured.length === 2 && captured[1].includes("invoice_from_quotation"));

  console.log(`\napply-scope: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ── evaluator ───────────────────────────────────────────────────────── */
const rows = [{ created_by: A }, { created_by: B }, { created_by: null }];
const evA = evaluateScopeOverRows(rows, ctxA, POL, "own");
check("eval own (A): keeps own + null", evA.kept === 2 && evA.dropped === 1 && evA.null_owner_kept === 1 && evA.would_zero === false);
const evAll = evaluateScopeOverRows(rows, ctxA, POL, "all");
check("eval all: keeps everything", evAll.kept === 3 && evAll.dropped === 0);
const evZero = evaluateScopeOverRows([{ created_by: B }], ctxA, POL, "own");
check("eval would_zero detection", evZero.kept === 0 && evZero.would_zero === true);

/* ── DS1b-1 single-row scope ─────────────────────────────────────────── */
const ownerRow = { created_by: A };
const otherRow = { created_by: B };
const nullRow = { created_by: null };
check("single-row own: owner would_allow true", evaluateSingleRowScope(ownerRow, ctxA, POL, "own").would_allow === true);
check("single-row own: non-owner would_allow false", evaluateSingleRowScope(otherRow, ctxA, POL, "own").would_allow === false);
check("single-row own: null-owner would_allow true (policy tenant)", evaluateSingleRowScope(nullRow, ctxA, POL, "own").would_allow === true);
check("single-row bypass: would_allow true", evaluateSingleRowScope(otherRow, ctxA, POL, "bypass").would_allow === true);
check("single-row all: would_allow true", evaluateSingleRowScope(otherRow, ctxA, POL, "all").would_allow === true);
check("single-row private: owner only", evaluateSingleRowScope(ownerRow, ctxA, POL, "private").would_allow === true && evaluateSingleRowScope(otherRow, ctxA, POL, "private").would_allow === false);
const sDept = evaluateSingleRowScope(otherRow, ctxA, POL, "department");
check("single-row dept degrades to own", sDept.degraded === "dept_to_own" && sDept.effectiveScope === "own" && sDept.would_allow === false);
check("single-row row_owner + null_owner fields", evaluateSingleRowScope(nullRow, ctxA, POL, "own").null_owner === true && evaluateSingleRowScope(ownerRow, ctxA, POL, "own").row_owner === A);
// single-row matches list eval (n=1)
const listOne = evaluateScopeOverRows([otherRow], ctxA, POL, "own");
const rowOne = evaluateSingleRowScope(otherRow, ctxA, POL, "own");
check("single-row matches list eval (non-owner dropped)", (listOne.kept === 1) === rowOne.would_allow && listOne.kept === 0);

/* ── flags ───────────────────────────────────────────────────────────── */
delete process.env.SCOPE_MODE_QUOTATIONS;
check("flag default off", getScopeMode("Quotations") === "off");
process.env.SCOPE_MODE_QUOTATIONS = "shadow";
check("flag env=shadow", getScopeMode("Quotations") === "shadow");
process.env.SCOPE_MODE_QUOTATIONS = "enforce";
check("flag env=enforce CLAMPED to off", getScopeMode("Quotations") === "off");
delete process.env.SCOPE_MODE_QUOTATIONS;
check("ai flag default off", getAiScopeMode("Quotations") === "off");

void run();
