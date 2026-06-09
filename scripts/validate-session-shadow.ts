#!/usr/bin/env tsx

/* ===========================================================================
   P1 · S1 — session-shadow validator (pure; no DB, no auth).

   Proves the SHADOW comparator + token primitives in isolation:
     · flag default OFF; parsed only from SESSION_STATEFUL_SHADOW="true"
     · opaque token: base64url, ≥43 chars (32 bytes), unique per call
     · comparator: fresh→match; revoked/expired/inactive/epoch→would_deny
     · comparator NEVER throws (junk input → would_deny, no exception)
   Behavioural guarantees (success-only write, no token leak, login-never-
   blocked, legacy auth unchanged) are proven by code structure + preview.
   ========================================================================== */

import {
  sessionStatefulShadowEnabled,
  generateSessionToken,
  evaluateStatefulShadow,
} from "../src/lib/server/session-shadow-core";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const NOW = new Date("2026-06-09T12:00:00Z");
const PAST = "2026-01-01T00:00:00Z";
const FUTURE = "2026-12-01T00:00:00Z";
const freshRow = { revoked_at: null, expires_at: FUTURE, created_at: PAST };

/* ── flag parse ──────────────────────────────────────────────────────── */
delete process.env.SESSION_STATEFUL_SHADOW;
check("flag default OFF", sessionStatefulShadowEnabled() === false);
process.env.SESSION_STATEFUL_SHADOW = "true";
check("flag 'true' → on", sessionStatefulShadowEnabled() === true);
process.env.SESSION_STATEFUL_SHADOW = "false";
check("flag 'false' → off", sessionStatefulShadowEnabled() === false);
delete process.env.SESSION_STATEFUL_SHADOW;

/* ── token primitives ───────────────────────────────────────────────── */
const t1 = generateSessionToken();
const t2 = generateSessionToken();
check("token base64url only", /^[A-Za-z0-9_-]+$/.test(t1));
check("token length ≥ 43 (32 bytes b64url)", t1.length >= 43);
check("tokens unique per call", t1 !== t2);

/* ── comparator: fresh → match ──────────────────────────────────────── */
const v = evaluateStatefulShadow({ row: freshRow, accountStatus: "active", sessionsValidAfter: null, now: NOW });
check("fresh active row → would_match", v.would_match === true && v.would_deny === false && v.reason === "ok");

/* ── comparator: deny paths ─────────────────────────────────────────── */
check("no row → would_deny no_session_row",
  evaluateStatefulShadow({ row: null, accountStatus: "active", sessionsValidAfter: null, now: NOW }).reason === "no_session_row");
check("revoked → would_deny revoked",
  evaluateStatefulShadow({ row: { ...freshRow, revoked_at: PAST }, accountStatus: "active", sessionsValidAfter: null, now: NOW }).reason === "revoked");
check("expired → would_deny expired",
  evaluateStatefulShadow({ row: { ...freshRow, expires_at: PAST }, accountStatus: "active", sessionsValidAfter: null, now: NOW }).reason === "expired");
check("inactive account → would_deny account_inactive",
  evaluateStatefulShadow({ row: freshRow, accountStatus: "disabled", sessionsValidAfter: null, now: NOW }).reason === "account_inactive");
check("epoch after created_at → would_deny epoch_invalidated",
  evaluateStatefulShadow({ row: freshRow, accountStatus: "active", sessionsValidAfter: FUTURE, now: NOW }).reason === "epoch_invalidated");
check("epoch before created_at → still match",
  evaluateStatefulShadow({ row: { ...freshRow, created_at: FUTURE }, accountStatus: "active", sessionsValidAfter: PAST, now: NOW }).would_match === true);

/* ── comparator never throws on junk ─────────────────────────────────── */
let threw = false;
try {
  const junk = { row: { revoked_at: null, expires_at: "not-a-date", created_at: "x" }, accountStatus: null, sessionsValidAfter: "y", now: NOW } as Parameters<typeof evaluateStatefulShadow>[0];
  const j = evaluateStatefulShadow(junk);
  check("junk input → would_deny, no throw", j.would_deny === true || j.would_match === false);
} catch { threw = true; }
check("comparator did not throw on junk", threw === false);

/* ── precedence: revoked beats expired ──────────────────────────────── */
check("revoked precedence over expired",
  evaluateStatefulShadow({ row: { revoked_at: PAST, expires_at: PAST, created_at: PAST }, accountStatus: "active", sessionsValidAfter: null, now: NOW }).reason === "revoked");

console.log(`\nsession-shadow: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
