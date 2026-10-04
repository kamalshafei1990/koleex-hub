import "server-only";

/* ---------------------------------------------------------------------------
   Contacts server-list — trusted SERVER-SIDE cohort resolution.
   (Phase 4 Wave 2A — controlled internal rollout, generic /contacts)

   Its OWN env var `KX_CONTACTS_SERVER_LIST_ACCOUNT_IDS` (never the Customers
   or Suppliers one) holds an allowlist of OPAQUE account IDs. Parsing + safety
   rules are the shared `makeServerListCohort` factory; this module binds it to
   the Contacts env var and surfaces the boolean as the trusted
   `contactsServerList` flag in /api/me/bootstrap.

   Safety (from the factory): empty/malformed → nobody in cohort; customer
   accounts never auto-enabled; opaque ids never logged; exact match only.
   --------------------------------------------------------------------------- */

import { makeServerListCohort } from "./rollout-cohort";

const cohort = makeServerListCohort("KX_CONTACTS_SERVER_LIST_ACCOUNT_IDS");

/** True iff this authenticated account is in the internal Contacts server-list
    cohort. Pass the REAL logged-in account id (not a view-as target) + user_type. */
export function isInContactsServerListCohort(
  accountId: string | null | undefined,
  userType: string | null | undefined,
): boolean {
  return cohort.isInCohort(accountId, userType);
}

/** Size of the configured cohort (for safe diagnostics — count only, no ids). */
export function contactsServerListCohortSize(): number {
  return cohort.size();
}
