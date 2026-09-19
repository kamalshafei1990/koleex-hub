#!/usr/bin/env tsx

/* ===========================================================================
   validate:session-hints — the client half of a session must stay wired to
   the server's 401, and to the gate that reads it.

   Background (13 Sep 2026): the Hub decides "Hub or sign-in form" from
   localStorage["koleex-admin"], which never expires, while the session it
   stands for is a cookie that does. When they diverged, a device painted the
   Hub, every API answered 401, and the sign-in form could not be reached
   from inside the product. The cure is that a bootstrap 401 clears the
   client hints and the gate listens for it.

   Every assertion below guards one link in that chain. They are text
   assertions on purpose: the failure mode is a silent edit — a renamed key,
   a deleted listener — not a type error.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const hints = read("src/lib/session-hints.ts");
const gate = read("src/components/admin/AdminAuth.tsx");
const boot = read("src/lib/me-bootstrap.ts");
const menu = read("src/components/layout/UserMenu.tsx");

console.log("session-hints");

/* 1. The duplicated key names still match the gate's own constants. A drift
      here is invisible: clearing succeeds, the gate keeps reading the key
      nobody cleared, and the lockout is back. */
for (const [label, key] of [
  ["LEGACY_SESSION_KEY", "koleex-admin"],
  ["LEGACY_SESSION_USER_KEY", "koleex-admin-user"],
] as const) {
  check(
    `${label} is "${key}" in both AdminAuth and session-hints`,
    gate.includes(`${label} = "${key}"`) && hints.includes(`${label} = "${key}"`),
  );
}

/* 2. The bootstrap 401 must reach the hints — and must NOT fire for a
      deactivated account, where signing in again can never succeed. */
check("bootstrap 401 clears the client hints", boot.includes("dropClientSessionHints"));
check(
  "account_inactive is exempt (re-signing in cannot fix it)",
  /account_inactive[\s\S]{0,200}dropClientSessionHints/.test(boot),
);

/* 2b. …and the route must be able to TELL them apart. getServerAuth()
       collapses "no session" and "our database just failed" into the same
       null; if the bootstrap route ever goes back to that, a Supabase blip
       signs every open device out. */
const bootRoute = read("src/app/api/me/bootstrap/route.ts");
check(
  "bootstrap route reads the auth OUTCOME, not the collapsed boolean",
  bootRoute.includes("getServerAuthOutcome") && !/await getServerAuth\(\)/.test(bootRoute),
);
check(
  "bootstrap route answers through authFailureResponse (503 stays 503)",
  bootRoute.includes("authFailureResponse"),
);

/* 3. The gate listens, or nothing the 401 did is visible. */
check("AdminAuth subscribes to SESSION_INVALID_EVENT", gate.includes("SESSION_INVALID_EVENT"));
check("AdminAuth also reacts to the key changing in another tab", gate.includes('e.key === LEGACY_SESSION_KEY'));

/* 4. Sign out revokes the cookie, not just the client's memory of it. */
check("UserMenu sign-out posts /api/auth/signout", menu.includes('"/api/auth/signout"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
