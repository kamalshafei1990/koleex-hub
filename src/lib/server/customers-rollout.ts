import "server-only";

/* ---------------------------------------------------------------------------
   Customers server-list — trusted SERVER-SIDE cohort resolution.
   (Phase 4 Wave 2A.1 — controlled internal rollout)

   The cohort is an allowlist of OPAQUE account IDs in the env var
   `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS` (comma / whitespace / newline
   separated). This is resolved server-side from the AUTHENTICATED account —
   never from anything the browser sends — and the boolean result is surfaced
   in /api/me/bootstrap so the client can pick the default UI.

   Safety:
     · Empty or malformed config → nobody is in the cohort (legacy default).
     · customer/member accounts are NEVER auto-enabled, even if listed.
     · Account IDs are opaque UUIDs; they are never logged.
     · `?serverlist=0/1` overrides live in the client gate; they only choose
       which UI renders and cannot bypass auth / permissions / tenant / RLS —
       the API enforces all of those regardless of UI.
   --------------------------------------------------------------------------- */

let _cache: { raw: string; set: Set<string> } | null = null;

function cohortSet(): Set<string> {
  const raw = process.env.KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS ?? "";
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
}

/** True iff this authenticated account is in the internal server-list cohort.
    Pass the REAL logged-in account id (not a view-as target) + its user_type. */
export function isInCustomersServerListCohort(
  accountId: string | null | undefined,
  userType: string | null | undefined,
): boolean {
  if (!accountId) return false;
  if (userType === "customer") return false; // never auto-enable customer/member
  return cohortSet().has(accountId);
}

/** Size of the configured cohort (for safe diagnostics — count only, no ids). */
export function customersServerListCohortSize(): number {
  return cohortSet().size;
}
