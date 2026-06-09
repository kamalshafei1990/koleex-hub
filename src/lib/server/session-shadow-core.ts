/* ---------------------------------------------------------------------------
   session-shadow-core — PURE primitives for P1·S1 stateful-session shadow.

   No "server-only", no DB, no next/headers — just node:crypto + pure logic, so
   it is unit-testable in plain Node (scripts/validate-session-shadow.ts). The
   DB recorder lives in session-shadow.ts (server-only) and imports these.
   SHADOW-ONLY: nothing here is authoritative or affects auth.
   --------------------------------------------------------------------------- */

import { randomBytes, createHash } from "node:crypto";

/** Idle lifetime target (30d) — stored as expires_at for future parity only.
 *  NOT enforced in S1. */
export const SESSION_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

/** Shadow flag. Default OFF. Enables row creation + comparator + logs ONLY. */
export function sessionStatefulShadowEnabled(): boolean {
  return (process.env.SESSION_STATEFUL_SHADOW ?? "").trim().toLowerCase() === "true";
}

/** Opaque 256-bit session token (base64url). Server-only; never issued. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 hex of a token — the ONLY thing ever persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Minimal, self-contained UA parse (display metadata only; never a security
 *  signal). Local so the auth hot path imports no client-flavoured code. */
export function parseUa(ua: string | null): {
  device_name: string;
  device_type: "desktop" | "mobile" | "tablet" | "other";
  os: string;
  browser: string;
} {
  const u = (ua || "").toLowerCase();
  let device_type: "desktop" | "mobile" | "tablet" | "other" = "desktop";
  if (/ipad|tablet/.test(u)) device_type = "tablet";
  else if (/mobile|iphone|android/.test(u)) device_type = "mobile";
  let os = "Unknown";
  if (/windows/.test(u)) os = "Windows";
  else if (/mac os|macintosh/.test(u)) os = "macOS";
  else if (/iphone|ipad|ios/.test(u)) os = "iOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";
  let browser = "Unknown";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u)) browser = "Chrome";
  else if (/safari\//.test(u)) browser = "Safari";
  else if (/firefox\//.test(u)) browser = "Firefox";
  return { device_name: `${browser} on ${os}`, device_type, os, browser };
}

/* ── Pure comparator (no I/O) — simulates the FUTURE S2 stateful decision.
   Returns a verdict only; NEVER enforced in S1. */
export interface ShadowRow {
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}
export interface ShadowVerdict {
  would_match: boolean;
  would_deny: boolean;
  reason: string;
}

export function evaluateStatefulShadow(input: {
  row: ShadowRow | null;
  accountStatus: string | null;
  sessionsValidAfter: string | null;
  now: Date;
}): ShadowVerdict {
  const deny = (reason: string): ShadowVerdict => ({ would_match: false, would_deny: true, reason });
  try {
    const { row, accountStatus, sessionsValidAfter, now } = input;
    if (!row) return deny("no_session_row");
    if (row.revoked_at != null) return deny("revoked");
    if (row.expires_at != null && new Date(row.expires_at).getTime() <= now.getTime()) return deny("expired");
    if (accountStatus !== "active") return deny("account_inactive");
    if (
      sessionsValidAfter != null &&
      new Date(row.created_at).getTime() < new Date(sessionsValidAfter).getTime()
    ) {
      return deny("epoch_invalidated");
    }
    return { would_match: true, would_deny: false, reason: "ok" };
  } catch {
    // A comparator must NEVER throw. Any anomaly → (logged) would_deny.
    return deny("comparator_error");
  }
}
