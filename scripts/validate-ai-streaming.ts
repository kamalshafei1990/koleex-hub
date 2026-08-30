/* ---------------------------------------------------------------------------
   validate:ai-streaming — Phase 5A gate.

   The plan's §I table says the tool turn is "pseudo-streamed after full
   completion". Reading the route showed that is NOT what happens, and the
   correction matters more than the fix:

     · genuine streaming has been live since Phase 3C — the orchestrator
       passes onDelta through chatWithTools, and the provider's tokens go
       straight to the client.
     · the route's chunking loop is guarded by `liveDeltaCount > 0`, so when a
       real stream ran, NOTHING is re-chunked. There is no double reveal.
     · the loop only runs when a reply arrived as a finished string with no
       deltas: a degraded turn, a local-knowledge answer, a rescue after a
       provider failure.

   So there was no pseudo-stream to remove. What there WAS is an unbounded
   artificial delay in the fallback path — a fixed 28-char chunk and a fixed
   12 ms pause with no ceiling — sitting in front of the `end` event, so it
   delayed the turn and not just the animation.

   This suite pins the fix and, just as importantly, pins the things that were
   already right so a later change cannot quietly undo them.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  planReveal,
  REVEAL_BUDGET_MS,
  MIN_DELAY_MS,
  MIN_CHUNK_CHARS,
} from "../src/lib/server/ai/streaming/reveal";

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

const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
const stripComments = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const routeCode = stripComments(route);

/* The pre-5A constants, kept so the improvement is a MEASURED difference
   rather than a claim. If someone reverts the fix, these numbers are what the
   suite reports back at them. */
const OLD_CHUNK = 28;
const OLD_DELAY = 12;
const oldTotalDelay = (n: number) => Math.max(0, Math.ceil(n / OLD_CHUNK) - 1) * OLD_DELAY;

const LENGTHS = [1, 27, 28, 29, 120, 400, 1200, 2500, 5000, 9000, 20000, 100000];

console.log("\n── 1. The artificial delay is BOUNDED, at every length ──");
/* This is the whole point. The old rule had no ceiling, so the delay grew
   linearly with the reply — for ever. */
for (const n of LENGTHS) {
  const p = planReveal(n);
  check(
    `${String(n).padStart(6)} chars → ${String(p.chunks).padStart(4)} chunks × ${p.delayMs}ms = ${String(p.totalDelayMs).padStart(4)}ms (was ${oldTotalDelay(n)}ms)`,
    p.totalDelayMs <= REVEAL_BUDGET_MS,
  );
}
{
  /* Non-vacuity: a planner that always returned zero delay would pass every
     check above while deleting the reveal entirely. */
  const mid = planReveal(1200);
  check(
    "and it is not bounded by simply doing nothing — a normal reply still reveals gradually",
    mid.chunks > 5 && mid.delayMs >= MIN_DELAY_MS && mid.totalDelayMs > 0,
  );
}

console.log("\n── 2. What the fix actually saves ──");
{
  const long = planReveal(9000);
  const saved = oldTotalDelay(9000) - long.totalDelayMs;
  check(
    `a 9 000-char answer stops paying ${saved}ms of invented waiting (${oldTotalDelay(9000)}ms → ${long.totalDelayMs}ms)`,
    saved > 3000,
  );
  const short = planReveal(120);
  check(
    `a short reply is not made WORSE (${oldTotalDelay(120)}ms → ${short.totalDelayMs}ms)`,
    short.totalDelayMs <= oldTotalDelay(120),
  );
  /* Monotonicity: a longer reply must never reveal in fewer chunks than a
     shorter one. A planner that got this wrong would make long answers jerk. */
  let monotonic = true;
  for (let i = 1; i < LENGTHS.length; i++) {
    if (planReveal(LENGTHS[i]).chunks < planReveal(LENGTHS[i - 1]).chunks) monotonic = false;
  }
  check("a longer reply never reveals in fewer chunks than a shorter one", monotonic);

  /* THE REGRESSION THIS SUITE ALREADY CAUGHT ONCE. The first version of
     planReveal spread the budget across whatever chunks a reply happened to
     have, which made REVEAL_BUDGET_MS a TARGET instead of a CEILING: short
     replies went from 48ms to 400ms while long ones got faster. Asserted at
     EVERY length, not just the interesting ones — the bug was invisible at
     1200 chars and obvious at 120. */
  const slower = LENGTHS.filter((n) => planReveal(n).totalDelayMs > oldTotalDelay(n));
  check(
    `the budget is a CEILING, not a target — no length is made slower${slower.length ? ` (regressed at: ${slower.join(", ")})` : ""}`,
    slower.length === 0,
  );
  check(
    "and a short reply keeps exactly the pace it always had",
    planReveal(120).delayMs === 12 && planReveal(400).delayMs === 12,
  );
}

console.log("\n── 3. Degenerate inputs do not produce a hang or a divide-by-zero ──");
{
  const empty = planReveal(0);
  check("an empty reply plans no chunks and no delay", empty.chunks === 0 && empty.totalDelayMs === 0);
  check("a negative length is treated as empty rather than looping", planReveal(-5).chunks === 0);
  const one = planReveal(1);
  check("a one-character reply is one chunk with no trailing pause", one.chunks === 1 && one.totalDelayMs === 0);
  check(
    "a reply shorter than one chunk is never split",
    planReveal(MIN_CHUNK_CHARS - 1).chunks === 1,
  );
  check(
    "every plan pauses at least MIN_DELAY_MS or not at all — never 1ms frames the browser will coalesce",
    LENGTHS.every((n) => {
      const p = planReveal(n);
      return p.delayMs === 0 || p.delayMs >= MIN_DELAY_MS;
    }),
  );
  check(
    "a tiny budget still terminates and still respects the floor",
    planReveal(5000, 10).totalDelayMs <= 10 && planReveal(5000, 10).chunks >= 1,
  );
  check(
    "the chunk size never drops below the minimum, however long the reply",
    LENGTHS.every((n) => planReveal(n).chunkChars >= MIN_CHUNK_CHARS),
  );
  check(
    "every character is covered — chunks × chunkChars always reaches the end",
    LENGTHS.every((n) => planReveal(n).chunks * planReveal(n).chunkChars >= n),
  );
}

console.log("\n── 4. The things that were ALREADY right, pinned so they stay right ──");
/* These are corrections to the plan's own §I row, and they are the reason
   Phase 5A is a bounded fix rather than a rewrite. */
check(
  "genuine deltas SUPPRESS the fallback reveal entirely — no double streaming",
  /liveDeltaCount > 0 \? "" :/.test(routeCode),
);
check(
  "the counter it depends on is really incremented by the live onDelta",
  /liveDeltaCount\+\+/.test(routeCode) && /onDelta: \(text\)/.test(routeCode),
);
check(
  "a canned reply is emitted as ONE delta, never chunked — it is the < 300ms lane",
  /send\(\{ type: "delta", text: fast \}\)/.test(routeCode),
);
check(
  "the fallback reveal uses the planner rather than two inline constants",
  /planReveal\(/.test(routeCode),
);
check(
  "and the old unbounded constants are gone from the route",
  !/const CHUNK = 28/.test(routeCode) && !/setTimeout\(r, 12\)/.test(routeCode),
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Section 1 compares against the pre-5A constants, so a revert reports the numbers it costs.");
