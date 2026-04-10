/* ---------------------------------------------------------------------------
   auth-client — thin wrapper around supabase.auth for Project C Phase 2.

   Gives the rest of the app a single import for sign-in / sign-out / session
   and automatically fires the appropriate audit events (via logEvent from
   account-security).

   Gated behind the NEXT_PUBLIC_USE_SUPABASE_AUTH feature flag so the default
   (legacy AdminAuth password gate) path is completely unaffected until the
   user flips the switch.

   Once the flag is on and the migration script has linked accounts.id ↔
   auth.users.id, every call to signIn/signOut also:

     - writes a row to account_sessions (device tracking)
     - appends a login_success / login_failed / logout event to
       account_login_history (audit trail)
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import {
  createSession,
  logEvent,
  revokeSession,
  sha256Hex,
} from "./account-security";
import type { Session, User } from "@supabase/supabase-js";

/** Is real Supabase Auth enabled for this deployment? */
export function isSupabaseAuthEnabled(): boolean {
  // Explicit opt-in. Any value other than "true" falls back to AdminAuth.
  return process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === "true";
}

export type SignInResult =
  | { ok: true; session: Session; user: User; mfaRequired: false }
  | {
      ok: true;
      session: null;
      user: User;
      mfaRequired: true;
      factorId: string;
    }
  | { ok: false; error: string };

/**
 * Sign in with email + password. If the account has MFA enabled, returns
 * `{ mfaRequired: true, factorId }` so the UI can show the code prompt.
 * Otherwise returns `{ session, user }` ready to use.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data?.user) {
    // Best-effort audit entry — we don't know the account_id yet (the sign-in
    // failed) so we can't attribute it. We still attempt a lookup by email
    // so the Security tab's audit log shows the failed attempt.
    await logFailedLoginByEmail(email, error?.message || "unknown error");
    return { ok: false, error: error?.message || "Sign-in failed" };
  }

  // Check for outstanding MFA factors. If the user has any verified factor
  // that hasn't been satisfied by the current AAL level, ask the caller to
  // challenge them.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.all?.find((f) => f.status === "verified");
    if (verified) {
      return {
        ok: true,
        session: null,
        user: data.user,
        mfaRequired: true,
        factorId: verified.id,
      };
    }
  }

  // No MFA challenge outstanding — log the successful sign-in and create
  // an account_sessions row for the Security tab.
  if (data.session) {
    await Promise.all([
      logEvent(data.user.id, "login_success", {
        email: data.user.email,
      }),
      createSession(data.user.id, data.session.access_token, {
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        expires_at: data.session.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : null,
      }),
    ]);
  }

  return {
    ok: true,
    session: data.session!,
    user: data.user,
    mfaRequired: false,
  };
}

/** Verify a TOTP/passkey MFA challenge issued during sign-in. */
export async function verifyMfaChallenge(
  factorId: string,
  code: string,
): Promise<SignInResult> {
  const { data: challenge, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr || !challenge) {
    return { ok: false, error: challengeErr?.message || "MFA challenge failed" };
  }

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });

  if (error || !data) {
    return { ok: false, error: error?.message || "Invalid MFA code" };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { ok: false, error: "Could not load user after MFA verify" };
  }

  // Log the successful 2FA-satisfied sign-in.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    await Promise.all([
      logEvent(userData.user.id, "login_success", {
        email: userData.user.email,
        mfa: true,
      }),
      createSession(userData.user.id, sessionData.session.access_token, {
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        expires_at: sessionData.session.expires_at
          ? new Date(sessionData.session.expires_at * 1000).toISOString()
          : null,
      }),
    ]);
  }

  return {
    ok: true,
    session: sessionData?.session ?? null!,
    user: userData.user,
    mfaRequired: false,
  };
}

/** Sign the current user out and mirror the action into the audit log. */
export async function signOut(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  const accessToken = data?.session?.access_token;

  if (uid) {
    void logEvent(uid, "logout", {});
  }

  // Revoke the matching account_sessions row by hash so the Security tab
  // doesn't show a ghost device.
  if (uid && accessToken) {
    try {
      const hash = await sha256Hex(accessToken);
      const { data: rows } = await supabase
        .from("account_sessions")
        .select("id")
        .eq("account_id", uid)
        .eq("session_token_hash", hash)
        .is("revoked_at", null)
        .limit(1);
      const id = (rows as { id: string }[] | null)?.[0]?.id;
      if (id) await revokeSession(id);
    } catch {
      // Non-fatal — best-effort cleanup.
    }
  }

  await supabase.auth.signOut();
}

/** Current Supabase session, or null. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/** Current Supabase user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/** Subscribe to sign-in / sign-out events. Returns an unsubscribe handle. */
export function onAuthStateChange(
  cb: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

/* ============================================================================
   Internal helpers
   ============================================================================ */

/**
 * When a sign-in fails we don't have a session, so `auth.uid()` is NULL and
 * we can't attribute the failure via normal logEvent. Instead we look the
 * account up by login_email and write the audit row via the admin client.
 */
async function logFailedLoginByEmail(
  email: string,
  reason: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("accounts")
      .select("id")
      .eq("login_email", email.trim())
      .maybeSingle();
    const id = (data as { id: string } | null)?.id;
    if (id) {
      void logEvent(id, "login_failed", { reason });
    }
  } catch {
    // Non-fatal.
  }
}
