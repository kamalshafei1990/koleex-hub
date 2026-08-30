/* ---------------------------------------------------------------------------
   validate:auth-recovery — can a user with a REJECTED session get back in?

   THE INCIDENT THIS EXISTS FOR. The owner was locked out of the Hub and could
   not recover from inside the product. Production logs for a three-hour
   window: 560 responses of 401 across every API route, and ZERO requests to
   /api/auth/signin. The recovery button was pressed repeatedly and never once
   attempted a sign-in.

   THE MECHANISM. A session cookie can be present and still be refused — the
   signing secret changed, the account was deactivated, the row is gone. When
   that happens:

     · the cookie is still in the browser
     · the root page renders the sign-in form ONLY when no cookie is present
     · so the page renders the Hub, every API call 401s, the banner appears
     · the banner's button reloaded the same page  ← the loop
     · reload → cookie still there → Hub again → 401 again

   Nothing inside the product could break that cycle. Recovery required
   clearing site data through browser settings, which is not a thing a user
   should have to know, and is certainly not a thing to discover during an
   outage.

   WHY A SUITE RATHER THAN JUST THE FIX. The fix is one call, and one call is
   exactly what gets dropped by a future refactor that "simplifies" a button
   back into a link. The property — recovery must destroy the credential, not
   just re-render — is what these assertions hold.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("\n── 1. The recovery button destroys the credential ──");
{
  const page = strip(readFileSync("src/app/page.tsx", "utf8"));

  /* The banner shown on a 401 is the only recovery path a locked-out user
     has. Locate it by the flag the page itself uses. */
  const idx = page.indexOf("isAuth ?");
  check("the 401 branch of the error banner still exists", idx !== -1);

  /* The window is generous on purpose: the assertion is about what the
     branch DOES, not about how it is formatted. */
  const branch = page.slice(idx, idx + 1600);

  check(
    "it calls the signout endpoint — a reload alone leaves the rejected cookie in place",
    /\/api\/auth\/signout/.test(branch),
  );
  check("and does so as a POST, which is what that route accepts", /method:\s*"POST"/.test(branch));
  check(
    "it then forces a FULL load — a soft navigation carries back the state being discarded",
    /window\.location\.(assign|replace|href)/.test(branch),
  );
  /* The regression this replaces: a bare link that reloads and nothing else. */
  check(
    "it is NOT a bare link to the root — that was the closed loop",
    !/<a\s[^>]*href="\/"/.test(branch),
  );
  /* A cleanup that strands the user when it fails is worse than the bug. */
  check(
    "a failed signout still reloads — recovery must not depend on the network",
    /catch\s*\{/.test(branch) && branch.indexOf("catch") < branch.indexOf("window.location"),
  );
}

console.log("\n── 2. The endpoint it relies on does what the button assumes ──");
{
  const signout = strip(readFileSync("src/app/api/auth/signout/route.ts", "utf8"));
  check("POST /api/auth/signout exists", /export async function POST/.test(signout));
  check("it clears the session cookie", /clearSessionCookie\(/.test(signout));
  /* A stale view-as cookie surviving a sign-out would present the previous
     target account to whoever signs in next on the same browser. */
  check("and the view-as cookie too", /clearViewAsCookie\(/.test(signout));
  check(
    "it requires no auth — the whole point is that the caller's session is broken",
    !/requireAuth|requireInternalUser|is_super_admin/.test(signout),
  );
}

console.log("\n── 3. The client cache is dropped on a 401, not just the cookie ──");
{
  /* The cookie is one half. A persisted bootstrap payload is the other: it is
     what makes the shell render a signed-in Hub for a session the server has
     already refused. */
  const boot = strip(readFileSync("src/lib/me-bootstrap.ts", "utf8"));
  /* Anchor on the BRANCH, not on the first mention of the number. The first
     version matched the message ternary a few lines above and measured a
     window that stopped short of the early return — reporting a defect in
     code that was correct. Fixing the assertion was the right move; relaxing
     it to match what the short window could see would have been the wrong
     one. */
  const idx = boot.indexOf("if (res.status === 401) {");
  check("the 401 branch is handled explicitly", idx !== -1);
  const near = boot.slice(idx, idx + 400);
  check("it clears the in-memory cache", /cache = null/.test(near));
  check("and the persisted copy — otherwise a reload restores the illusion", /clearPersisted\(\)/.test(near));
  check("and does not retry, since a 401 will not fix itself", /return null/.test(near));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("A user whose session is refused can recover from inside the product.");
