import "server-only";

/* ---------------------------------------------------------------------------
   session — Signed HttpOnly session cookies for the secure API layer.

   We store the authenticated account id in an HttpOnly, Secure, SameSite=Lax
   cookie, signed with HMAC-SHA256 against a server-side secret. This
   replaces the old pattern of storing account id in localStorage (which
   any script on the page could read, and any API call could spoof by
   setting a header).

   Cookie format:   koleex_session = <accountId>.<base64url-signature>
     – accountId must be a valid UUID.
     – signature is HMAC-SHA256(accountId) using SESSION_SECRET.
     – Without the secret, an attacker cannot forge a cookie for another
       account. Tampering with accountId invalidates the signature.

   Why not JWT:
     We don't need the expiry-encoding features of JWT. A signed
     accountId + server-side secret is simpler to reason about and has a
     smaller attack surface. If we later add session expiry, we can bump
     to a JWT or a session table without changing call sites.

   Required env var:
     SESSION_SECRET — any long random string (>= 32 bytes). Generate with
     `openssl rand -base64 32`. Rotating invalidates all existing sessions.
   --------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "koleex_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── View-as override (super-admin only) ─────────────────────────────────
   When a super admin clicks "View as <user>", we set a SECOND cookie
   carrying the target account id. Server-side `getServerAuth()` reads
   this cookie AFTER validating the primary session belongs to a SA, and
   swaps the loaded account id to the target — making every downstream
   permission check (role, overrides) evaluate as that user.

   Why a separate cookie:
     · Keeps the real SA session intact so "Exit view-as" is one cookie
       delete, not a re-sign-in.
     · Server-only HttpOnly cookie can't be tampered with from the page.
     · HMAC signature prevents a malicious client from setting the cookie
       directly with someone else's account id.

   Short max age (2 hours): view-as is a debugging tool, not a persistent
   state. The picker can re-issue if needed. */
const VIEW_AS_COOKIE_NAME = "koleex_view_as";
const VIEW_AS_MAX_AGE = 60 * 60 * 2; // 2 hours

function signViewAs(targetAccountId: string, actorAccountId: string): string {
  /* Bind the signature to BOTH the target and the actor so the cookie is
     only valid for the SA who issued it. Stealing the cookie and pasting
     it into another session won't work — the actor side won't match the
     new session's accountId. */
  return createHmac("sha256", getSecret())
    .update(`${actorAccountId}:${targetAccountId}`)
    .digest("base64url");
}

/** Mint the view-as cookie. Called from POST /api/auth/view-as after
 *  verifying the caller is a super admin and the target is valid. */
export async function setViewAsCookie(
  targetAccountId: string,
  actorAccountId: string,
): Promise<void> {
  if (!UUID_RE.test(targetAccountId) || !UUID_RE.test(actorAccountId)) {
    throw new Error("[session] view-as ids must be UUIDs");
  }
  const sig = signViewAs(targetAccountId, actorAccountId);
  const value = `${targetAccountId}.${actorAccountId}.${sig}`;
  const store = await cookies();
  store.set(VIEW_AS_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIEW_AS_MAX_AGE,
  });
}

/** Clear the view-as cookie. Called from POST /api/auth/view-as/exit. */
export async function clearViewAsCookie(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE_NAME);
}

/** Read the view-as override and return the target account id, but ONLY
 *  if the signature matches the supplied real-session account id. This
 *  guarantees the cookie was issued for THIS session. Returns null if
 *  no override, signature mismatch, or malformed. */
export async function getViewAsAccountId(
  realAccountId: string,
): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(VIEW_AS_COOKIE_NAME)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [targetId, actorId, sig] = parts;
  if (!UUID_RE.test(targetId) || !UUID_RE.test(actorId)) return null;

  /* Cookie was issued for a different session — ignore. */
  if (actorId !== realAccountId) return null;

  try {
    const expected = signViewAs(targetId, actorId);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return targetId;
}

function getSecret(): string {
  // Match the defensive reader in supabase-server.ts — same failure
  // mode (stray quotes / trailing newline from `vercel env pull`)
  // would silently invalidate every cookie signature if we didn't
  // clean it up here.
  let s = (process.env.SESSION_SECRET ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith("\\n")) s = s.slice(0, -2).trim();
  if (!s || s.length < 32) {
    throw new Error(
      "[session] SESSION_SECRET env var missing or too short (after trimming quotes/whitespace).\n\n" +
        "Generate one with: openssl rand -base64 32\n" +
        "Add it to .env.local AND to your Vercel project env vars — no surrounding quotes.\n" +
        "This secret signs every user session — never commit it and " +
        "never put NEXT_PUBLIC_ in front of it.",
    );
  }
  return s;
}

function sign(accountId: string): string {
  return createHmac("sha256", getSecret())
    .update(accountId)
    .digest("base64url");
}

function verifySignature(accountId: string, signature: string): boolean {
  try {
    const expected = sign(accountId);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Mint a session cookie for an authenticated account. Called from the
 * /api/auth/signin route after a successful password verification.
 *
 * Cookie flags:
 *   httpOnly:  JS on the page can't read it (no XSS token theft)
 *   secure:    HTTPS only in production
 *   sameSite:  'lax' — sent on top-level navigation, blocked on cross-site
 *              POST requests (good baseline CSRF protection)
 *   path: '/'  available to every route
 */
export async function setSessionCookie(accountId: string): Promise<void> {
  if (!UUID_RE.test(accountId)) {
    throw new Error("[session] accountId must be a UUID");
  }
  const signature = sign(accountId);
  const value = `${accountId}.${signature}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Remove the session cookie. Called from /api/auth/signout. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Read the current request's session cookie and return the authenticated
 * account id, or null if the cookie is missing / malformed / tampered.
 *
 * Called at the top of every secured API route. Does not fetch the
 * account row — caller should do that if they need account details.
 */
export async function getSessionAccountId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const accountId = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  if (!UUID_RE.test(accountId)) return null;
  if (!verifySignature(accountId, signature)) return null;

  return accountId;
}
