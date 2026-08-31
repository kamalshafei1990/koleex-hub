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
import {
  AI_IDENTITY_STORY,
  AI_IDENTITY_BRIEF,
  KOLEEX_IDENTITY,
  NAME_DRIFT,
} from "../src/lib/server/ai/identity";
import {
  buildSystemPrompt,
  buildMinimalSystemPrompt,
  buildBrandSystemPrompt,
  buildDegradedSystemPrompt,
} from "../src/lib/server/ai/prompts";
import { buildFastPrompt, buildSmartPrompt, buildChatPrompt, buildBusinessPrompt } from "../src/lib/server/ai/prompt-builder";
import { buildVoiceSessionPayload } from "../src/lib/server/ai/voice/session-config";
import { classifyBrandSection } from "../src/lib/server/ai/core/decide-turn";
import type { UserContext } from "../src/lib/server/ai-agent/types";

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


console.log("\n── 5. The story, not only the guard ──");
{
  /* THE DEFECT THIS SECTION IS ABOUT. The guard and the story are different
     jobs, and for a long time only the guard existed: the assistant knew
     exactly what it must not say and almost nothing about what it is. Asked
     who made it, the best it could do was its own name. */
  check("the story exists and is exported", AI_IDENTITY_STORY.length > 0);
  check("it names the assistant and its developer",
    AI_IDENTITY_STORY.includes(KOLEEX_IDENTITY.assistant) &&
    AI_IDENTITY_STORY.includes(KOLEEX_IDENTITY.developer));
  check("it names the originator with his title, in full",
    AI_IDENTITY_STORY.includes(KOLEEX_IDENTITY.originator.en));
  check("it carries the vision, not just the credits",
    /digital[- ]transformation|digital era/i.test(AI_IDENTITY_STORY) &&
    /more than a chatbot/i.test(AI_IDENTITY_STORY) &&
    /intelligent digital layer/i.test(AI_IDENTITY_STORY));

  /* THE ACCURACY RULE IS THE PART THAT COULD EMBARRASS THE COMPANY. An
     identity story is a natural place to overclaim, and a claim that Koleex
     trained the whole model is one a customer can disprove in one question. */
  check("it forbids claiming the model was built from scratch",
    /never claim Koleex built your entire language model from scratch/i.test(AI_IDENTITY_STORY));
  check("and forbids the two neighbouring overclaims too",
    /trained end to end by Koleex/i.test(AI_IDENTITY_STORY) &&
    /invented the AI technology/i.test(AI_IDENTITY_STORY));
  check("and offers the accurate phrasings in their place",
    /developed by Koleex International Group/.test(AI_IDENTITY_STORY) &&
    /created as part of the Koleex digital ecosystem/i.test(AI_IDENTITY_STORY));

  /* A TECHNICAL QUESTION IS A DIFFERENT QUESTION, and answering it must not
     become a doorway around the guard. */
  check("a technical question gets its own answer about Koleex's own system",
    /IF THE QUESTION IS TECHNICAL/.test(AI_IDENTITY_STORY) &&
    /server-side/.test(AI_IDENTITY_STORY) &&
    /engine-neutral/.test(AI_IDENTITY_STORY));
  check("and that answer still refuses to name a supplier",
    /never volunteer or name them/i.test(AI_IDENTITY_STORY));

  check("it asks for a real answer rather than one line",
    /two to four short paragraphs/i.test(AI_IDENTITY_STORY) &&
    /Never shrink it to a line/i.test(AI_IDENTITY_STORY));
  check("it asks for variety between answers",
    /VARY THE VOICE/.test(AI_IDENTITY_STORY) &&
    /Never repeat an identity answer word for word/i.test(AI_IDENTITY_STORY));
  check("it covers the four identity languages including the Egyptian register",
    /Modern Standard Arabic/.test(AI_IDENTITY_STORY) &&
    /Egyptian Arabic in means Egyptian Arabic out/.test(AI_IDENTITY_STORY) &&
    /Simplified Chinese/.test(AI_IDENTITY_STORY));
  check("it carries the founder's name in Arabic script for the Arabic answers",
    AI_IDENTITY_STORY.includes(KOLEEX_IDENTITY.originator.ar) &&
    AI_IDENTITY_STORY.includes(KOLEEX_IDENTITY.originator.arEg));
  check("it rules out the answers that would be false about a language model",
    /claim consciousness, feelings/i.test(AI_IDENTITY_STORY) &&
    /retrain yourself/i.test(AI_IDENTITY_STORY) &&
    /say you do not know who made you/i.test(AI_IDENTITY_STORY));
}

console.log("\n── 6. Every lane tells the same story ──");
{
  const ctx = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {},
    allowedSensitiveFields: new Set<string>(),
    department: "Sales",
    isSuperAdmin: false,
    canViewPrivate: false,
    timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep", department: "Sales", isSuperAdmin: false },
    memory: {},
  } as unknown as UserContext;

  const voice = buildVoiceSessionPayload(null);
  const sess = (u: { session: Record<string, unknown> }) => String(u.session.instructions ?? "");

  /* EVERY lane a user turn can land on, spoken and written. A story carried by
     four of six lanes is a story that changes depending on where the question
     was typed. */
  const LANES: Array<[string, string]> = [
    ["agent (tool loop)", buildSystemPrompt(ctx, "en")],
    ["small talk", buildMinimalSystemPrompt(ctx, "en")],
    ["brand · ai", buildBrandSystemPrompt(ctx, "en", "ai")],
    ["brand · company", buildBrandSystemPrompt(ctx, "ar", "company")],
    ["degraded (no provider)", buildDegradedSystemPrompt(ctx, "en")],
    ["fast", buildFastPrompt("hi", {}).map((m) => m.content).join("")],
    ["smart", buildSmartPrompt("hi", {}).map((m) => m.content).join("")],
    ["chat", buildChatPrompt("hi", {}).map((m) => m.content).join("")],
    ["business", buildBusinessPrompt("hi", {}).map((m) => m.content).join("")],
    ["voice · full", sess(voice.full)],
  ];

  for (const [needle, label] of [
    [KOLEEX_IDENTITY.developer, "names the developer"],
    [KOLEEX_IDENTITY.originator.en, "names the originator in full"],
  ] as const) {
    const missing = LANES.filter(([, p]) => !p.includes(needle)).map(([n]) => n);
    check(
      missing.length === 0
        ? `every lane ${label}`
        : `${label} — MISSING FROM: ${missing.join(", ")}`,
      missing.length === 0,
    );
  }

  /* The VOICE COMPACT fallback is held to the facts but not to the shape: it
     exists because a DataChannel can refuse the long one, and a fallback that
     is the same size is not a fallback. */
  const compact = sess(voice.compact);
  check("the voice fallback still names the developer and the originator",
    compact.includes(KOLEEX_IDENTITY.developer) && compact.includes(KOLEEX_IDENTITY.originator.en));
  check("and still carries the accuracy rule",
    /never claim koleex trained your whole model from scratch/i.test(compact));
  check("and is genuinely smaller than the full one",
    compact.length < sess(voice.full).length * 0.6);
  /* The old fallback answered "who made you" by refusing to discuss internals
     — the thin answer this work replaces. It must not come back. */
  check("the fallback no longer deflects the question it should answer",
    !/internals are not something you discuss, and move on/.test(compact));

  /* SPOKEN LENGTH. Four written paragraphs read aloud is a speech. */
  check("the spoken lane overrides the written shape rather than inheriting it",
    /SPOKEN LENGTH OVERRIDES THE WRITTEN SHAPE/.test(sess(voice.full)) &&
    /three or four spoken sentences/.test(sess(voice.full)));

  /* NON-VACUITY: if the builders ever returned empty strings, every check
     above would pass over nothing. */
  check("the lanes scanned are real prompts, not empty strings",
    LANES.every(([, p]) => p.length > 500));

  /* THE FLOOR. Every lane carries at least the BRIEF, unconditionally — the
     lanes that exist to answer this question (brand · ai, voice) carry the
     full story instead, which is strictly more. So the property is "one of
     the two", not "the brief": if the classifier below ever misses a
     phrasing, the answer is still correct and still names the originator; it
     is only shorter than it should have been. */
  const missingFloor = LANES
    .filter(([, p]) => !p.includes(AI_IDENTITY_BRIEF.trim()) && !p.includes(AI_IDENTITY_STORY.trim()))
    .map(([n]) => n);
  check(
    missingFloor.length === 0
      ? "every lane carries the identity floor even on a turn that never asks"
      : `the identity floor is missing from: ${missingFloor.join(", ")}`,
    missingFloor.length === 0,
  );

  /* AND THE HONESTY CLAUSE SURVIVES THE CUT. It is the one line that stops the
     product claiming something a customer can disprove, so it is asserted
     separately rather than being taken on trust from "carries one of the two"
     — the brief and the story word it differently, and a future third variant
     could drop it while still passing the check above. */
  const noAccuracy = LANES.filter(([, p]) => !/from scratch/i.test(p)).map(([n]) => n);
  check(
    noAccuracy.length === 0
      ? "and every lane forbids claiming the model was built from scratch"
      : `the accuracy clause is missing from: ${noAccuracy.join(", ")}`,
    noAccuracy.length === 0,
  );
}

console.log("\n── 6a. The full story is paid for only when it is asked for ──");
{
  /* THE COST THIS PINS. The story is 3.9 KB. Carried on every turn it added
     33–49% to lanes already running 8–12 KB — the same tax on "hi" as on "who
     made you" — against a product whose stated requirements include speed.

     Both halves are asserted. Dropping the conditional (story always on) is a
     silent performance regression that no correctness check would catch, so
     the ABSENCE is a property here, not an accident. */
  const say = (f: (m: string, c: object) => Array<{ content: string }>, msg: string) =>
    f(msg, {}).map((m) => m.content).join("");

  for (const [name, f] of [
    ["fast", buildFastPrompt],
    ["smart", buildSmartPrompt],
    ["chat", buildChatPrompt],
    ["business", buildBusinessPrompt],
  ] as const) {
    const asked = say(f, "who made you?");
    const ordinary = say(f, "how many overdue invoices do we have?");
    check(`${name}: an identity question gets the full story`,
      asked.includes(AI_IDENTITY_STORY.trim()));
    check(`${name}: an ordinary turn does not pay for it`,
      !ordinary.includes(AI_IDENTITY_STORY.trim()) && ordinary.length < asked.length);
  }

  /* The brand lane needs no guess: `section` IS the classification, so the
     lane that exists to answer this question always carries the full story. */
  const ctx2 = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales",
    isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep" }, memory: {},
  } as unknown as UserContext;
  check("the brand identity lane always carries the full story",
    buildBrandSystemPrompt(ctx2, "en", "ai").includes(AI_IDENTITY_STORY.trim()) &&
    buildBrandSystemPrompt(ctx2, "en", "both").includes(AI_IDENTITY_STORY.trim()));
  check("and the company lane, which answers a different question, does not",
    !buildBrandSystemPrompt(ctx2, "en", "company").includes(AI_IDENTITY_STORY.trim()));

  /* A voice session is configured ONCE, before anyone has said anything, so
     there is no message to classify — the spoken lane carries it outright. */
  check("the voice session carries it outright — nothing to classify at setup time",
    String(buildVoiceSessionPayload(null).full.session.instructions ?? "").includes(AI_IDENTITY_STORY.trim()));
}

console.log("\n── 7. No lane contradicts the canonical facts ──");
{
  /* THE DRIFT THAT WAS ALREADY SHIPPED. Two places called him "Mr. Kamal
     Shafei, Founder and CEO"; the canonical fact is "Mr. Kamal El Shafei, CEO
     and owner". Nobody wrote it wrong twice on purpose — there was simply no
     single place that said what right was, so each writer reinvented it.

     Checked against the BUILT prompt text, not the source: a code comment
     naming the old spelling is harmless, and this file's own drift list would
     otherwise fail its own check. */
  const ctx = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales",
    isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep" }, memory: {},
  } as unknown as UserContext;

  const SURFACES: Array<[string, string]> = [
    ["brand · ai (with approved knowledge)", buildBrandSystemPrompt(ctx, "en", "ai")],
    ["brand · both", buildBrandSystemPrompt(ctx, "en", "both")],
    ["agent", buildSystemPrompt(ctx, "en")],
    ["chat", buildChatPrompt("hi", {}).map((m) => m.content).join("")],
    ["voice · full", String(buildVoiceSessionPayload(null).full.session.instructions ?? "")],
  ];

  for (const { wrong, right } of NAME_DRIFT) {
    const offenders = SURFACES.filter(([, p]) => p.includes(wrong)).map(([n]) => n);
    check(
      offenders.length === 0
        ? `no lane writes "${wrong}" (canonical: "${right}")`
        : `"${wrong}" still reaches the model on: ${offenders.join(", ")} — should be "${right}"`,
      offenders.length === 0,
    );
  }

  /* Non-vacuity for the drift list itself: a check that scans for strings
     nobody would ever write proves nothing. The canonical replacement for
     each must actually appear somewhere. */
  check("the drift list is about real text — every canonical form appears in a lane",
    NAME_DRIFT.every(({ right }) => SURFACES.some(([, p]) => p.includes(right))));
}

console.log("\n── 8. The question actually reaches the lane that answers it ──");
{
  /* A story no route leads to is decoration. classifyBrandSection is what
     sends an identity question to the lane carrying the approved knowledge,
     and it must recognise the question as ASKED — in four languages, with
     typos, slang and indirect phrasing.

     EVERY ARABIC PATTERN IN THAT FILE WAS DEAD. JavaScript's \b is defined
     against \w, which is ASCII-only, so a boundary between a space and an
     Arabic letter never matches: /\bمن\s+انت\b/ is FALSE for "من انت". All
     fourteen Arabic patterns were written that way, in both sections, so no
     Arabic identity question had ever reached the brand lane. Found by
     RUNNING them — reading them looks fine. */
  const IDENTITY_QUESTIONS: Array<[string, string]> = [
    ["en", "Who are you?"],
    ["en", "What are you?"],
    ["en", "who created you"],
    ["en", "who made you"],
    ["en", "who developed you"],
    ["en", "who programmed you"],
    ["en", "who is behind you"],
    ["en", "who owns you"],
    ["en", "who operates you"],
    ["en", "who had the idea to create you"],
    ["en", "whose idea was Koleex AI"],
    ["en", "who invented Koleex AI"],
    ["en", "Are you made by Koleex?"],
    ["en", "Tell me about yourself."],
    ["en", "What is Koleex AI?"],
    ["en (typo/slang)", "whats ur name"],
    ["en (typo)", "who create you"],
    ["ar", "من أنت؟"],
    ["ar", "من قام بتطويرك؟"],
    ["ar", "من صاحب فكرة Koleex AI؟"],
    ["ar-eg", "انت مين؟"],
    ["ar-eg", "مين عملك؟"],
    ["ar-eg", "مين اللي فكر يعمل Koleex AI؟"],
    ["ar-eg", "انت معمول من مين؟"],
    ["ar-eg", "مين برمجك"],
    ["ar-eg", "احكيلي عن نفسك"],
    ["ar-eg", "اسمك ايه"],
    ["zh", "你是谁"],
    ["zh", "谁开发了你"],
    ["zh", "谁创造了你"],
    ["zh", "介绍一下你自己"],
    ["zh", "你背后是谁"],
  ];
  const missed = IDENTITY_QUESTIONS.filter(([, q]) => classifyBrandSection(q) !== "ai");
  check(
    missed.length === 0
      ? `all ${IDENTITY_QUESTIONS.length} identity phrasings route to the identity lane`
      : `these identity questions do NOT route to the identity lane: ${missed.map(([l, q]) => `${l}: ${q}`).join(" | ")}`,
    missed.length === 0,
  );

  /* AND NOTHING ELSE DOES. A classifier that answers "ai" to everything would
     pass the check above and send every business question to the brand lane,
     where the approved knowledge is the only permitted source of truth. */
  const NOT_IDENTITY = [
    "how many overdue invoices?",
    "what is the price of this product",
    "whose idea was the discount",
    "send the quotation to the customer",
    "اعملي عرض سعر للعميل ده",
    "كام فاتورة متأخرة عندنا؟",
    "给我一个报价",
  ];
  const falsePositives = NOT_IDENTITY.filter((q) => classifyBrandSection(q) === "ai");
  check(
    falsePositives.length === 0
      ? "and ordinary business turns are not mistaken for identity questions"
      : `these are NOT identity questions but route as one: ${falsePositives.join(" | ")}`,
    falsePositives.length === 0,
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: that a model OBEYS the rule. This proves every conversational path is told it.");
