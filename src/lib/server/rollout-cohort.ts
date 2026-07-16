import "server-only";

/* ---------------------------------------------------------------------------
   rollout-cohort — shared, trusted SERVER-SIDE cohort resolver for the
   server-list controlled rollouts (Customers first, now Suppliers).
   (Phase 4 Wave 2A — generalized in 2A.2)

   A cohort is an allowlist of OPAQUE account IDs held in an env var
   (comma / whitespace / newline separated). `makeServerListCohort(envVar)`
   returns a small resolver bound to that variable. Each rollout owns its OWN
   env var (never shared) so cohorts stay independent — e.g.
   `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS`, `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS`.

   Safety (identical for every cohort built from this factory):
     · Resolved server-side from the AUTHENTICATED account — never from
       anything the browser sends.
     · Empty or malformed config → nobody is in the cohort (legacy default).
     · customer/member accounts are NEVER auto-enabled, even if listed.
     · Account IDs are opaque UUIDs; they are never logged.
     · Exact string match only (no prefix/substring matching).
   --------------------------------------------------------------------------- */

export interface ServerListCohort {
  /** True iff this authenticated account is in the cohort. Pass the REAL
      logged-in account id (not a view-as target) + its user_type. */
  isInCohort(
    accountId: string | null | undefined,
    userType: string | null | undefined,
  ): boolean;
  /** Size of the configured cohort (safe diagnostics — count only, no ids). */
  size(): number;
}

export function makeServerListCohort(envVar: string): ServerListCohort {
  let _cache: { raw: string; set: Set<string> } | null = null;

  const cohortSet = (): Set<string> => {
    const raw = process.env[envVar] ?? "";
    if (_cache && _cache.raw === raw) return _cache.set;
    const set = new Set<string>();
    try {
      for (const part of raw.split(/[\s,]+/)) {
        const id = part.trim();
        if (id) set.add(id);
      }
    } catch {
      /* malformed → empty set (legacy default) */
    }
    _cache = { raw, set };
    return set;
  };

  return {
    isInCohort(accountId, userType) {
      if (!accountId) return false;
      if (userType === "customer") return false; // never auto-enable customer/member
      return cohortSet().has(accountId);
    },
    size() {
      return cohortSet().size;
    },
  };
}
