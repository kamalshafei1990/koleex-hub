#!/usr/bin/env tsx

/* ===========================================================================
   CQE — Customer-only Quotations Enforcement guard validator (pure, no real DB).

   Proves:
     · flag default OFF; parsed only from CUSTOMER_QUOTATIONS_ENFORCE="true"
     · ownsQuotation = created_by === accountId (null-owner → false)
     · isCustomerEnforced: OFF → false with NO db read; SA → false (no read);
       external (user_type=customer OR role.scope=customer) → true;
       internal → false
   ========================================================================== */

import {
  customerQuotationsEnforceEnabled,
  ownsQuotation,
  isCustomerEnforced,
} from "../src/lib/server/customer-quotation-guard";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ROLE = "33333333-3333-4333-8333-333333333333";

/* a db that EXPLODES if queried — proves the "no DB read" short-circuits */
const explodingDb = { from() { throw new Error("DB must not be read"); } };

/* configurable fake db: returns a given account row + role scope */
function fakeDb(acct: { user_type: string; role_id: string | null } | null, roleScope?: string) {
  return {
    from(table: string) {
      const result =
        table === "accounts" ? { data: acct }
        : table === "roles" ? { data: roleScope ? { scope: roleScope } : null }
        : { data: null };
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain, maybeSingle: async () => result,
      };
      return chain;
    },
  };
}

async function run() {
  /* ── flag parse ──────────────────────────────────────────────────── */
  delete process.env.CUSTOMER_QUOTATIONS_ENFORCE;
  check("flag default OFF", customerQuotationsEnforceEnabled() === false);
  process.env.CUSTOMER_QUOTATIONS_ENFORCE = "true";
  check("flag 'true' → on", customerQuotationsEnforceEnabled() === true);
  process.env.CUSTOMER_QUOTATIONS_ENFORCE = "TRUE";
  check("flag 'TRUE' → on (case-insensitive)", customerQuotationsEnforceEnabled() === true);
  process.env.CUSTOMER_QUOTATIONS_ENFORCE = "false";
  check("flag 'false' → off", customerQuotationsEnforceEnabled() === false);

  /* ── ownsQuotation ───────────────────────────────────────────────── */
  check("owns: created_by===account", ownsQuotation({ created_by: A }, A) === true);
  check("owns: mismatch → false", ownsQuotation({ created_by: B }, A) === false);
  check("owns: null created_by → false", ownsQuotation({ created_by: null }, A) === false);
  check("owns: null row → false", ownsQuotation(null, A) === false);

  /* ── isCustomerEnforced ──────────────────────────────────────────── */
  // flag OFF → false, and DB must NOT be touched
  delete process.env.CUSTOMER_QUOTATIONS_ENFORCE;
  check("enforce OFF → false (no DB read)",
    (await isCustomerEnforced({ account_id: A, is_super_admin: false, role_id: ROLE }, explodingDb as never)) === false);

  process.env.CUSTOMER_QUOTATIONS_ENFORCE = "true";
  // super-admin → false, and DB must NOT be touched
  check("enforce ON + super-admin → false (no DB read)",
    (await isCustomerEnforced({ account_id: A, is_super_admin: true, role_id: ROLE }, explodingDb as never)) === false);
  // external via user_type
  check("enforce ON + user_type=customer → true",
    (await isCustomerEnforced({ account_id: A, is_super_admin: false, role_id: ROLE }, fakeDb({ user_type: "customer", role_id: ROLE }) as never)) === true);
  // external via role scope
  check("enforce ON + role.scope=customer → true",
    (await isCustomerEnforced({ account_id: A, is_super_admin: false, role_id: ROLE }, fakeDb({ user_type: "internal", role_id: ROLE }, "customer") as never)) === true);
  // internal → false
  check("enforce ON + internal (user_type+role) → false",
    (await isCustomerEnforced({ account_id: A, is_super_admin: false, role_id: ROLE }, fakeDb({ user_type: "internal", role_id: ROLE }, "internal") as never)) === false);
  // missing account → false
  check("enforce ON + no account row → false",
    (await isCustomerEnforced({ account_id: A, is_super_admin: false, role_id: null }, fakeDb(null) as never)) === false);

  delete process.env.CUSTOMER_QUOTATIONS_ENFORCE;
  console.log(`\ncustomer-quotation-guard: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

void run();
