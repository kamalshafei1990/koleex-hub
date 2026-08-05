/* ===========================================================================
   Permission intersection + blast-radius guard — ADR-008, executable.

       effective = package.requested ∩ tenant.consented ∩ user.grants

   The package can only LOSE rights at each term — it is structurally
   incapable of escalation, which is the entire point. The user term is
   evaluated PER TURN (and re-checked per tool call), because grants change
   after install.

   The blast-radius guard is the runtime's stage-8 decision, expressed as a
   pure function so Phase 4 wires it in instead of re-deriving it:
     read         → proceed
     suggest      → draft only, nothing persisted
     write        → explicit user confirmation required
     irreversible → BLOCKED in v1 (declared intent is legal; execution is not)

   Pure functions. No I/O.
   =========================================================================== */

import {
  blastRadiusRank,
  V1_EXECUTION_CAP,
  type BlastRadius,
} from "./contracts";

/** The three-way intersection. Order-independent; duplicates collapse. */
export function intersectPermissions(
  requested: string[],
  tenantConsented: string[],
  userGrants: string[],
): string[] {
  const tenant = new Set(tenantConsented);
  const user = new Set(userGrants);
  return [...new Set(requested)].filter((p) => tenant.has(p) && user.has(p));
}

export type GuardDecision =
  | { action: "proceed" }
  | { action: "draft_only" }
  | { action: "require_confirmation" }
  | { action: "block"; reason: string };

/**
 * Decide what the runtime may do with an operation of the given radius,
 * under the package's effective (already-merged) radius.
 *
 * Both checks matter: the operation must fit inside the package's declared
 * radius AND inside the v1 execution cap. A package declaring "read" that
 * tries a "write" tool is blocked even though writes are generally legal.
 */
export function guardBlastRadius(
  operationRadius: BlastRadius,
  packageRadius: BlastRadius,
): GuardDecision {
  if (blastRadiusRank(operationRadius) > blastRadiusRank(packageRadius)) {
    return {
      action: "block",
      reason: `Operation is "${operationRadius}" but the package declares "${packageRadius}" — outside its own declaration.`,
    };
  }
  if (blastRadiusRank(operationRadius) > blastRadiusRank(V1_EXECUTION_CAP)) {
    return {
      action: "block",
      reason: `"${operationRadius}" operations are disabled in v1 (execution cap "${V1_EXECUTION_CAP}").`,
    };
  }
  switch (operationRadius) {
    case "read": return { action: "proceed" };
    case "suggest": return { action: "draft_only" };
    case "write": return { action: "require_confirmation" };
    /* Unreachable while V1_EXECUTION_CAP === "write", but the guard must
       stay correct if the cap is ever lifted: irreversible always demands
       explicit human approval — never plain confirmation. */
    case "irreversible": return { action: "block", reason: "Irreversible operations require the v2 human-approval flow." };
  }
}
