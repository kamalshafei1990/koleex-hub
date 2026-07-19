/* ---------------------------------------------------------------------------
   rollout-gate — pure, unit-testable decision for the server-list rollout
   gates (Customers, Suppliers, …). No window / bootstrap / React.
   (Phase 4 Wave 2A — generalized in 2A.2)

   Precedence (highest first):
     1. ?serverlist=0            → legacy (explicit opt-out / escape hatch)
     2. ?serverlist=1            → server-list (explicit opt-in)
     3. inCohort (trusted flag)  → server-list (internal cohort default)
     4. everyone else            → legacy (default EVERYWHERE)

   The old rule 4 ("non-production host → server-list") is gone by owner
   decision (2026-07-20): every host — previews included — shows the SAME
   Customers/Suppliers app as production. The pilot is now reachable only
   via ?serverlist=1 or the server-resolved cohort.

   `inCohort` MUST come from a server-resolved source (bootstrap), never from
   client-supplied identity. The ?serverlist params only choose which UI
   renders; the API still enforces auth / permissions / tenant / RLS / module
   access regardless. This function is resource-agnostic — every directory
   rollout reuses it as-is. */
export function shouldUseServerList(_hostname: string, search: string, inCohort: boolean): boolean {
  const sp = new URLSearchParams(search || "");
  const override = sp.get("serverlist");
  if (override === "0") return false; // 1
  if (override === "1") return true;  // 2
  if (inCohort) return true;          // 3
  return false;                       // 4 (legacy default everywhere)
}
