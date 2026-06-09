import "server-only";

/* ---------------------------------------------------------------------------
   session-validate-shadow — P1·S2 dual-read validator (SHADOW-ONLY).

   Runs alongside the AUTHORITATIVE legacy v1 validator on authenticated
   requests (when SESSION_STATEFUL_VALIDATE_SHADOW=true) and logs whether the
   equivalent stateful session WOULD validate. It NEVER:
     · affects the auth decision (callers ignore the return value)
     · denies/revokes/logs out/rotates/mints cookies/writes anything
   Read-only: two indexed SELECTs (account_sessions newest active row for the
   account + accounts.status/sessions_valid_after), run in parallel. No
   last_active_at write. Fully self-guarded — any error → db_error verdict,
   never thrown.

   v1 cookies carry no token, so this is ACCOUNT-SCOPED parity (see
   session-validate-core.ts). Per-token matching arrives with v3 (later).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";
import {
  evaluateDualRead,
  sessionStatefulValidateShadowEnabled,
  type DualReadResult,
} from "./session-validate-core";

// Re-export the flag for callers (auth.ts) that only need the gate.
export { sessionStatefulValidateShadowEnabled } from "./session-validate-core";

/**
 * Dual-read shadow comparator. Call with the REAL (authoritative) account id of
 * an already-authenticated request. Logs `[session-s2]` and returns the result
 * for tests/metrics. Never throws, never blocks, never mutates.
 */
export async function runDualReadShadow(args: {
  realAccountId: string;
  legacyValid?: boolean;
}): Promise<DualReadResult | null> {
  if (!sessionStatefulValidateShadowEnabled()) return null;
  const t0 = Date.now();
  const legacyValid = args.legacyValid ?? true;

  try {
    const [sessRes, acctRes] = await Promise.all([
      supabaseServer
        .from("account_sessions")
        .select("id, created_at, expires_at, revoked_at")
        .eq("account_id", args.realAccountId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseServer
        .from("accounts")
        .select("status, sessions_valid_after")
        .eq("id", args.realAccountId)
        .maybeSingle(),
    ]);

    const row =
      (sessRes.data as
        | { id: string; created_at: string; expires_at: string | null; revoked_at: string | null }
        | null) ?? null;

    const result = evaluateDualRead({
      legacyValid,
      row,
      accountStatus: (acctRes.data?.status as string | undefined) ?? null,
      sessionsValidAfter: (acctRes.data?.sessions_valid_after as string | null | undefined) ?? null,
      now: new Date(),
      dbError: !!sessRes.error || !!acctRes.error,
    });

    console.info(
      "[session-s2]",
      JSON.stringify({
        verdict: result.verdict,
        account_id: args.realAccountId,
        session_id: row?.id ?? null,
        legacy_valid: result.legacy_valid,
        stateful_valid: result.stateful_valid,
        reason: result.reason,
        ms: Date.now() - t0,
      }),
    );
    return result;
  } catch (e) {
    // Read-only shadow must never affect the request.
    console.warn(
      "[session-s2] error (auth unaffected):",
      e instanceof Error ? e.message : String(e),
    );
    return {
      legacy_valid: legacyValid,
      stateful_valid: false,
      verdict: "would_deny",
      reason: "db_error",
    };
  }
}
