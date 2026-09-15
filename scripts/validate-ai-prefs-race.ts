/* ---------------------------------------------------------------------------
   validate:ai-prefs-race — finding N12, contained.

   THE DEFECT. Three code paths write `accounts.preferences`, and all three do
   it as READ-MODIFY-WRITE on the whole JSONB column:

     · ai-agent/tools/user-memory.ts  remember_about_user / forget_about_user
     · ai/reply-language.ts            setReplyLanguage
     · api/accounts/[id]/preferences   the user changing their own settings

   Each reads the column, spreads it, sets one key, and writes the column back.
   Any write landing in the gap between another's read and its write is
   silently discarded.

   IT IS NOT THEORETICAL, and this is what makes it worth a suite rather than a
   comment. The language write is FIRE-AND-FORGET — `void setReplyLanguage(...)`
   in the agent route, deliberately un-awaited so the preference write "must
   never delay the reply". It therefore runs CONCURRENTLY with the entire turn,
   including any remember_about_user the same turn invokes.

   One message is enough to trigger it:

       "reply to me in Arabic, and remember my birthday is 3 May"

     1. the route fires setReplyLanguage(ar) without awaiting  → reads prefs
     2. the tool loop runs remember_about_user                 → reads THE SAME
                                                                  prefs, which
                                                                  do not yet
                                                                  contain the
                                                                  language
     3. setReplyLanguage writes  { …, ai_reply_language: "ar" }
     4. remember_about_user writes { …original prefs…, ai_memory: {…} }
        → the language lock is erased

   The user asked for two things and one vanishes with no error. It presents as
   "the assistant went back to English", which reads like a prompt problem and
   is not one.

   PHASE 7 — TWO OF THE THREE ARE FIXED, and this suite changed with them.

   `remember_about_user`, `forget_about_user` and `setReplyLanguage` all write
   through `account_prefs_merge`, one SQL statement with no read-then-write
   gap. Those were the two sides of the reachable-in-one-message case, so the
   scenario in the header can no longer happen.

   AND THE FUNCTION IS DEPLOYED — staging 2026-08-30, production 2026-08-31.
   Until then the fix was only half real: the code took the RPC path where it
   existed and the old racy path everywhere else. It no longer does on either
   deployed environment.

   THE THIRD WRITER IS DELIBERATELY UNCHANGED. `api/accounts/[id]/preferences`
   scopes its write with `.eq("tenant_id", auth.tenant_id)` — it takes an
   account id from the URL, and that clause is what stops a caller reaching
   another tenant's row. The RPC takes only an account id, so routing this path
   through it would REMOVE a tenant check to fix a race. Weakening verification
   to fix a concurrency bug is the wrong trade, and the standing rules forbid
   it outright. Closing this one properly means giving the function a tenant
   parameter, which is another migration.

   So the residual exposure, stated plainly rather than implied away: a Settings
   save landing inside an AI turn can still overwrite a fact. It is far less
   reachable than what was fixed — it needs a human clicking Save at the same
   moment — and it is now the ONLY remaining path, where before it was one of
   three that could clobber each other.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

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

/* The three known writers, named individually. A path list rather than a glob
   so a NEW writer in a new file is not silently absorbed into the count. */
/* THE SETTINGS ROUTE'S EXEMPTION IS WITHDRAWN, and the reason it was granted
   is worth keeping because it was a real constraint, not an oversight:

       "its exemption holds because it scopes the write by tenant,
        which the RPC cannot"

   True at the time. account_prefs_merge(uuid, jsonb) takes an account id and
   no tenant, so swapping the UPDATE for the RPC would have dropped
   `.eq("tenant_id", auth.tenant_id)` and silently widened what a super-admin
   could write to. Losing a boundary to close a race is not a trade worth
   making, so the race stayed.

   What changed is that the choice was false. The tenant clause did not have to
   live in the same statement as the merge — a super-admin editing someone
   else's account can be checked against the tenant BEFORE the write, and a
   self-edit needs no check at all because the id IS the session's account. The
   route now does that and calls the RPC, so it has the boundary AND the atomic
   write. Both properties are asserted below; neither is assumed.

   Why it mattered enough to revisit: the migration named three writers, two
   were converted, and this one silently discarded facts a user had asked the
   assistant to remember whenever they also had a Settings tab open. */
const REMAINING_DIRECT_WRITERS = [
  /* account-prefs.ts contains the OLD pattern on purpose, as the bridge for
     environments where the function is not deployed yet. The suite flagged it
     on the first run, which is the check working: it is exempt only while the
     RPC is the primary path, and section 1 asserts exactly that. */
  "src/lib/server/ai/security/account-prefs.ts",
] as const;

console.log("\n── 1. The two AI writers go through the atomic merge ──");
{
  const memory = strip(readFileSync("src/lib/server/ai-agent/tools/user-memory.ts", "utf8"));
  const language = strip(readFileSync("src/lib/server/ai/reply-language.ts", "utf8"));

  check("remember/forget write through mergeAccountPrefs", /mergeAccountPrefs\(/.test(memory));
  check("setReplyLanguage writes through mergeAccountPrefs", /mergeAccountPrefs\(/.test(language));
  check(
    "and NEITHER writes the preferences column directly any more",
    !/update\(\{\s*preferences/.test(memory) && !/update\(\{\s*preferences/.test(language),
  );
  /* The scenario from the header, gone: the un-awaited language write can
     still run concurrently — that is a latency decision, not a bug — but it no
     longer carries the whole document with it. */
  check(
    "the language write is still un-awaited, and that is now SAFE rather than the bug",
    /void setReplyLanguage\(/.test(strip(readFileSync("src/app/api/ai/agent/route.ts", "utf8"))),
  );

  const merge = strip(readFileSync("src/lib/server/ai/security/account-prefs.ts", "utf8"));
  check("the merge calls the RPC, not a read-then-write", /rpc\("account_prefs_merge"/.test(merge));
  /* The fallback is the OLD bug, kept as a bridge until the function is in
     production. It must announce itself — a silent fallback is the race
     returning with nobody noticing. */
  check("a missing function falls back rather than throwing", /legacyReadModifyWrite/.test(merge));
  check("and the fallback logs loudly, so a missing migration is visible", /NOT DEPLOYED/.test(readFileSync("src/lib/server/ai/security/account-prefs.ts", "utf8")));
  check(
    "a REAL rpc error does not silently fall back to the racy path",
    /if \(!missing\)/.test(merge),
  );
}

console.log("\n── 2. No NEW direct writer may be added ──");
{
  /* Sweep the whole server tree. A new path writing this column the same way
     widens a known race, and must be a deliberate decision rather than a
     side effect of some unrelated feature. */
  const hits = execSync(
    `grep -rl 'update({ *preferences\\|update({preferences' src/ --include=*.ts --include=*.tsx || true`,
    { encoding: "utf8" },
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const unexpected = hits.filter((f) => !(REMAINING_DIRECT_WRITERS as ReadonlyArray<string>).includes(f));
  check(
    `only the one exempt file writes the column directly${unexpected.length ? ` — NEW WRITER: ${unexpected.join(", ")}` : ""}`,
    unexpected.length === 0,
  );
  check(
    `and the sweep really found it (${hits.length} file), so this is not passing on an empty search`,
    hits.length === 1,
  );
  /* The bridge is exempt only while it IS a bridge. If the RPC call were ever
     removed from that file, the exemption would be covering the bug itself. */
  {
    const bridge = strip(readFileSync("src/lib/server/ai/security/account-prefs.ts", "utf8"));
    const rpcIdx = bridge.indexOf('rpc("account_prefs_merge"');
    const legacyIdx = bridge.indexOf("async function legacyReadModifyWrite");
    check(
      "the bridge file's exemption holds: the RPC is the PRIMARY path and the old pattern is below it",
      rpcIdx !== -1 && legacyIdx !== -1 && rpcIdx < legacyIdx,
    );
  }
  /* THE SETTINGS ROUTE, NOW CONVERTED. Two properties, because the whole point
     is that it kept the one the old exemption was protecting while gaining the
     one the exemption cost. Checking only the first would let a future edit
     drop the tenant guard and still pass. */
  {
    const settings = strip(readFileSync("src/app/api/accounts/[id]/preferences/route.ts", "utf8"));
    check(
      "the settings route merges through the RPC rather than read-modify-write",
      /mergeAccountPrefs\(/.test(settings) && !/update\(\{ *preferences/.test(settings),
    );
    /* The boundary moved out of the UPDATE and must still exist. It is only
       needed when a super-admin edits someone else — a self-edit's id IS the
       session's account. */
    check(
      "and still refuses a cross-tenant write, which is what its old exemption bought",
      /!editingSelf/.test(settings) &&
        /target\.tenant_id !== auth\.tenant_id/.test(settings),
    );
    check(
      "a target outside the tenant is reported, not answered with a false ok",
      /status: 404/.test(settings),
    );
  }
}

console.log("\n── 3. The memory cap still behaves, whatever the storage ──");
{
  /* Independent of the race: the 25-fact cap drops OLDEST-first, which relies
     on JSON insertion order. Worth pinning because a move to a table would
     change how "oldest" is determined, and silently keeping the wrong 25 is
     a data-loss bug that looks like nothing. */
  const mem = strip(readFileSync("src/lib/server/ai-agent/tools/user-memory.ts", "utf8"));
  check("the fact store is capped", /MAX_FACTS/.test(mem));
  check("the cap drops the OLDEST keys, not the newest", /keys\.slice\(0, keys\.length - MAX_FACTS\)/.test(mem));
  check(
    "memory writes are refused while viewing as another user",
    /viewing_as/.test(mem),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("N12: all three writers named in the migration now merge atomically. Only the bridge writes directly, and only while it is a bridge.");
