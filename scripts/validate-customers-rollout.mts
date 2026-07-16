#!/usr/bin/env node
/* validate:customers-rollout — the trusted server-side cohort resolver.
   Confirms: env allowlist parsing (comma/space/newline), EXACT id match (no
   prefix/substring), empty/unset/malformed → nobody in cohort, customer/member
   accounts excluded even if listed, null account → false.
   Run: NODE_OPTIONS=--conditions=react-server node --import tsx scripts/validate-customers-rollout.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV = "KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS";
const mod = await import(path.resolve(__dirname, "../src/lib/server/customers-rollout.ts")) as typeof import("../src/lib/server/customers-rollout.js");
const { isInCustomersServerListCohort, customersServerListCohortSize } = mod;

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };
const set = (v: string | undefined) => { if (v === undefined) delete process.env[ENV]; else process.env[ENV] = v; };

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

set(undefined);
check("unset env → not in cohort", isInCustomersServerListCohort(A, "internal") === false);
check("unset env → size 0", customersServerListCohortSize() === 0);
set("");
check("empty env → not in cohort", isInCustomersServerListCohort(A, "internal") === false);
set("   ");
check("whitespace-only env → not in cohort", isInCustomersServerListCohort(A, "internal") === false);
set(A);
check("single id → member matches", isInCustomersServerListCohort(A, "internal") === true);
check("single id → non-member false", isInCustomersServerListCohort(B, "internal") === false);
check("cohort size 1", customersServerListCohortSize() === 1);
set(`${A}, ${B} , ${C}`);
check("comma+space list → A", isInCustomersServerListCohort(A, "internal") === true);
check("comma+space list → C", isInCustomersServerListCohort(C, "admin") === true);
check("comma+space list size 3", customersServerListCohortSize() === 3);
set(`${A}\n${B}`);
check("newline-separated → A", isInCustomersServerListCohort(A, "internal") === true);
set(A.slice(0, 8)); // prefix only
check("prefix does NOT match (exact only)", isInCustomersServerListCohort(A, "internal") === false);
set(A);
check("customer account excluded even if listed", isInCustomersServerListCohort(A, "customer") === false);
check("null account → false", isInCustomersServerListCohort(null, "internal") === false);
check("undefined account → false", isInCustomersServerListCohort(undefined, "internal") === false);
set(",,,  ,,"); // malformed
check("malformed env → no crash, not in cohort", isInCustomersServerListCohort(A, "internal") === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
