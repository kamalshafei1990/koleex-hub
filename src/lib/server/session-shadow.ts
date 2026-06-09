import "server-only";

/* ---------------------------------------------------------------------------
   session-shadow — P1 · S1: stateful-session SHADOW write + comparator.

   SHADOW-ONLY. NOT authoritative; NEVER affects auth:
     · On a SUCCESSFUL login only, mints a random opaque token, stores ONLY its
       sha256 in account_sessions, and logs a "would-be" stateful verdict.
     · The raw token NEVER leaves the server (not returned, not cookie, not
       logged) — only the hash is persisted.
     · Legacy v1 cookie + getSessionAccountId remain the ONLY auth source.
     · Flag-gated (SESSION_STATEFUL_SHADOW) + fully self-guarded: can never
       throw, block, or alter a login.

   Pure primitives live in session-shadow-core.ts (no server-only) for unit
   testing; this file adds the DB write + structured logging.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";
import { clientIp, clientUserAgent } from "./rate-limit";
import {
  SESSION_IDLE_MS,
  sessionStatefulShadowEnabled,
  generateSessionToken,
  hashToken,
  parseUa,
  evaluateStatefulShadow,
  type ShadowRow,
} from "./session-shadow-core";

// Re-export the flag for callers that only need the gate.
export { sessionStatefulShadowEnabled } from "./session-shadow-core";

/**
 * Shadow recorder — call ONLY after a successful login. Flag-gated, awaited,
 * fully self-guarded. Writes one account_sessions row (hash-only) and logs the
 * comparator verdict. The raw token is generated, hashed, and discarded.
 */
export async function recordSessionShadow(args: {
  accountId: string;
  accountStatus: string;
  req: Request;
}): Promise<void> {
  if (!sessionStatefulShadowEnabled()) return;
  const t0 = Date.now();
  try {
    const token = generateSessionToken(); // server-only; discarded after hashing
    const session_token_hash = hashToken(token);
    const ua = clientUserAgent(args.req);
    const ip = clientIp(args.req);
    const dev = parseUa(ua);
    const expires_at = new Date(Date.now() + SESSION_IDLE_MS).toISOString();

    const ins = await supabaseServer
      .from("account_sessions")
      .insert({
        account_id: args.accountId,
        session_token_hash,
        auth_method: "password",
        device_name: dev.device_name,
        device_type: dev.device_type,
        os: dev.os,
        browser: dev.browser,
        ip_address: ip || null,
        expires_at,
        revoked_at: null,
      })
      .select("id, created_at, expires_at, revoked_at")
      .maybeSingle();

    const row = (ins.data ?? null) as (ShadowRow & { id: string }) | null;

    if (row?.id) {
      console.info(
        "[session-shadow]",
        JSON.stringify({
          evt: "session-created",
          account_id: args.accountId,
          session_id: row.id,
          auth_method: "password",
          ms: Date.now() - t0,
        }),
      );
    }

    // Live account state for a realistic comparator (status + epoch).
    const { data: acct } = await supabaseServer
      .from("accounts")
      .select("status, sessions_valid_after")
      .eq("id", args.accountId)
      .maybeSingle();

    const verdict = evaluateStatefulShadow({
      row,
      accountStatus: (acct?.status as string | undefined) ?? args.accountStatus,
      sessionsValidAfter: (acct?.sessions_valid_after as string | null | undefined) ?? null,
      now: new Date(),
    });

    console.info(
      "[session-shadow]",
      JSON.stringify({
        evt: verdict.would_match ? "comparator-match" : "comparator-would-deny",
        account_id: args.accountId,
        session_id: row?.id ?? null,
        auth_method: "password",
        reason: verdict.reason,
        compare_result: verdict.would_match ? "match" : "would_deny",
        ms: Date.now() - t0,
      }),
    );
  } catch (e) {
    console.warn(
      "[session-shadow] error (login unaffected):",
      e instanceof Error ? e.message : String(e),
    );
  }
}
