#!/usr/bin/env tsx

/* ===========================================================================
   PHASE 1 — Confirmation-ledger suite (audit Issue 1, P0).

   The security property is hash stability. If the same intent hashed
   differently between the preview and the confirm, every legitimate write
   would be refused (the feature breaks). If DIFFERENT intents hashed the
   same, a preview for "delete task A" would authorise "delete task B" — a
   confirmation bypass wearing the ledger's own uniform.

   Both directions are asserted. Pure functions only; the atomic consume is
   proved separately at the SQL level.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { normalizeArgs, hashArgs, riskClassFor, ledgerMode } from "../src/lib/server/ai/security/pending-actions";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? `\n      ↳ ${detail}` : ""}`); }
}

console.log("\n── Hash stability: the same intent must always match ──");

const preview = { task_id: "a3f8c2d1-4b5e-6789-0abc-def012345678" };
const confirm = { task_id: "a3f8c2d1-4b5e-6789-0abc-def012345678", confirm: true };
check("confirm:true does not change the hash", hashArgs(preview) === hashArgs(confirm),
  "the preview is stored without confirm; the confirm arrives with it — they must still match");

check("key order does not change the hash",
  hashArgs({ a: 1, b: 2, c: 3 }) === hashArgs({ c: 3, b: 2, a: 1 }),
  "models do not guarantee key order between turns");

check("nested key order does not change the hash",
  hashArgs({ x: { p: 1, q: 2 } }) === hashArgs({ x: { q: 2, p: 1 } }));

check("array ORDER is preserved (it is meaningful)",
  hashArgs({ ids: ["a", "b"] }) !== hashArgs({ ids: ["b", "a"] }),
  "assignee order can matter; sorting arrays would let one preview authorise a different assignment");

check("nested confirm keys are also stripped",
  hashArgs({ x: { confirm: true, v: 1 } }) === hashArgs({ x: { v: 1 } }));

console.log("\n── Hash separation: a different intent must NOT match ──");

check("a different task id does not match",
  hashArgs({ task_id: "aaaaaaaa-0000-0000-0000-000000000000" }) !==
  hashArgs({ task_id: "bbbbbbbb-0000-0000-0000-000000000000" }),
  "otherwise a preview for one record authorises deleting another",
);
check("an added field does not match",
  hashArgs({ task_id: "x" }) !== hashArgs({ task_id: "x", title: "changed" }),
  "a changed action needs a NEW preview — refusing it is correct, not a bug");
check("a removed field does not match",
  hashArgs({ task_id: "x", priority: "high" }) !== hashArgs({ task_id: "x" }));
check("a changed value does not match",
  hashArgs({ done: true }) !== hashArgs({ done: false }));
check("type is not coerced away",
  hashArgs({ v: 1 }) !== hashArgs({ v: "1" }),
  'a string "1" must not satisfy a preview for the number 1');

console.log("\n── Normalisation shape ──");
check("normalizeArgs strips confirm", !("confirm" in (normalizeArgs({ a: 1, confirm: true }) as object)));
check("normalizeArgs keeps everything else", JSON.stringify(normalizeArgs({ b: 2, a: 1 })) === '{"a":1,"b":2}');

console.log("\n── Risk classification (agent safety matrix) ──");
check("deletes are destructive", riskClassFor("deleteTodo", "delete") === "destructive");
check("delete detected by name even without the action", riskClassFor("deleteCalendarEvent") === "destructive");
check("quotations are financial", riskClassFor("createQuotationDraft", "create") === "financial");
check("other writes default to high_risk_write", riskClassFor("createTodo", "create") === "high_risk_write");
check("a NEW unknown write tool still gets a class (no silent gap)",
  riskClassFor("someFutureWriteTool", "create") === "high_risk_write",
  "derived from the declared action rather than a hand-kept list, so a new tool cannot be missed");

console.log("\n── Mode ──");
check("default mode is enforce, not observe", ledgerMode() === "enforce",
  "a mismatched confirm costs a retry; an unverified one can delete permanently");

console.log("\n── The MECHANISM, not just the maths (Phase 7 review) ──");
/* FOUND BY MUTATION TESTING, and it is the reason this section exists.
   Replacing the dispatcher's guard with `if (false)` — disabling the entire
   confirmation check, so any `confirm: true` from the model executes a write
   with no pending row — was survived by ALL TWENTY-FOUR suites, this one
   included.

   Everything above tests the ARITHMETIC: hashing, normalisation, risk classes,
   the default mode. All of it correct, and none of it noticing that the code
   which CALLS it had been switched off. That is the classic shape of a test
   suite that grows around pure functions: the parts that are easy to test are
   tested, and the wiring that makes them matter is not.

   The standing rule this protects is quoted verbatim from the project owner:
   "A write tool must NOT execute merely because the model sends `confirm:
   true`. The server must verify a matching pending action exists."

   Three other critical guards were probed the same way and ARE caught — the
   permission gate (ai-baseline), untrusted-document fencing (ai-untrusted) and
   egress scanning (ai-egress). This was the one gap. */
{
  const registry = readFileSync("src/lib/server/ai-agent/tool-registry.ts", "utf8");
  const code = registry.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dispatchStart = code.indexOf("export async function dispatchTool(");
  const body = dispatchStart >= 0 ? code.slice(dispatchStart) : "";

  check("dispatchTool is where this section expects it", body.length > 0,
    "if this fails every assertion below compares against an empty string");

  check(
    "a confirm:true is checked against the ledger — the guard is REACHABLE, not commented out",
    /if \(mode !== "off" && args\.confirm === true\) \{/.test(body),
    "mutation `if (false)` survived all 24 suites before this assertion existed",
  );
  check(
    "and the guard calls consumePendingAction, not just reads a flag",
    /consumePendingAction\(\{/.test(body),
  );
  check(
    "an UNMATCHED confirm refuses the write under enforce",
    /if \(!consumed\.matched\)[\s\S]{0,400}mode === "enforce"[\s\S]{0,400}UNCONFIRMED_MESSAGE/.test(body),
    "the whole point: no pending row means the tool must not run",
  );
  check(
    "the refusal RETURNS, so execution cannot continue past it",
    /UNCONFIRMED_MESSAGE[\s\S]{0,600}return result;/.test(body),
  );
  /* Ordering: the ledger must be consulted BEFORE the handler runs. A check
     that happens after the write has already executed protects nothing. */
  const ledgerIdx = body.indexOf("consumePendingAction({");
  const handlerIdx = body.indexOf("tool.handler(ctx, args)");
  check(
    `the ledger is consulted BEFORE the handler runs (ledger@${ledgerIdx}, handler@${handlerIdx})`,
    ledgerIdx > 0 && handlerIdx > 0 && ledgerIdx < handlerIdx,
  );
  check(
    "an unmatched confirm is logged, so a refused write is visible in ops",
    /ai\.ledger\.unmatched/.test(body),
  );
  /* The other half: a preview must RECORD a pending row, or there is never
     anything for a later confirm to match and every write is refused. */
  check(
    "a tool returning a preview records a pending row for the follow-up confirm",
    /recordPendingAction\(\{/.test(body) && /pendingAction/.test(body),
  );
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
