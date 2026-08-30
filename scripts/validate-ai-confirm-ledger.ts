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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
