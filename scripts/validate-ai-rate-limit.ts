#!/usr/bin/env tsx

/* ===========================================================================
   PHASE 1 — Rate-limit suite (audit Issue 4, P0).

   Pure logic only. The atomic increment is a database property and was proved
   at SQL level on staging (three separate calls on one key → 3; separate
   buckets and subjects do not share a counter).

   What matters here is that the budgets are sane and the keys cannot collide,
   because a typo in a subject key would silently create a SECOND, always-empty
   budget rather than failing — a limiter that looks enforced and is not.
   ========================================================================== */

import { BUDGETS, subjectFor, limitMode } from "../src/lib/server/ai/security/rate-limit";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? `\n      ↳ ${detail}` : ""}`); }
}

console.log("\n── Budgets ──");
const turn = BUDGETS.turnPerAccount();
const tenant = BUDGETS.turnPerTenant();
const att = BUDGETS.attachmentPerAccount();

check("a per-account turn budget exists", turn.max > 0 && turn.windowSec > 0);
check("it is above real human use", turn.max >= 20,
  "a person sends a handful of turns a minute; too low and the limiter becomes the bug");
check("it is below what a script costs", turn.max <= 120,
  "each turn is up to four model calls; a loop must hit the ceiling quickly");
check("the tenant budget is wider than one account's", tenant.max > turn.max,
  "one user must not be able to exhaust their whole organisation's budget alone");
check("attachments have their OWN, tighter budget", att.bucket !== turn.bucket && att.max < turn.max,
  "a scanned PDF fans out to up to 18 vision calls — it cannot share the chat budget");

console.log("\n── Subject keys (a typo here silently creates an empty budget) ──");
check("account and tenant keys cannot collide",
  subjectFor.account("same-id") !== subjectFor.tenant("same-id"),
  "an account and a tenant sharing a uuid must not share a counter");
check("different accounts get different keys",
  subjectFor.account("a") !== subjectFor.account("b"));
check("keys are namespaced", subjectFor.account("x").startsWith("account:") && subjectFor.tenant("x").startsWith("tenant:") && subjectFor.ip("x").startsWith("ip:"));

console.log("\n── Bucket separation ──");
const buckets = [turn.bucket, tenant.bucket, att.bucket];
check("every budget has a distinct bucket", new Set(buckets).size === buckets.length,
  `buckets: ${buckets.join(", ")} — a shared bucket means one budget silently drains another`);

console.log("\n── Mode ──");
check("default mode is enforce", limitMode() === "enforce");

console.log(`\n${pass} passed, ${fail} failed`);
console.log("Atomicity is a DB property, proved on staging at SQL level — not asserted here.\n");
process.exit(fail > 0 ? 1 : 0);
