/* ---------------------------------------------------------------------------
   validate:ai-plan-claims — the plan document, measured against the code.

   WHY THIS EXISTS. The review that produced it went looking for claims in
   KOLEEX_AI_EVOLUTION_PLAN.md that were no longer true, and found several:

     · the phase-status table said "4–20 ⬜ Not started" while the same
       document carried finished scorecards for Phases 4, 5 and 6 above it;
     · it said finding N8 was open while §P.4, forty lines further down,
       recorded it closed;
     · three §P.4 blockers were marked "owner decision, not taken" after the
       decision had been taken and shipped;
     · `orchestrator.ts` was reported at 734 lines when it was 809.

   None of those were lies when written. Every one of them was written true and
   then not revisited when the code moved. That is what makes it a testing
   problem rather than a discipline problem: a document nobody can run rots at
   exactly the speed the code changes, and the rot is invisible because each
   sentence still looks like the evidence it once was.

   WHAT IS AND IS NOT CHECKED. Only claims that are MEASURABLE — a count, a
   constant, an internal consistency between two parts of the same document.
   The plan's judgement calls ("the budget is a ceiling, never a target") are
   not checkable here and are guarded by their own suites.

   THE NUMBERS ARE READ FROM THE DOCUMENT, not restated here. If a figure is
   updated in the plan, this suite measures the NEW figure against the code —
   so it can never be satisfied by editing the suite to agree with itself.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { SKILL_CATALOG } from "../src/lib/server/ai/skills/catalog";
import { REVEAL_BUDGET_MS } from "../src/lib/server/ai/streaming/reveal";
import { DEFAULT_TOOL_TIMEOUT_MS, timeoutFor } from "../src/lib/server/ai/skills/timeout";

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

const PLAN = "docs/koleex-ai/KOLEEX_AI_EVOLUTION_PLAN.md";
const plan = readFileSync(PLAN, "utf8");

console.log("\n── 1. The tool counts the plan states are the counts the code has ──");
{
  /* §K's feature matrix and Phase 6's scorecard both quote a tool count. A
     tool added without touching either leaves two numbers that were right. */
  const tools = Object.keys(SKILL_CATALOG).length;
  /* Narrow on purpose: the first version matched any two-digit number in
     brackets and picked up `history(60)` from an ASCII flow diagram. A guard
     that reports a flow diagram as a wrong tool count teaches people to ignore
     it. Only the phrasings the document actually uses for this count. */
  const quoted = [...plan.matchAll(/(?:All (\d{2}) tools?\b|\b(\d{2}) tools already|Tools \| ✅ Current \((\d{2})\)|existing (\d{2}) tools)/g)]
    .map((m) => Number(m[1] ?? m[2] ?? m[3] ?? m[4]))
    .filter((n) => Number.isFinite(n));
  const wrong = quoted.filter((n) => n !== tools);
  check(
    `the plan quotes the tool count and it matches the catalogue (${tools})${wrong.length ? ` — plan says ${[...new Set(wrong)].join(", ")}` : ""}`,
    quoted.length > 0 && wrong.length === 0,
  );

  /* The two distributions in the Phase 6 scorecard. Read from the document,
     summed and compared field by field, because a single tool moved between
     domains leaves the total right and the row wrong. */
  for (const [kind, extract] of [
    ["domain", (v: { domain: string }) => v.domain],
    ["risk", (v: { risk: string }) => v.risk],
  ] as const) {
    const line = plan.split("\n").find((l) => l.includes("Distribution:") && l.includes(kind === "domain" ? "work " : "read_only "));
    if (!line) {
      check(`the plan states a ${kind} distribution`, false);
      continue;
    }
    /* Read only what follows "Distribution:", and stop at the sentence end.
       Parsing the whole line pulled `All 45 declared` in as `ll: 45`. */
    const tail = line.slice(line.indexOf("Distribution:") + "Distribution:".length).split(".")[0];
    const stated = new Map<string, number>();
    for (const m of tail.matchAll(/([a-z_]+) (\d+)/g)) stated.set(m[1], Number(m[2]));
    const actual = new Map<string, number>();
    for (const v of Object.values(SKILL_CATALOG)) {
      const k = extract(v as never);
      actual.set(k, (actual.get(k) ?? 0) + 1);
    }
    const diffs: string[] = [];
    for (const [k, n] of stated) if (actual.get(k) !== n) diffs.push(`${k}: plan ${n}, code ${actual.get(k) ?? 0}`);
    for (const [k, n] of actual) if (!stated.has(k)) diffs.push(`${k}: ${n} in code, absent from plan`);
    check(
      `the stated ${kind} distribution matches the catalogue${diffs.length ? ` — ${diffs.join("; ")}` : ""}`,
      stated.size > 0 && diffs.length === 0,
    );
  }
}

console.log("\n── 2. The constants the plan quotes are the constants that run ──");
{
  /* Numbers a reader would take as fact about behaviour. Each is read out of
     the prose, so changing the code and the plan together passes and changing
     only one fails. */
  const budget = /bounds the whole reveal to (\d+) ?ms/.exec(plan);
  check(
    `the reveal ceiling the plan quotes is the constant that runs (plan ${budget?.[1] ?? "—"}, code ${REVEAL_BUDGET_MS})`,
    budget !== null && Number(budget[1]) === REVEAL_BUDGET_MS,
  );

  const timeouts = /(\d+) s default, (\d+) s for the one tool that leaves our network/.exec(plan);
  check(
    `the tool timeouts the plan quotes are the ones enforced (plan ${timeouts?.[1] ?? "—"}/${timeouts?.[2] ?? "—"} s, code ${DEFAULT_TOOL_TIMEOUT_MS / 1000}/${timeoutFor("search_web") / 1000} s)`,
    timeouts !== null &&
      Number(timeouts[1]) * 1000 === DEFAULT_TOOL_TIMEOUT_MS &&
      Number(timeouts[2]) * 1000 === timeoutFor("search_web"),
  );

  const facts = /Memory \| 🟡 Partial \((\d+) facts\)/.exec(plan);
  const code = /const MAX_FACTS = (\d+);/.exec(readFileSync("src/lib/server/ai-agent/tools/user-memory.ts", "utf8"));
  check(
    `§K's memory row quotes the real cap (plan ${facts?.[1] ?? "—"}, code ${code?.[1] ?? "—"})`,
    facts !== null && code !== null && facts[1] === code[1],
  );
}

console.log("\n── 3. The document does not contradict itself ──");
{
  /* The failure that started this suite: a summary table disagreeing with the
     evidence sections above it. A phase with a written scorecard cannot also
     be listed as not started. */
  const scored = [...plan.matchAll(/^#### Phase (\d+) — delivered, scored honestly/gm)].map((m) => Number(m[1]));
  check(`the plan contains per-phase scorecards (${scored.join(", ")})`, scored.length >= 3);

  const notStarted = /^\| (\d+)(?:–|-)(\d+) \| ⬜ Not started/m.exec(plan);
  const from = notStarted ? Number(notStarted[1]) : Infinity;
  const contradicted = scored.filter((n) => n >= from);
  check(
    `no phase with a scorecard is also listed as not started${contradicted.length ? ` — Phase ${contradicted.join(", ")} is both` : ""}`,
    contradicted.length === 0,
  );

  /* A finding cannot be open in one table and closed in another. §P.4 is the
     register; the status table is a summary of it. */
  const openInSummary = [...plan.matchAll(/\*\*(N\d+) still open\*\*/g)].map((m) => m[1]);
  const closedInRegister = [...plan.matchAll(/\| (N\d+) \|[^\n]*?\| (?:✅[^|]*|closed)\s*\|/g)].map((m) => m[1]);
  const both = openInSummary.filter((n) => closedInRegister.includes(n));
  check(
    `no finding is open in one table and closed in another${both.length ? ` — ${both.join(", ")}` : ""}`,
    both.length === 0,
  );
}

console.log("\n── 4. A claim of closure has a trace in the code ──");
{
  /* §P.4 marks findings closed. A closure with nothing behind it is the worst
     kind of stale claim, because it is the one a reader acts on. Each named
     finding is tied to the artefact that closes it — not to a comment
     mentioning the finding, which prose could satisfy. */
  const CLOSURES: Array<[string, string, () => boolean]> = [
    ["N7", "the degraded prompt knows the viewer", () =>
      /viewerBlockFor/.test(readFileSync("src/lib/server/ai/prompts/index.ts", "utf8"))],
    ["N9", "a client render harness exists", () =>
      /react-dom\/server/.test(readFileSync("scripts/validate-ai-client-render.tsx", "utf8"))],
    ["N10", "the kill-switch has exactly one reader", () => {
      const readers = execSync(
        `grep -rl 'process.env.USE_DEEPSEEK' src/ --include=*.ts || true`,
        { encoding: "utf8" },
      ).split("\n").filter(Boolean);
      return readers.length === 1 && readers[0].endsWith("router/provider-policy.ts");
    }],
    ["N11", "the vendor label is stripped on the way out", () =>
      /PASSTHROUGH_LANES/.test(readFileSync("src/lib/server/ai/observability/public-provider.ts", "utf8"))],
    ["N12", "the atomic merge is the primary write path", () =>
      /rpc\("account_prefs_merge"/.test(readFileSync("src/lib/server/ai/security/account-prefs.ts", "utf8"))],
  ];
  for (const [id, what, holds] of CLOSURES) {
    /* Only assert on findings the document actually claims are closed — the
       register is the source of truth for what to check, so a finding
       re-opened in the plan stops being asserted here automatically. */
    const row = plan.split("\n").find((l) => l.startsWith(`| **${id}**`) || l.startsWith(`| ${id} |`));
    if (!row) continue;
    const claimsClosed = /closed|CLOSED|RESOLVED|FIXED/.test(row);
    if (!claimsClosed) continue;
    check(`${id} is claimed closed and ${what}`, holds());
  }
}

console.log("\n── 5. Figures that describe a moment say so ──");
{
  /* Line counts are results of a refactor, not properties of the code — they
     drift the day anything is added. The plan may quote them, but a bare
     "orchestrator.ts is N lines" reads as current and will be wrong within a
     phase. Any such figure must be qualified. */
  const actual = Number(execSync("wc -l < src/lib/server/ai-agent/orchestrator.ts", { encoding: "utf8" }).trim());
  /* §A carries its own date in its heading — "Current state (verified …)" —
     so its figures are a snapshot by construction and are not measured here.
     Everything after it is prose a reader takes as current. */
  const afterSnapshot = plan.slice(plan.indexOf("# B. Architecture delta"));
  const bare = afterSnapshot
    .split("\n")
    .filter((l) => /orchestrator\.ts.{0,40}\b(\d{3,4})\s*(?:lines|L)\b/.test(l))
    .filter((l) => !/→|ended sub-stage|at the end of|today/i.test(l));
  check(
    `no unqualified line-count claim (orchestrator.ts is ${actual} lines today)${bare.length ? ` — ${bare.length} bare claim(s)` : ""}`,
    bare.length === 0,
  );

  /* A line count carrying a DATE is a historical claim and stays true; one
     carrying "today" is a claim about the present and is wrong the moment
     anything is added. Requiring the latter to stay current was tried and
     rejected: it fails on two lines added to one file, which is friction
     with no matching payoff — nobody learns anything from that failure.
     So the rule is that the figure must be dated, not that it must be fresh. */
  const undatedPresent = afterSnapshot
    .split("\n")
    .filter((l) => /orchestrator\.ts|KoleexAiApp\.tsx/.test(l))
    .filter((l) => /\b\d{3,4}\b\s*(?:lines|L)\b/.test(l))
    /* A `before → after` figure is a refactor result, dated by the sub-stage
       it is written in; the word "now" in such a line describes the code's
       shape, not the number. Flagging those reports prose as a stale figure. */
    .filter((l) => !/→/.test(l))
    .filter((l) => /\b(today|now|currently)\b/i.test(l))
    .filter((l) => !/as of \d{4}-\d{2}-\d{2}/.test(l));
  check(
    `every "today" line count carries a date instead${undatedPresent.length ? ` — ${undatedPresent.length} without one` : ""}`,
    undatedPresent.length === 0,
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("The plan's checkable claims agree with the code. Its judgement calls are guarded by their own suites.");
