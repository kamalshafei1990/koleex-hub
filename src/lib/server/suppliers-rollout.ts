import "server-only";

/* ---------------------------------------------------------------------------
   Suppliers server-list — trusted SERVER-SIDE cohort resolution.
   (Phase 4 Wave 2A.2 — controlled internal rollout)

   Its OWN env var `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` (never the Customers
   one) holds an allowlist of OPAQUE account IDs. Parsing + safety rules are the
   shared `makeServerListCohort` factory; this module binds it to the Suppliers
   env var and surfaces the boolean as the trusted `suppliersServerList` flag in
   /api/me/bootstrap.

   Safety (from the factory): empty/malformed → nobody in cohort; customer
   accounts never auto-enabled; opaque ids never logged; exact match only.
   --------------------------------------------------------------------------- */

import { makeServerListCohort } from "./rollout-cohort";

const cohort = makeServerListCohort("KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS");

/** True iff this authenticated account is in the internal Suppliers server-list
    cohort. Pass the REAL logged-in account id (not a view-as target) + user_type. */
export function isInSuppliersServerListCohort(
  accountId: string | null | undefined,
  userType: string | null | undefined,
): boolean {
  return cohort.isInCohort(accountId, userType);
}

/** Size of the configured cohort (for safe diagnostics — count only, no ids). */
export function suppliersServerListCohortSize(): number {
  return cohort.size();
}
