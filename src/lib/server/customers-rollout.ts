import "server-only";

/* ---------------------------------------------------------------------------
   Customers server-list — trusted SERVER-SIDE cohort resolution.
   (Phase 4 Wave 2A.1 — controlled internal rollout; generalized in 2A.2)

   The cohort is an allowlist of OPAQUE account IDs in the env var
   `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS`. The parsing / safety rules now live
   in the shared `makeServerListCohort` factory (rollout-cohort.ts); this module
   just binds it to the Customers env var and keeps its stable exported API so
   existing callers (/api/me/bootstrap, validate:customers-rollout) are
   unchanged.

   Safety (from the factory): empty/malformed → nobody in cohort; customer
   accounts never auto-enabled; opaque ids never logged; exact match only.
   `?serverlist=0/1` overrides live in the client gate and only choose which UI
   renders — they cannot bypass auth / permissions / tenant / RLS.
   --------------------------------------------------------------------------- */

import { makeServerListCohort } from "./rollout-cohort";

const cohort = makeServerListCohort("KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS");

/** True iff this authenticated account is in the internal server-list cohort.
    Pass the REAL logged-in account id (not a view-as target) + its user_type. */
export function isInCustomersServerListCohort(
  accountId: string | null | undefined,
  userType: string | null | undefined,
): boolean {
  return cohort.isInCohort(accountId, userType);
}

/** Size of the configured cohort (for safe diagnostics — count only, no ids). */
export function customersServerListCohortSize(): number {
  return cohort.size();
}
