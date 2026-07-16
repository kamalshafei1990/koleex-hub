#!/usr/bin/env node
/* validate:suppliers-rollout — the trusted server-side Suppliers cohort resolver.
   Confirms: OWN env var (KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS, NOT the Customers
   one), env allowlist parsing (comma/space/newline), EXACT id match (no
   prefix/substring), empty/unset/malformed → nobody in cohort, customer/member
   accounts excluded even if listed, null account → false, and that the Suppliers
   cohort is INDEPENDENT of the Customers cohort.
   Run: NODE_OPTIONS=--conditions=react-server node --import tsx scripts/validate-suppliers-rollout.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV = "KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS";
const CUST_ENV = "KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS";
const mod = await import(path.resolve(__dirname, "../src/lib/server/suppliers-rollout.ts")) as typeof import("../src/lib/server/suppliers-rollout.js");
const cust = await import(path.resolve(__dirname, "../src/lib/server/customers-rollout.ts")) as typeof import("../src/lib/server/customers-rollout.js");
const { isInSuppliersServerListCohort, suppliersServerListCohortSize } = mod;

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };
const set = (v: string | undefined) => { if (v === undefined) delete process.env[ENV]; else process.env[ENV] = v; };
const setCust = (v: string | undefined) => { if (v === undefined) delete process.env[CUST_ENV]; else process.env[CUST_ENV] = v; };

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

set(undefined);
check("unset env → not in cohort", isInSuppliersServerListCohort(A, "internal") === false);
check("unset env → size 0", suppliersServerListCohortSize() === 0);
set("");
check("empty env → not in cohort", isInSuppliersServerListCohort(A, "internal") === false);
set("   ");
check("whitespace-only env → not in cohort", isInSuppliersServerListCohort(A, "internal") === false);
set(A);
check("single id → member matches", isInSuppliersServerListCohort(A, "internal") === true);
check("single id → non-member false", isInSuppliersServerListCohort(B, "internal") === false);
check("cohort size 1", suppliersServerListCohortSize() === 1);
set(`${A}, ${B} , ${C}`);
check("comma+space list → A", isInSuppliersServerListCohort(A, "internal") === true);
check("comma+space list → C (admin)", isInSuppliersServerListCohort(C, "admin") === true);
check("comma+space list size 3", suppliersServerListCohortSize() === 3);
set(`${A}\n${B}`);
check("newline-separated → A", isInSuppliersServerListCohort(A, "internal") === true);
set(A.slice(0, 8)); // prefix only
check("prefix does NOT match (exact only)", isInSuppliersServerListCohort(A, "internal") === false);
set(A);
check("customer account excluded even if listed", isInSuppliersServerListCohort(A, "customer") === false);
check("null account → false", isInSuppliersServerListCohort(null, "internal") === false);
check("undefined account → false", isInSuppliersServerListCohort(undefined, "internal") === false);
set(",,,  ,,"); // malformed
check("malformed env → no crash, not in cohort", isInSuppliersServerListCohort(A, "internal") === false);

/* Independence: a member of the SUPPLIERS cohort is NOT auto-in the Customers
   cohort (and vice-versa) — the two rollouts use separate env vars. */
set(A); setCust(B);
check("supplier cohort has A, not B", isInSuppliersServerListCohort(A, "internal") === true && isInSuppliersServerListCohort(B, "internal") === false);
check("customer cohort has B, not A (independent)", cust.isInCustomersServerListCohort(B, "internal") === true && cust.isInCustomersServerListCohort(A, "internal") === false);
setCust(undefined);
check("clearing customer env leaves supplier cohort intact", isInSuppliersServerListCohort(A, "internal") === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
