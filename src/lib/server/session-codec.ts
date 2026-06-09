/* ---------------------------------------------------------------------------
   session-codec — PURE session-cookie codec (Phase 2A · B1c-2a).

   Zero runtime deps beyond node:crypto. No "server-only", no next/headers, no
   env reads — the HMAC secret is passed in. This makes the parser unit-testable
   in plain Node (scripts/validate-session-codec.ts) and lets session.ts stay a
   thin cookie-store wrapper around it.

   Two cookie formats are understood (DUAL-READ). v1 is the live format today;
   v2 is forward-compatible groundwork and is NOT minted yet (B1c-2d).

     v1:  <accountId>.<sig>
            sig = HMAC-SHA256(accountId)              (current behaviour, unchanged)
     v2:  <payload>.<sig>
            payload = base64url(JSON{ v:2, aid, tid|null, bid|null, iat })
            sig     = HMAC-SHA256("v2:" + payload)    (domain-tagged so a v1 sig
                                                       can never be replayed as v2)

   Distinguishing them is unambiguous: a v1 head is a UUID; a v2 head is a
   base64url JSON blob (never a UUID). Everything fails CLOSED — any tamper,
   malformed input, wrong version, or bad field returns null.
   --------------------------------------------------------------------------- */

import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SessionVersion = 1 | 2;

export interface ParsedSession {
  accountId: string;
  activeTenantId: string | null;
  activeBranchId: string | null;
  sessionVersion: SessionVersion;
}

export interface SessionPayloadV2 {
  v: 2;
  aid: string;
  tid: string | null;
  bid: string | null;
  iat: number;
}

/** v1 signature — HMAC over the bare accountId. MUST match the legacy
 *  `sign()` in session.ts exactly so existing cookies keep verifying. */
export function signV1(accountId: string, secret: string): string {
  return createHmac("sha256", secret).update(accountId).digest("base64url");
}

/** v2 signature — domain-tagged HMAC over the base64url payload. */
export function signV2(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`v2:${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Build a v2 cookie VALUE (string). NOT a cookie-minting function — it only
 *  produces the signed string. Used by tests now; by setSessionCookie in a
 *  later sub-stage (B1c-2d). Nothing in production calls this yet. */
export function buildSessionValueV2(
  fields: { aid: string; tid?: string | null; bid?: string | null; iat: number },
  secret: string,
): string {
  const obj: SessionPayloadV2 = {
    v: 2,
    aid: fields.aid,
    tid: fields.tid ?? null,
    bid: fields.bid ?? null,
    iat: fields.iat,
  };
  const payload = Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
  return `${payload}.${signV2(payload, secret)}`;
}

/**
 * Parse + verify a raw session cookie value into a ParsedSession, or null if
 * missing / malformed / tampered / wrong-version. Pure: no I/O, no env.
 */
export function parseSessionValue(
  raw: string | undefined | null,
  secret: string,
): ParsedSession | null {
  if (!raw || typeof raw !== "string") return null;

  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [head, sig] = parts;
  if (!head || !sig) return null;

  /* ── v1: <accountId>.<sig> ─────────────────────────────────────────── */
  if (UUID_RE.test(head)) {
    if (!safeEqual(sig, signV1(head, secret))) return null;
    return { accountId: head, activeTenantId: null, activeBranchId: null, sessionVersion: 1 };
  }

  /* ── v2: <base64url(JSON)>.<sig> ───────────────────────────────────── */
  if (!safeEqual(sig, signV2(head, secret))) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (o.v !== 2) return null;
  if (typeof o.aid !== "string" || !UUID_RE.test(o.aid)) return null;

  const tid = o.tid;
  if (!(tid === undefined || tid === null || (typeof tid === "string" && UUID_RE.test(tid)))) return null;

  const bid = o.bid;
  if (!(bid === undefined || bid === null || (typeof bid === "string" && UUID_RE.test(bid)))) return null;

  if (typeof o.iat !== "number" || !Number.isFinite(o.iat)) return null;

  return {
    accountId: o.aid,
    activeTenantId: typeof tid === "string" ? tid : null,
    activeBranchId: typeof bid === "string" ? bid : null,
    sessionVersion: 2,
  };
}
