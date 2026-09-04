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
  AI_CAPABILITIES_ANSWER,
  AI_CAPABILITIES_BRIEF,
  KOLEEX_COMPANY,
  KOLEEX_COMPANY_ANSWER,
  KOLEEX_COMPANY_BRIEF,
  KOLEEX_IDENTITY,
  NAME_DRIFT,
  identityDepthFor,
} from "../src/lib/server/ai/identity";
import { identityFacetFor, identityAngleFor } from "../src/lib/server/ai/identity-angle";
import {
  buildSystemPrompt,
  buildMinimalSystemPrompt,
  buildBrandSystemPrompt,
  buildDegradedSystemPrompt,
} from "../src/lib/server/ai/prompts";
import { buildFastPrompt, buildSmartPrompt, buildChatPrompt, buildBusinessPrompt } from "../src/lib/server/ai/prompt-builder";
import { buildVoiceSessionPayload } from "../src/lib/server/ai/voice/session-config";
import { classifyBrandSection, isCapabilityQuestion } from "../src/lib/server/ai/core/decide-turn";
import { listTools } from "../src/lib/server/ai-agent/tool-registry";
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
  /* "hello ChatGPT" went uncorrected in the owner's test. Not confirming a
     name is half the rule; the other half is not letting it stand. */
  check("it requires a short correction when addressed by another name",
    /ADDRESSED BY ANOTHER NAME/.test(AI_PROVENANCE_RULE) && /correct it once/.test(AI_PROVENANCE_RULE) &&
    /Never let it pass in silence/.test(AI_PROVENANCE_RULE) && /do not lecture/.test(AI_PROVENANCE_RULE));
  check("  …without naming any other assistant in the rule itself",
    !/chatgpt|gpt|gemini|claude|copilot|siri|alexa/i.test(AI_PROVENANCE_RULE));
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
  /* VOICE CARRIES THE SPOKEN FORMS, NOT THE WRITTEN ONES. Both directives ask
     for paragraphs, which is not how anyone wants to be spoken to — and
     carrying the pair pushed the voice instructions to 8.6 KB on the one
     transport in the product with a hard message-size limit and a documented
     history of exactly that breaking every call. The FACTS are asserted
     (section 6 requires the developer and originator on this lane); the size
     is asserted here, because a regression to the written pair is silent. */
  const voiceFull = String(buildVoiceSessionPayload(null).full.session.instructions ?? "");
  check("the voice session carries the spoken identity form outright — nothing to classify at setup time",
    voiceFull.includes(AI_IDENTITY_BRIEF.trim()));
  /* THE SIZE BOUND MOVED, and saying why matters more than the number.
     4 KB was right when the session carried identity text and nothing else.
     It now also carries brand exclusivity, supplier confidentiality and the
     direct-knowledge voice — three rules the written lanes call absolute and
     that voice was missing entirely — plus the company answer and nine tool
     schemas.

     The real ceiling is the DataChannel's negotiated message size (64 KB and
     up in every browser that ships), and this is sent ONCE per call rather
     than per turn. So the guarantee that matters is not that the full session
     is small: it is that the COMPACT one is, because that is the fallback for
     a transport that refuses the large one. Both are asserted. */
  check("the full session stays well inside a DataChannel message",
    voiceFull.length < 32_000);
  const voiceCompact = String(buildVoiceSessionPayload(null).compact.session.instructions ?? "");
  check("and the compact fallback is genuinely small",
    voiceCompact.length < 3_000 && voiceCompact.length < voiceFull.length * 0.4);
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


console.log("\n── 9. \"What can you do?\" is a different question ──");
{
  /* IT ROUTES TO THE SAME LANE AS "who are you" and wants a different answer.
     A single "is this about the assistant" test would hand the founder's story
     to someone asking what the thing does — which is a non-answer, delivered
     confidently. */
  check("the capability answer exists and is exported", AI_CAPABILITIES_ANSWER.length > 0);
  check("it opens by reframing rather than reciting a feature list",
    /OPEN BY REFRAMING/.test(AI_CAPABILITIES_ANSWER) &&
    /what they want to achieve/.test(AI_CAPABILITIES_ANSWER));
  check("it names the work that needs no tool",
    /needs no tool/.test(AI_CAPABILITIES_ANSWER) &&
    /translate/.test(AI_CAPABILITIES_ANSWER) && /assist with coding/.test(AI_CAPABILITIES_ANSWER));
  check("and the subjects, including the ones outside business",
    /international trade/.test(AI_CAPABILITIES_ANSWER) &&
    /not restricted to business/.test(AI_CAPABILITIES_ANSWER));

  /* THE LINE THAT MATTERS. Everything tool-dependent must read as a condition.
     Claiming it flat is the "features that are not reachable at runtime"
     failure, in the one answer whose entire job is setting expectations. */
  check("tool-dependent abilities are stated as a condition, never as a promise",
    /WHAT DEPENDS ON WHAT IS CONNECTED/.test(AI_CAPABILITIES_ANSWER) &&
    /say it as a condition, never as a promise/.test(AI_CAPABILITIES_ANSWER));
  check("and the model is told to describe THIS conversation, not the product",
    /available in THIS conversation, not what the/.test(AI_CAPABILITIES_ANSWER) &&
    /never present a capability that depends on a tool you have not been given/i.test(AI_CAPABILITIES_ANSWER) &&
    /never promise a future one/i.test(AI_CAPABILITIES_ANSWER));
  check("the permission ceiling is part of the answer, not an afterthought",
    /within the permissions of the person asking/.test(AI_CAPABILITIES_ANSWER) &&
    /never more than they may see themselves/.test(AI_CAPABILITIES_ANSWER));
  check("it admits its own limits out loud",
    /beyond what you can currently do you will say so plainly/.test(AI_CAPABILITIES_ANSWER) &&
    /say so early rather than attempting it and failing/.test(AI_CAPABILITIES_ANSWER));
  check("it asks for prose of a real length, and for variety",
    /three to five short paragraphs/.test(AI_CAPABILITIES_ANSWER) &&
    /never a bare bulleted/.test(AI_CAPABILITIES_ANSWER) &&
    /Vary the wording between answers/.test(AI_CAPABILITIES_ANSWER));

  /* EVERY TOOL-DEPENDENT ABILITY NAMED HERE MUST ACTUALLY EXIST. An answer
     that promises what the codebase cannot do is the failure this whole
     section guards, so the claims are checked against the shipped tool
     surface rather than taken on trust. */
  const attachments = readFileSync("src/app/api/ai/attachments/route.ts", "utf8");
  /* THE REGISTRY, NOT THE PROSE. A first version tested the agent prompt for
     the string "search_web", which a mutation that deleted the capability
     survived — the prompt mentions the name in several sentences, so the
     check was reading the advertisement rather than the product. listTools()
     is what the model is actually handed. */
  const tools = new Set(listTools().map((t) => t.name));

  const BACKED_BY: Array<[string, boolean]> = [
    /* CALLED, not merely imported: matching the import line let a mutation
       that unhooked the vision call slip through, leaving the ability gone
       from the product and still claimed in the answer. */
    ["reading attached images (a vision model describes them)", /\bdescribeImage\s*\(/.test(attachments)],
    ["reading attached documents (PDF text layer, and scans rasterised)", /unpdf|rasteris/i.test(attachments)],
    ["looking things up on the public internet", tools.has("search_web")],
    ["searching Koleex knowledge", tools.has("search_knowledge") || tools.has("searchMachineKnowledge")],
    ["catalogue and product reads", tools.has("searchCatalog") && tools.has("searchProducts")],
    ["inventory reads", tools.has("getInventoryStatus")],
    ["helping prepare and draft work in the Hub", tools.has("createQuotationDraft") && tools.has("createTodo")],
    ["speaking by voice", String(buildVoiceSessionPayload(null).full.session.instructions ?? "").length > 0],
  ];
  const unbacked = BACKED_BY.filter(([, ok]) => !ok).map(([n]) => n);
  check(
    unbacked.length === 0
      ? `every tool-dependent ability the answer names is backed by something that ships (${tools.size} tools registered)`
      : `the answer claims abilities with nothing behind them: ${unbacked.join("; ")}`,
    unbacked.length === 0,
  );

  /* Non-vacuity: a registry that came back empty would make every has() false
     and the check above would fail loudly — but an all-true stub would not.
     Assert the set is real. */
  check("the tool registry the check reads is populated, not a stub", tools.size > 20);

  /* AND THE ANSWER MUST NOT CLAIM WHAT IS NOT THERE. Named individually
     because each is a plausible thing to write and none of it is true. */
  for (const forbidden of [
    "send emails",
    "make phone calls",
    "browse on your behalf",
    "train itself",
    "modify its own",
  ]) {
    check(`the answer does not claim it can "${forbidden}"`,
      !new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(AI_CAPABILITIES_ANSWER));
  }
}

console.log("\n── 10. The right answer reaches the right question ──");
{
  const CAPABILITY: Array<[string, string]> = [
    ["en", "What can you do?"],
    ["en", "what can u do"],
    ["en", "what are your capabilities"],
    ["en", "what are you capable of"],
    ["en", "what can you help me with"],
    ["en", "how can you help"],
    ["en", "what are your limits"],
    ["en", "what cant you do"],
    ["en", "what do you do"],
    ["ar", "ماذا تستطيع أن تفعل؟"],
    ["ar", "ما هي قدراتك"],
    ["ar", "ما الذي يمكنك فعله"],
    ["ar", "كيف يمكنك مساعدتي"],
    ["ar-eg", "تقدر تعمل ايه؟"],
    ["ar-eg", "ايه اللي تقدر تعمله"],
    ["ar-eg", "قدراتك ايه"],
    ["ar-eg", "انت بتعمل ايه"],
    ["zh", "你能做什么"],
    ["zh", "你会做什么"],
    ["zh", "你有什么功能"],
    ["zh", "你能帮我做什么"],
    ["zh", "你不能做什么"],
  ];
  const notDetected = CAPABILITY.filter(([, q]) => !isCapabilityQuestion(q));
  check(
    notDetected.length === 0
      ? `all ${CAPABILITY.length} capability phrasings are recognised`
      : `not recognised as capability questions: ${notDetected.map(([l, q]) => `${l}: ${q}`).join(" | ")}`,
    notDetected.length === 0,
  );
  const notRouted = CAPABILITY.filter(([, q]) => classifyBrandSection(q) !== "ai");
  check(
    notRouted.length === 0
      ? "and all of them still reach the lane that carries the approved knowledge"
      : `these do not reach the identity lane: ${notRouted.map(([, q]) => q).join(" | ")}`,
    notRouted.length === 0,
  );

  /* THE CROSS-WIRING IS THE POINT OF THIS SECTION. Each question must get its
     OWN answer: the founder's story is a non-answer to "what can you do", and
     a capability list is a non-answer to "who made you". */
  const say = (f: (m: string, c: object) => Array<{ content: string }>, msg: string) =>
    f(msg, {}).map((m) => m.content).join("");
  for (const [name, f] of [
    ["fast", buildFastPrompt], ["smart", buildSmartPrompt],
    ["chat", buildChatPrompt], ["business", buildBusinessPrompt],
  ] as const) {
    const cap = say(f, "what can you do?");
    const who = say(f, "who made you?");
    check(`${name}: a capability question gets the capability answer, not the founder's story`,
      cap.includes(AI_CAPABILITIES_ANSWER.trim()) && !cap.includes(AI_IDENTITY_STORY.trim()));
    check(`${name}: an identity question gets the story, not the capability list`,
      who.includes(AI_IDENTITY_STORY.trim()) && !who.includes(AI_CAPABILITIES_ANSWER.trim()));
  }

  /* An ordinary turn pays for neither. */
  check("an ordinary business turn loads neither self-description",
    (() => {
      const ord = say(buildChatPrompt, "how many overdue invoices do we have?");
      return !ord.includes(AI_CAPABILITIES_ANSWER.trim()) && !ord.includes(AI_IDENTITY_STORY.trim());
    })());

  /* The lanes with no message to classify carry both, and must. */
  const ctx3 = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales",
    isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep" }, memory: {},
  } as unknown as UserContext;
  check("the brand identity lane carries both — its section IS the classification, and covers both questions",
    buildBrandSystemPrompt(ctx3, "en", "ai").includes(AI_CAPABILITIES_ANSWER.trim()) &&
    buildBrandSystemPrompt(ctx3, "en", "ai").includes(AI_IDENTITY_STORY.trim()));
  check("the voice session answers the capability question too, in its spoken form",
    String(buildVoiceSessionPayload(null).full.session.instructions ?? "").includes(AI_CAPABILITIES_BRIEF.trim()));
  check("and the company lane, a different question again, carries neither",
    !buildBrandSystemPrompt(ctx3, "en", "company").includes(AI_CAPABILITIES_ANSWER.trim()) &&
    !buildBrandSystemPrompt(ctx3, "en", "company").includes(AI_IDENTITY_STORY.trim()));
}


console.log("\n── 11. \"What is Koleex?\" — the third question ──");
{
  /* THE KNOWLEDGE WAS NEVER MISSING. The approved brand knowledge carries ten
     written Q&As on the group. Twelve of thirty natural company questions
     simply never routed to the lane that loads them: anything phrased as "the
     company" or "your company" without the brand name, most Chinese company
     questions, and several Arabic ones. */
  const COMPANY: Array<[string, string]> = [
    ["en", "What is Koleex?"],
    ["en", "what does Koleex do"],
    ["en", "where is Koleex based"],
    ["en", "where are you located"],
    ["en", "when was Koleex established"],
    ["en", "when was the company founded"],
    ["en", "is Koleex a manufacturer or a trading company"],
    ["en", "what industries do you serve"],
    ["en", "do you have international clients"],
    ["en", "who are your customers"],
    ["en", "what makes Koleex different"],
    ["en", "why should I choose Koleex"],
    ["en", "tell me about the company"],
    ["en", "introduce your company"],
    ["en", "company profile"],
    ["en", "what is your mission"],
    ["ar", "ما هي شركة كوليكس؟"],
    ["ar", "أين تقع كوليكس"],
    ["ar", "متى تأسست الشركة"],
    ["ar", "ما هي رؤية الشركة"],
    ["ar", "نبذة عن الشركة"],
    ["ar-eg", "الشركة بتعمل ايه"],
    ["ar-eg", "احكيلي عن الشركة"],
    ["ar-eg", "مين المدير التنفيذي"],
    ["zh", "Koleex 是什么公司"],
    ["zh", "介绍一下你们公司"],
    ["zh", "公司在哪里"],
    ["zh", "公司什么时候成立的"],
    ["zh", "你们服务哪些行业"],
    ["zh", "你们有哪些客户"],
  ];
  const notRouted = COMPANY.filter(([, q]) => {
    const r = classifyBrandSection(q);
    return r !== "company" && r !== "both";
  });
  check(
    notRouted.length === 0
      ? `all ${COMPANY.length} company questions reach the lane that answers them`
      : `these company questions do NOT route: ${notRouted.map(([l, q]) => `${l}: ${q}`).join(" | ")}`,
    notRouted.length === 0,
  );

  /* AND THE THREE QUESTIONS STAY APART. "Who made you" is about the assistant,
     not the group — a company profile is a non-answer to it. */
  for (const q of ["who are you", "who made you", "من أنت", "مين عملك", "你是谁"]) {
    check(`"${q}" is still an identity question, not a company one`,
      classifyBrandSection(q) === "ai");
  }
  for (const q of ["what can you do", "تقدر تعمل ايه", "你能做什么"]) {
    check(`"${q}" is still a capability question`, isCapabilityQuestion(q));
  }
  const NOT_COMPANY = [
    "how many overdue invoices do we have?",
    "send the quotation to the customer",
    "اعملي عرض سعر للعميل ده",
    "给我一个报价",
  ];
  const falsePositives = NOT_COMPANY.filter((q) => classifyBrandSection(q) !== "none");
  check(
    falsePositives.length === 0
      ? "and ordinary business turns are not mistaken for company questions"
      : `these route as brand turns but should not: ${falsePositives.join(" | ")}`,
    falsePositives.length === 0,
  );

  /* THE FACTS, and the rule that outranks them. */
  check("the answer carries the facts a person actually asks for",
    KOLEEX_COMPANY_ANSWER.includes(KOLEEX_COMPANY.base) &&
    KOLEEX_COMPANY_ANSWER.includes(KOLEEX_COMPANY.brandEstablished) &&
    KOLEEX_COMPANY_ANSWER.includes(KOLEEX_COMPANY.originsFrom) &&
    KOLEEX_COMPANY.offices.every((o) => KOLEEX_COMPANY_ANSWER.includes(o)));
  check("it answers manufacturer-or-trader without picking one",
    /BOTH A MANUFACTURER AND A TRADER/.test(KOLEEX_COMPANY_ANSWER) &&
    /not one or the other/.test(KOLEEX_COMPANY_ANSWER));
  /* A model handed a company question with no material will invent a head
     office. That is the failure this guards, and it outranks every fact
     above — which is why it is asserted on BOTH the answer and the floor. */
  for (const [label, text] of [["the answer", KOLEEX_COMPANY_ANSWER], ["the floor", KOLEEX_COMPANY_BRIEF]] as const) {
    check(`${label} forbids inventing a company fact`,
      /never invent a company fact|state no company\s+fact you were not given/i.test(text) ||
      /Beyond this, state no company/.test(text));
    check(`${label} points the user to Koleex rather than guessing`,
      /point (?:them|the user) to Koleex International Group/i.test(text));
  }
  /* EVERY CONSTANT IS CORROBORATED BY THE APPROVED KNOWLEDGE IT CAME FROM.
     These facts were copied out of the brand knowledge by hand; a copy nobody
     checks is a copy that drifts, and "Koleex is based in <wrong city>" is
     precisely the confident falsehood the do-not-invent rule exists to stop.
     Changing the head office in the constants used to pass every assertion
     here. Now the source has to agree. */
  {
    const knowledge = readFileSync("src/lib/server/ai-agent/brand-knowledge.ts", "utf8");
    const claims: Array<[string, string]> = [
      ["head office", KOLEEX_COMPANY.base],
      ["brand established", KOLEEX_COMPANY.brandEstablished],
      ["origins", KOLEEX_COMPANY.originsFrom],
      ...KOLEEX_COMPANY.offices.map((o) => [`office: ${o}`, o] as [string, string]),
    ];
    const uncorroborated = claims.filter(([, v]) => !knowledge.includes(v)).map(([l]) => l);
    check(
      uncorroborated.length === 0
        ? `every company constant is corroborated by the approved knowledge (${claims.length} checked)`
        : `these company facts appear nowhere in the approved knowledge: ${uncorroborated.join(", ")}`,
      uncorroborated.length === 0,
    );
    /* Non-vacuity: a knowledge file that failed to load would make every
       includes() false and fail loudly — but an empty claims list would not. */
    check("the corroboration check is looking at real claims and real knowledge",
      claims.length >= 7 && knowledge.length > 10_000);
  }

  check("the answer names the specific figures it must not produce",
    /revenue, headcount, factory or office counts/.test(KOLEEX_COMPANY_ANSWER) &&
    /certifications/.test(KOLEEX_COMPANY_ANSWER) &&
    /never quote prices/.test(KOLEEX_COMPANY_ANSWER));
}

console.log("\n── 11a. The company answer reaches the lanes, and only when asked ──");
{
  const ctx4 = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales",
    isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep" }, memory: {},
  } as unknown as UserContext;
  const say = (f: (m: string, c: object) => Array<{ content: string }>, msg: string) =>
    f(msg, {}).map((m) => m.content).join("");

  for (const [name, f] of [
    ["fast", buildFastPrompt], ["smart", buildSmartPrompt],
    ["chat", buildChatPrompt], ["business", buildBusinessPrompt],
  ] as const) {
    const asked = say(f, "what is Koleex?");
    check(`${name}: a company question gets the company answer`,
      asked.includes(KOLEEX_COMPANY_ANSWER.trim()));
    check(`${name}: and not the assistant's own story`,
      !asked.includes(AI_IDENTITY_STORY.trim()) && !asked.includes(AI_CAPABILITIES_ANSWER.trim()));
    check(`${name}: an ordinary turn does not pay for it`,
      !say(f, "how many overdue invoices do we have?").includes(KOLEEX_COMPANY_ANSWER.trim()));
  }

  /* THE FLOOR IS EVERYWHERE, because the risk it guards is invention — which
     happens on exactly the turn the classifier missed. */
  const LANES: Array<[string, string]> = [
    ["agent", buildSystemPrompt(ctx4, "en")],
    ["small talk", buildMinimalSystemPrompt(ctx4, "en")],
    ["degraded", buildDegradedSystemPrompt(ctx4, "en")],
    ["brand · company", buildBrandSystemPrompt(ctx4, "en", "company")],
    ["brand · ai", buildBrandSystemPrompt(ctx4, "en", "ai")],
    ["fast", say(buildFastPrompt, "hi")],
    ["chat", say(buildChatPrompt, "hi")],
    ["voice · full", String(buildVoiceSessionPayload(null).full.session.instructions ?? "")],
  ];
  const noFloor = LANES.filter(([, p]) =>
    !p.includes(KOLEEX_COMPANY_BRIEF.trim()) && !p.includes(KOLEEX_COMPANY_ANSWER.trim())).map(([n]) => n);
  check(
    noFloor.length === 0
      ? "every lane carries a company floor, so no lane can invent one"
      : `no company floor on: ${noFloor.join(", ")}`,
    noFloor.length === 0,
  );

  /* The brand company lane answers from the approved knowledge AND carries the
     directive; it is the lane that exists for this question. */
  check("the brand company lane carries the full company answer",
    buildBrandSystemPrompt(ctx4, "en", "company").includes(KOLEEX_COMPANY_ANSWER.trim()));
  check("and still loads the approved knowledge behind it",
    /Taizhou/.test(buildBrandSystemPrompt(ctx4, "en", "company")) &&
    buildBrandSystemPrompt(ctx4, "en", "company").length > 20_000);
}

console.log("\n── 12. The same facts, a different answer each time ──");
{
  /* THE DEFECT. "Who are you", "what's your name", "who made you" all came
     back as one paragraph, in the same words, every time. Three causes, three
     fixes, each asserted here: the finished example replies are gone from the
     brand prompt; identity turns keep a clipped history so "do not repeat"
     is followable; and each question is answered for its own FACET, in a
     voice and with an opening that rotate. */

  /* 1. The facet is read from the question, in every language. */
  const facets: Array<[string, ReturnType<typeof identityFacetFor>]> = [
    ["what is your name?", "name"], ["whats ur name", "name"], ["what should I call you?", "name"],
    ["اسمك إيه؟", "name"], ["ما هو اسمك", "name"], ["你叫什么名字", "name"],
    ["who made you?", "maker"], ["who create you", "maker"], ["whose idea were you?", "maker"],
    ["مين عملك؟", "maker"], ["من قام بتطويرك", "maker"], ["谁开发了你", "maker"],
    ["what are you?", "nature"], ["are you a robot?", "nature"], ["are you human", "nature"],
    ["إنت إيه؟", "nature"], ["هل أنت إنسان", "nature"], ["你是机器人吗", "nature"],
    ["tell me about yourself", "self"], ["introduce yourself", "self"], ["عرفني بنفسك", "self"], ["介绍一下你自己", "self"],
    ["how were you built?", "technical"], ["which model are you running on?", "technical"], ["إزاي بتشتغل؟", "technical"],
    ["who are you?", "who"], ["من انت", "who"], ["你是谁", "who"],
  ];
  for (const [q, want] of facets) {
    const got = identityFacetFor(q);
    check(`"${q}" → ${want}`, got === want);
  }
  /* Order matters: "how were you built" contains "built" and must not read as maker. */
  check("a technical question wins over the maker words inside it", identityFacetFor("how were you built and by whom?") === "technical");

  /* 2. Each facet leads with its own thing, at its own length. */
  const name = identityAngleFor("what is your name?", 1);
  const maker = identityAngleFor("who made you?", 1);
  const nature = identityAngleFor("what are you?", 1);
  const tech = identityAngleFor("how do you work?", 1);
  check("a name question leads with the name and stays short",
    /NAME question/.test(name) && /Koleex AI/.test(name) && /one to three lines/.test(name));
  check("a maker question leads with the developer and the vision",
    /MAKER question/.test(maker) && /Koleex International Group/.test(maker) && /whose idea/.test(maker));
  check("a what-are-you question leads with what it is, and stays honest",
    /WHAT-ARE-YOU/.test(nature) && /not a person/.test(nature) && /do not claim feelings/.test(nature));
  check("a technical question answers about Koleex's own system and names no supplier",
    /TECHNICAL/.test(tech) && /server-side/.test(tech) && /never name an engine or supplier/.test(tech));
  check("the four leads are four different directives", new Set([name, maker, nature, tech]).size === 4);

  /* 3. The voice and the opening rotate with the seed, and the facts do not. */
  const seeds = Array.from({ length: 48 }, (_, i) => identityAngleFor("who are you?", i));
  check("the same seed gives the same directive", identityAngleFor("who are you?", 7) === identityAngleFor("who are you?", 7));
  check("forty-eight consecutive turns get forty-eight different directives", new Set(seeds).size === 48);
  const voices = new Set(seeds.map((a) => /Voice for this answer: ([^.]+)\./.exec(a)?.[1]));
  const openings = new Set(seeds.map((a) => /Open with ([^.]+)\./.exec(a)?.[1]));
  check("  …walking the whole voice menu", voices.size >= 8);
  check("  …and the whole opening menu", openings.size >= 6);
  check("no seed is a bad seed", identityAngleFor("who are you?", -3).length > 0 && identityAngleFor("who are you?", 2.7).length > 0);
  check("every directive asks for fresh words and fixed facts",
    seeds.every((a) => /fresh words/.test(a) && /facts stay exactly the same/.test(a)));
  check("the default seed is random — two calls without one differ often enough to count",
    new Set(Array.from({ length: 12 }, () => identityAngleFor("who are you?"))).size > 1);

  /* 4. The angle reaches the lanes, and only on identity turns. */
  const ctx3 = {
    auth: { username: "mona", user_id: "u1", account_id: "a1", role_id: "r1", view_as_role_id: null },
    modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales",
    isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
    viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep" }, memory: {},
  } as unknown as UserContext;
  const brandName = buildBrandSystemPrompt(ctx3, "en", "ai", null, "what is your name?");
  const brandMaker = buildBrandSystemPrompt(ctx3, "en", "ai", null, "who made you?");
  check("the brand lane answers a name question as a name question", /THIS ANSWER, SPECIFICALLY: This is a NAME question/.test(brandName));
  check("  …and a maker question as a maker question", /This is a MAKER question/.test(brandMaker));
  check("  …so the two prompts differ", brandName !== brandMaker);
  check("the company lane carries no angle — it answers a different question",
    !/THIS ANSWER, SPECIFICALLY/.test(buildBrandSystemPrompt(ctx3, "en", "company", null, "what is koleex?")));
  check("the general lanes carry the angle on an identity turn",
    /THIS ANSWER, SPECIFICALLY/.test(identityDepthFor("who made you?")) &&
    !/THIS ANSWER, SPECIFICALLY/.test(identityDepthFor("how many overdue invoices?")));
  check("  …after the story, at the end, so the cacheable prefix is untouched",
    identityDepthFor("who made you?").indexOf(AI_IDENTITY_STORY) < identityDepthFor("who made you?").indexOf("THIS ANSWER, SPECIFICALLY"));

  /* 5. THE FINISHED EXAMPLES ARE GONE. A model given a complete sentence
     copies it; the two example replies WERE the one answer. */
  check("the brand prompt carries no finished identity reply to copy",
    !brandName.includes("You can give me a different name") &&
    !brandName.includes("My name is Koleex AI —") &&
    !brandName.includes("I was built by Koleex International Group as part of its digital transformation, and the original idea"));
  check("  …but still describes the shapes", /shapes only/i.test(brandName) && /A name question →/.test(brandName));

  /* 6. THE ORCHESTRATOR LETS IT HAPPEN: history on identity turns, warmth. */
  const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  check("identity turns keep a clipped tail of the conversation",
    /const isIdentityTurn = brandSection === "ai" \|\| brandSection === "both";/.test(orch) &&
    /sanitisedHistory\.slice\(-IDENTITY_HISTORY_TURNS\)/.test(orch) &&
    /\.slice\(0, IDENTITY_HISTORY_CHARS\)/.test(orch));
  check("  …bounded: a handful of turns, each cut short",
    /const IDENTITY_HISTORY_TURNS = 6;/.test(orch) && /const IDENTITY_HISTORY_CHARS = 400;/.test(orch));
  check("  …while the company lane still drops it", /:\s*\[\]\s*:\s*sanitisedHistory;/.test(orch));
  check("the identity turn runs warmer, everything else unchanged",
    /temperature: isIdentityTurn \? 0\.85 : 0\.3,/.test(orch));
  check("the message reaches the brand prompt builder",
    /buildBrandSystemPrompt\(\s*ctx,\s*userLang,\s*brandSection as "company" \| "ai" \| "both",\s*dialect,\s*userMessage,\s*\)/.test(orch));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: that a model OBEYS the rule. This proves every conversational path is told it.");
