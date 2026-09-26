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
import { stripComments } from "./lib/strip-comments";

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
      nobody cleared, and the lockout is back.

      The gate's constants live in src/components/admin/session-keys.ts since
      d911bb7a (AdminAuth and AdminAuthGate import them from there), so that
      is the file session-hints must agree with. Comments stripped, and each
      name must be declared exactly once per file, so a value quoted in a
      comment or a second declaration cannot satisfy it. */
const keys = stripComments(read("src/components/admin/session-keys.ts"));
const hintsCode = stripComments(hints);
const declared = (src: string, label: string, exported: boolean) => {
  const all = src.match(new RegExp(`\\b(const|let|var)\\s+${label}\\b`, "g")) ?? [];
  const m = new RegExp(`^${exported ? "export " : ""}const ${label} = "([^"]*)";$`, "m").exec(src);
  return all.length === 1 ? m?.[1] : undefined;
};
for (const [label, key] of [
  ["LEGACY_SESSION_KEY", "koleex-admin"],
  ["LEGACY_SESSION_USER_KEY", "koleex-admin-user"],
] as const) {
  const inKeys = declared(keys, label, true);
  const inHints = declared(hintsCode, label, false);
  check(
    `${label} is "${key}" in both session-keys (the gate's) and session-hints`,
    inKeys === key && inHints === key,
  );
}

/* 1b. …and the gate really reads them from session-keys: both AdminAuth (the
       sign-in screen, which writes both keys) and AdminAuthGate (the
       signed-in path, which reads LEGACY_SESSION_KEY) import them from
       "./session-keys" and keep no copy of their own. */
const gateCode = stripComments(gate);
const gateLite = stripComments(read("src/components/admin/AdminAuthGate.tsx"));
const importsKeys = (src: string, names: string[]) => {
  const imp = /^import \{([^}]*)\} from "\.\/session-keys";$/m.exec(src)?.[1] ?? "";
  return names.every((n) => new RegExp(`\\b${n}\\b`).test(imp) &&
    !new RegExp(`\\b(const|let|var)\\s+${n}\\b`).test(src));
};
check(
  "AdminAuth and AdminAuthGate import the keys from ./session-keys, with no copy of their own",
  importsKeys(gateCode, ["LEGACY_SESSION_KEY", "LEGACY_SESSION_USER_KEY"]) &&
    importsKeys(gateLite, ["LEGACY_SESSION_KEY"]),
);

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
