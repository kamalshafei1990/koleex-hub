/* ---------------------------------------------------------------------------
   session-validate-core — PURE dual-read comparator for P1·S2 (no I/O, no
   server-only). Unit-testable in plain Node.

   SHADOW-ONLY. This computes what a FUTURE stateful validator WOULD decide for
   a session, alongside the (authoritative) legacy v1 result. It NEVER affects
   auth — callers only log the verdict.

   IMPORTANT S2 reality: the live v1 cookie is `<accountId>.<sig>` — it carries
   NO session token. So a request cannot identify a specific session row by
   token; S2 evaluates ACCOUNT-SCOPED parity ("does this account have a
   stateful session that would authorize right now?"). The token/hash branches
   (malformed / hash_mismatch) are implemented for the FUTURE v3 path and are
   exercised by the test suite, but are not reachable from a v1 cookie today.
   --------------------------------------------------------------------------- */

/** S2 dual-read shadow flag. Default OFF. Enables the comparator + logs ONLY;
 *  never validation/enforcement/cookies. */
export function sessionStatefulValidateShadowEnabled(): boolean {
  return (process.env.SESSION_STATEFUL_VALIDATE_SHADOW ?? "").trim().toLowerCase() === "true";
}

export type DualReadReason =
  | null // would_match
  | "no_session_row"
  | "revoked"
  | "expired"
  | "epoch_invalidated"
  | "malformed"
  | "hash_mismatch"
  | "inactive_account"
  | "db_error"
  | "unknown";

export type DualReadVerdict = "would_match" | "would_deny";

export interface DualReadResult {
  legacy_valid: boolean;
  stateful_valid: boolean;
  verdict: DualReadVerdict;
  reason: DualReadReason;
}

export interface DualReadRow {
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Pure dual-read evaluation. `legacyValid` is the authoritative legacy result
 * (always true when this is called from a successfully-authenticated request).
 * Everything else describes the stateful session candidate.
 *
 * Optional token inputs are for the FUTURE v3 path:
 *   · cookieMalformed → "malformed"
 *   · expected/actual token hash differ → "hash_mismatch"
 * In S2 (v1 cookie) neither is supplied, so neither fires.
 */
export function evaluateDualRead(input: {
  legacyValid: boolean;
  row: DualReadRow | null;
  accountStatus: string | null;
  sessionsValidAfter: string | null;
  now: Date;
  cookieMalformed?: boolean;
  expectedTokenHash?: string | null;
  actualTokenHash?: string | null;
  dbError?: boolean;
}): DualReadResult {
  const legacy_valid = input.legacyValid;
  const deny = (reason: Exclude<DualReadReason, null>): DualReadResult => ({
    legacy_valid,
    stateful_valid: false,
    verdict: "would_deny",
    reason,
  });

  try {
    if (input.dbError) return deny("db_error");
    if (input.cookieMalformed) return deny("malformed");

    // v3-future: explicit token hash comparison when both present.
    if (
      input.expectedTokenHash != null &&
      input.actualTokenHash != null &&
      input.expectedTokenHash !== input.actualTokenHash
    ) {
      return deny("hash_mismatch");
    }

    const { row, accountStatus, sessionsValidAfter, now } = input;
    if (!row) return deny("no_session_row");
    if (row.revoked_at != null) return deny("revoked");
    if (row.expires_at != null && new Date(row.expires_at).getTime() <= now.getTime()) {
      return deny("expired");
    }
    if (accountStatus !== "active") return deny("inactive_account");
    if (
      sessionsValidAfter != null &&
      new Date(row.created_at).getTime() < new Date(sessionsValidAfter).getTime()
    ) {
      return deny("epoch_invalidated");
    }
    return { legacy_valid, stateful_valid: true, verdict: "would_match", reason: null };
  } catch {
    return deny("unknown");
  }
}
