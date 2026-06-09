#!/usr/bin/env tsx

/* ===========================================================================
   P1 · S2 — dual-read validator (pure; no DB, no auth).

   Proves the SHADOW dual-read comparator + flag in isolation:
     · flag default OFF; only SESSION_STATEFUL_VALIDATE_SHADOW="true" enables
     · would_match for a fresh active session
     · would_deny reason codes: no_session_row, revoked, expired,
       epoch_invalidated, inactive_account, malformed, hash_mismatch, db_error
     · never throws (junk → unknown/would_deny)
     · legacy_valid is always carried through (shadow never flips legacy)
   Auth-unchanged / no-enforcement / no-cookie guarantees are proven by code
   structure (return object untouched) + preview/prod verification.
   ========================================================================== */

import {
  evaluateDualRead,
  sessionStatefulValidateShadowEnabled,
} from "../src/lib/server/session-validate-core";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const NOW = new Date("2026-06-09T12:00:00Z");
const PAST = "2026-01-01T00:00:00Z";
const FUTURE = "2026-12-01T00:00:00Z";
const fresh = { revoked_at: null, expires_at: FUTURE, created_at: PAST };
const base = { legacyValid: true, accountStatus: "active", sessionsValidAfter: null, now: NOW };

/* ── flag parse ──────────────────────────────────────────────────────── */
delete process.env.SESSION_STATEFUL_VALIDATE_SHADOW;
check("flag default OFF", sessionStatefulValidateShadowEnabled() === false);
process.env.SESSION_STATEFUL_VALIDATE_SHADOW = "true";
check("flag 'true' → on", sessionStatefulValidateShadowEnabled() === true);
process.env.SESSION_STATEFUL_VALIDATE_SHADOW = "FALSE";
check("flag other → off", sessionStatefulValidateShadowEnabled() === false);
delete process.env.SESSION_STATEFUL_VALIDATE_SHADOW;

/* ── would_match ─────────────────────────────────────────────────────── */
const m = evaluateDualRead({ ...base, row: fresh });
check("fresh active → would_match, reason null, stateful_valid true",
  m.verdict === "would_match" && m.reason === null && m.stateful_valid === true && m.legacy_valid === true);

/* ── reason codes ────────────────────────────────────────────────────── */
check("no row → no_session_row",
  evaluateDualRead({ ...base, row: null }).reason === "no_session_row");
check("revoked → revoked",
  evaluateDualRead({ ...base, row: { ...fresh, revoked_at: PAST } }).reason === "revoked");
check("expired → expired",
  evaluateDualRead({ ...base, row: { ...fresh, expires_at: PAST } }).reason === "expired");
check("inactive account → inactive_account",
  evaluateDualRead({ ...base, row: fresh, accountStatus: "disabled" }).reason === "inactive_account");
check("epoch after created_at → epoch_invalidated",
  evaluateDualRead({ ...base, row: fresh, sessionsValidAfter: FUTURE }).reason === "epoch_invalidated");
check("epoch before created_at → would_match",
  evaluateDualRead({ ...base, row: { ...fresh, created_at: FUTURE }, sessionsValidAfter: PAST }).verdict === "would_match");
check("malformed cookie → malformed",
  evaluateDualRead({ ...base, row: fresh, cookieMalformed: true }).reason === "malformed");
check("hash mismatch (v3-future) → hash_mismatch",
  evaluateDualRead({ ...base, row: fresh, expectedTokenHash: "a", actualTokenHash: "b" }).reason === "hash_mismatch");
check("hash equal → would_match (no false mismatch)",
  evaluateDualRead({ ...base, row: fresh, expectedTokenHash: "a", actualTokenHash: "a" }).verdict === "would_match");
check("db_error → db_error",
  evaluateDualRead({ ...base, row: null, dbError: true }).reason === "db_error");

/* ── precedence: db_error > malformed > hash > row checks ───────────────── */
check("db_error precedence over revoked",
  evaluateDualRead({ ...base, row: { ...fresh, revoked_at: PAST }, dbError: true }).reason === "db_error");
check("malformed precedence over expired",
  evaluateDualRead({ ...base, row: { ...fresh, expires_at: PAST }, cookieMalformed: true }).reason === "malformed");
check("revoked precedence over expired",
  evaluateDualRead({ ...base, row: { revoked_at: PAST, expires_at: PAST, created_at: PAST } }).reason === "revoked");

/* ── legacy_valid carried even when stateful denies ─────────────────────── */
check("legacy_valid stays true on would_deny (shadow never flips legacy)",
  evaluateDualRead({ ...base, row: null }).legacy_valid === true);

/* ── never throws on junk ────────────────────────────────────────────── */
let threw = false;
try {
  const junk = { legacyValid: true, row: { revoked_at: null, expires_at: "nope", created_at: "x" }, accountStatus: null, sessionsValidAfter: "y", now: NOW } as Parameters<typeof evaluateDualRead>[0];
  const j = evaluateDualRead(junk);
  check("junk → would_deny, no throw", j.verdict === "would_deny" || j.stateful_valid === false);
} catch { threw = true; }
check("comparator did not throw on junk", threw === false);

console.log(`\nsession-validate-shadow: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
