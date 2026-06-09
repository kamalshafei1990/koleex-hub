#!/usr/bin/env tsx

/* ===========================================================================
   Phase 1 — password-state derivation validator (pure, no DB, no secrets).

   Proves derivePasswordState():
     · null password           → NO_PASSWORD (has_password false)
     · argon2id password        → ACTIVE
     · tmp$ legacy password     → TEMPORARY
     · password_algo 'legacy'   → TEMPORARY
     · force_password_change    → RESET_REQUIRED (precedence over temporary)
     · auth_user_id present     → EXTERNAL_PROVIDER
   And confirms the helper NEVER echoes a hash (returns only the enum + bool).
   ========================================================================== */

import { derivePasswordState } from "../src/lib/server/password-state";

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}

const ARGON = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aGFzaGhhc2hoYXNo";

eq("null hash → NO_PASSWORD", derivePasswordState({ password_hash: null }).password_state, "NO_PASSWORD");
eq("null hash → has_password false", derivePasswordState({ password_hash: null }).has_password, false);
eq("undefined hash → NO_PASSWORD", derivePasswordState({}).password_state, "NO_PASSWORD");

eq("argon2id → ACTIVE", derivePasswordState({ password_hash: ARGON, password_algo: "argon2id" }).password_state, "ACTIVE");
eq("argon2id → has_password true", derivePasswordState({ password_hash: ARGON }).has_password, true);

eq("tmp$ prefix → TEMPORARY", derivePasswordState({ password_hash: "tmp$Zm9vYmFy" }).password_state, "TEMPORARY");
eq("algo 'legacy' → TEMPORARY", derivePasswordState({ password_hash: "whatever", password_algo: "legacy" }).password_state, "TEMPORARY");

eq("force_password_change → RESET_REQUIRED", derivePasswordState({ password_hash: ARGON, force_password_change: true }).password_state, "RESET_REQUIRED");
eq("force change beats temporary", derivePasswordState({ password_hash: "tmp$x", force_password_change: true }).password_state, "RESET_REQUIRED");

eq("auth_user_id → EXTERNAL_PROVIDER", derivePasswordState({ auth_user_id: "u-1", password_hash: ARGON }).password_state, "EXTERNAL_PROVIDER");
eq("auth_user_id beats no-password", derivePasswordState({ auth_user_id: "u-1", password_hash: null }).password_state, "EXTERNAL_PROVIDER");

// Security: the result object must contain ONLY the enum + has_password — never a hash.
const view = derivePasswordState({ password_hash: ARGON, password_algo: "argon2id" });
const keys = Object.keys(view).sort().join(",");
eq("result keys are exactly {has_password,password_state}", keys, "has_password,password_state");
eq("result never contains 'password_hash'", JSON.stringify(view).includes("argon2"), false);

console.log(`\npassword-state: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
