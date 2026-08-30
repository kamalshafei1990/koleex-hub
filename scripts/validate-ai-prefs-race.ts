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

   WHAT THIS SUITE DOES, AND DOES NOT. It does not fix the race — the fix is an
   atomic merge (a small RPC doing one `preferences || patch` statement, or a
   dedicated table), which is a schema change and belongs to a decision, not to
   a test. What it does is CONTAIN it: the writer count is pinned, so a fourth
   read-modify-write path cannot be added without this failing and someone
   reading the above.

   The same posture as finding N8 before Phase 4D: assert the count so the
   situation cannot quietly get worse while it waits for its decision.
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

/* The three known writers, named individually. A path list rather than a glob
   so a NEW writer in a new file is not silently absorbed into the count. */
const KNOWN_WRITERS = [
  "src/lib/server/ai-agent/tools/user-memory.ts",
  "src/lib/server/ai/reply-language.ts",
  "src/app/api/accounts/[id]/preferences/route.ts",
] as const;

console.log("\n── 1. The defect is still exactly where it was recorded ──");
{
  /* Non-vacuity first: if these files stop containing the pattern, the count
     check below would pass for the wrong reason. */
  const stillReadModifyWrite = KNOWN_WRITERS.filter((f) => {
    const code = strip(readFileSync(f, "utf8"));
    return /\.select\("preferences"\)/.test(code) && /update\(\{\s*preferences/.test(code);
  });
  check(
    `all three known writers still read-modify-write the column (${stillReadModifyWrite.length}/3)` +
      (stillReadModifyWrite.length === 3 ? "" : " — if this dropped, N12 may be FIXED; re-read the header before editing this suite"),
    stillReadModifyWrite.length === 3,
  );

  check(
    "the language write is still un-awaited, which is what makes the race reachable in one turn",
    /void setReplyLanguage\(/.test(strip(readFileSync("src/app/api/ai/agent/route.ts", "utf8"))),
  );
}

console.log("\n── 2. No FOURTH writer may be added while this is open ──");
{
  /* Sweep the whole server tree. A new path writing this column the same way
     widens a known race, and must be a deliberate decision rather than a
     side effect of some unrelated feature. */
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const hits = execSync(
    `grep -rl 'update({ *preferences\\|update({preferences' src/ --include=*.ts --include=*.tsx || true`,
    { encoding: "utf8" },
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const unexpected = hits.filter((f) => !(KNOWN_WRITERS as ReadonlyArray<string>).includes(f));
  check(
    `exactly the three known writers touch accounts.preferences${unexpected.length ? ` — NEW WRITER: ${unexpected.join(", ")}` : ""}`,
    unexpected.length === 0,
  );
  check(
    `and the sweep really found them (${hits.length} files), so the check above is not passing on an empty search`,
    hits.length >= 2,
  );
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
console.log("N12 is CONTAINED, not fixed. The fix is an atomic merge and needs a schema decision.");
