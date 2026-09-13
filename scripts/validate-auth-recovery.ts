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

async function main() {
  /* ── Section 4: advice the user cannot act on is the loop, one level up ────
     The lockout was a screen offering only an action that could not work. The
     same shape existed in the message itself: four different server-side
     failures reached the user as "Session expired — please sign in again",
     including a failed database read (signing in again cannot repair that) and
     a deactivated account (signing in again will never work; an administrator
     must act).

     These assertions run the REAL response builder rather than reading source,
     because status codes and payload keys are behaviour. */
  {
    console.log("\nSection 4 — a failure the user cannot fix must not advise signing in");

    const R = await import("../src/lib/server/auth");
    const build = R.authFailureResponse as (r: string) => Response;

    const backend = build("backend_unavailable");
    const inactive = build("inactive");
    const anon = build("anon");
    const noAccount = build("no_account");

    const body = async (r: Response) => (await r.json()) as { error?: string; code?: string };
    const [bBody, iBody, aBody, nBody] = await Promise.all([body(backend), body(inactive), body(anon), body(noAccount)]);

    /* THE CENTRAL ONE. A lookup that failed is not an authentication failure,
       and 401 told every client to discard the session and offer a sign-in that
       could not help. 503 is both true and retryable. */
    check("a failed lookup is 503, not 401", backend.status === 503);
    check("and never tells the user to sign in again", !/sign in/i.test(bBody.error ?? ""));

    check("a deactivated account is still 401", inactive.status === 401);
    check("but points at an administrator, not at the sign-in page",
      /administrator/i.test(iBody.error ?? "") && !/sign in again/i.test(iBody.error ?? ""));

    /* Deliberately indistinguishable. Telling an unauthenticated caller apart
       from "no such account" answers a question they have not earned. */
    check("anon and no_account are byte-identical to the caller",
      anon.status === noAccount.status && JSON.stringify(aBody) === JSON.stringify(nBody));
    check("and both keep the wording clients already read", aBody.error === "Not signed in");

    check("every failure carries a machine-readable code",
      [bBody, iBody, aBody].every((b) => typeof b.code === "string" && b.code.length > 0));

    /* No account state may cross to a caller who has not proved they are that
       account — the inactive branch is only reachable with a valid signed
       cookie, and nothing else may name an account at all. */
    check("no reason leaks an identifier", [bBody, iBody, aBody, nBody].every(
      (b) => !/@/.test(b.error ?? "") && !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(b.error ?? "")));

    /* And the client has to actually branch on it, or the server's honesty
       stops at the wire. */
    const boot = readFileSync("src/lib/me-bootstrap.ts", "utf8");
    check("the client reads the code rather than assuming every 401 is expiry",
      /account_inactive/.test(boot) && /Contact an administrator/.test(boot));
    check("and still falls back to the old message when no code is sent",
      /Session expired — please sign in again\./.test(boot));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("A user whose session is refused can recover from inside the product.");

}

main().catch((e) => { console.error(e); process.exit(1); });
