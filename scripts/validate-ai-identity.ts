/* ---------------------------------------------------------------------------
   validate:ai-identity — every conversational prompt carries the identity rule.

   WHY THIS SUITE EXISTS. Asked "who are you", the VOICE session answered with
   another company's name — spoken aloud to a user. The cause was not a subtle
   one: that path simply had no instructions, and nothing anywhere said it had
   to. Auditing afterwards found a SECOND path in the same state, an HTTP
   endpoint building its own system prompt with no identity text at all.

   Two paths forgetting the same absolute rule is not two mistakes; it is a
   missing check. Adding the rule to both fixes today. This fixes tomorrow: a
   new prompt that talks to a user and omits the rule fails here, in the file
   where it was written, before anyone has to hear the model introduce itself.

   WHAT COUNTS AS CONVERSATIONAL. A prompt whose output a user reads or hears
   as the assistant speaking. NOT every prompt: a title generator, a translator
   and a catalogue extractor produce a fragment, not a voice, and telling a
   translator who it is would put stray text in the translation. Those are
   listed explicitly, with the reason — an allow-list nobody can grow by
   accident is worth more than a rule with silent exceptions.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AI_PROVENANCE_RULE } from "../src/lib/server/ai/prompt-builder";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok: boolean;
  try {
    ok = typeof cond === "function" ? cond() : cond;
  } catch (e) {
    ok = false;
    label = `${label} — threw: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}

/* Prompts that are NOT the assistant speaking. Each carries its reason, so a
   future addition has to argue for itself rather than just appear. */
const NOT_CONVERSATIONAL: Record<string, string> = {
  "src/app/api/translator/route.ts":
    "a translator returns only the translation — identity text would land inside it",
  "src/app/api/ai/product-copy/route.ts":
    "generates product copy, not a reply to a person",
  "src/lib/server/catalog-extract.ts":
    "extracts structured fields from a catalogue file",
  "src/lib/server/ai/core/recovery.ts":
    "takes the system prompt from its caller rather than writing one",
  "src/lib/server/ai/provider/turn-ir.ts":
    "reshapes messages between provider formats; composes no prompt",
  "src/lib/server/ai/providers/groq.ts":
    "a transport adapter; composes no prompt",
  "src/lib/server/ai/types.ts":
    "type declarations only",
  "src/lib/server/ai-provider.ts":
    "provider plumbing; composes no prompt",
  "src/lib/server/ai/router.ts":
    "routes to the shared builders rather than writing a prompt",
};

/* Walk the server and route trees rather than a hand-written list: a file that
   is never listed is a file this suite cannot protect, and the whole point is
   to catch the path nobody remembered. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk("src/lib/server"), ...walk("src/app/api")];

console.log("\n── 1. The rule itself ──");
{
  check("the rule exists and is exported", AI_PROVENANCE_RULE.length > 0);
  check("it names Koleex AI and Koleex International Group",
    /Koleex AI/.test(AI_PROVENANCE_RULE) && /Koleex International Group/.test(AI_PROVENANCE_RULE));
  check("it forbids naming any underlying model, provider or API",
    /NEVER name, hint at, confirm/.test(AI_PROVENANCE_RULE));
  check("it closes the indirect routes too",
    /joke/.test(AI_PROVENANCE_RULE) && /roleplay/.test(AI_PROVENANCE_RULE) &&
    /translation/.test(AI_PROVENANCE_RULE) && /hypothetical/.test(AI_PROVENANCE_RULE));
  check("it forbids confirming a name the user guesses",
    /user guesses a name and asks you to confirm/.test(AI_PROVENANCE_RULE));
  check("it forbids repeating a name that appears in tool output",
    /Never repeat a model or provider name/.test(AI_PROVENANCE_RULE));
}

console.log("\n── 2. Every conversational prompt carries it ──");
{
  /* A file "writes a system prompt" when it puts a literal into a system
     message. Reading the source rather than the built prompt is deliberate:
     the built prompt needs the whole app running, and this must fail in the
     file where the omission was written. */
  const writesSystemPrompt = (src: string) =>
    /role:\s*"system"/.test(src) && /systemPrompt\s*=\s*`|content:\s*`You are|content:\s*"You are/.test(src);

  const offenders: string[] = [];
  const covered: string[] = [];
  for (const file of files) {
    const rel = file.replace(/\\/g, "/");
    if (rel in NOT_CONVERSATIONAL) continue;
    const src = readFileSync(file, "utf8");
    if (!writesSystemPrompt(src)) continue;
    if (/AI_PROVENANCE_RULE/.test(src)) covered.push(rel);
    else offenders.push(rel);
  }

  /* Reported by NAME, because "one file is missing the rule" is not something
     anyone can act on at 2am. */
  check(
    offenders.length === 0
      ? "no conversational prompt is missing the identity rule"
      : `these prompts are missing the identity rule: ${offenders.join(", ")}`,
    offenders.length === 0,
  );

  /* The suite must actually be looking at something. A refactor that renamed
     `systemPrompt` would otherwise leave this passing over an empty set. */
  check("and the scan found conversational prompts to check", covered.length >= 2);
}

console.log("\n── 3. The paths that burned us, by name ──");
{
  /* Named individually, so a future refactor that drops the rule from one of
     these fails with the file that regressed rather than a count. */
  const voice = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
  check("the VOICE session carries it — this is the one that spoke a vendor's name",
    /AI_PROVENANCE_RULE/.test(voice) && /instructions:/.test(voice));

  const messages = readFileSync("src/app/api/ai/conversations/[id]/messages/route.ts", "utf8");
  check("the conversations endpoint carries it — found with none at all",
    /AI_PROVENANCE_RULE/.test(messages));

  /* And it must be IMPORTED rather than restated: two copies drift, and the
     copy that drifts is the one nobody is reading. */
  for (const [label, src] of [["voice", voice], ["conversations", messages]] as const) {
    check(`${label} imports the rule rather than re-typing it`,
      /import \{ AI_PROVENANCE_RULE \}/.test(src));
  }
}

console.log("\n── 4. The exceptions are deliberate, not accidental ──");
{
  /* An allow-list that names files which no longer exist is an allow-list
     nobody is maintaining — and the next real offender could be added to it
     without anyone noticing. */
  const stale = Object.keys(NOT_CONVERSATIONAL).filter((f) => {
    try { statSync(f); return false; } catch { return true; }
  });
  check(
    stale.length === 0 ? "every exception names a file that exists" : `stale exceptions: ${stale.join(", ")}`,
    stale.length === 0,
  );
  check("every exception carries a reason",
    Object.values(NOT_CONVERSATIONAL).every((r) => r.length > 20));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: that a model OBEYS the rule. This proves every conversational path is told it.");
