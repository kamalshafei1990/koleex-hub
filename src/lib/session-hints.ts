"use client";

/* ---------------------------------------------------------------------------
   session-hints — the client's half of "am I signed in", and the one place
   that throws it away when the server says otherwise.

   THE HUB HAS TWO HALVES OF A SESSION AND THEY EXPIRE AT DIFFERENT TIMES.
   The real one is the HttpOnly `koleex_session` cookie: 30 days, or a
   browser-session cookie on a shared device, and any mobile browser may drop
   it earlier on its own (Safari's ITP, an OPPO/Chrome "clear cookies", a
   secret rotation). The other is `koleex-admin` in localStorage, which is
   what the gate actually reads to decide whether to show the Hub or the
   sign-in form — and localStorage NEVER expires.

   When the cookie goes and the flag stays, the device believes it is signed
   in: the Hub paints, every API answers 401, and Home shows "We couldn't
   load your apps · Session expired — please sign in again" over a screen
   that will never ask for a password, because as far as the gate is
   concerned you already gave one. Measured on the owner's phone on
   13 Sep 2026: the account made ZERO sign-in attempts while that banner was
   on screen, then exactly one — successful, first try — the moment he
   signed out by hand. The password was never the problem.

   So the server's 401 is the authority, and this module is how it reaches
   the gate: drop every client-side hint and announce it, so the sign-in form
   comes back on its own instead of waiting for the operator to guess.
   --------------------------------------------------------------------------- */

import { setCurrentAccountId } from "./identity";

/** Dispatched on `window` after the hints are cleared. AdminAuth listens. */
export const SESSION_INVALID_EVENT = "koleex-session-invalid";

/* Kept as literals rather than imported from AdminAuth: this module is
   loaded by the bootstrap fetch path, and AdminAuth is a 1200-line component
   that must not be dragged into that chunk. Duplication that drifts silently
   would put the gate back in the state this module exists to end, so
   `npm run validate:session-hints` asserts these three strings still match
   AdminAuth's own constants. */
const LEGACY_SESSION_KEY = "koleex-admin";
const LEGACY_SESSION_USER_KEY = "koleex-admin-user";

/**
 * Forget that this device is signed in, and tell the gate.
 *
 * Call ONLY where the server has refused the cookie itself (a 401 from
 * /api/me/bootstrap, which 401s exactly when there is no valid session) or
 * where the user asked to sign out. Never on a transient network error: this
 * puts the password form back on screen, and doing that to someone whose
 * session is perfectly fine is its own bug.
 */
export function dropClientSessionHints(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_USER_KEY);
  } catch {
    /* storage blocked — the event below still flips the gate for this tab */
  }
  /* Drops the stored account id and clears the identity + scope caches, so a
     later sign-in on this device cannot inherit the previous identity. */
  try { setCurrentAccountId(null); } catch { /* ignore */ }
  try {
    window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
  } catch {
    /* ignore */
  }
}
