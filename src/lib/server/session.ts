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

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "[session] SESSION_SECRET env var missing or too short.\n\n" +
        "Generate one with: openssl rand -base64 32\n" +
        "Add it to .env.local AND to your Vercel project env vars.\n" +
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
