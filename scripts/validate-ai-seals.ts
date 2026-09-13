/* ---------------------------------------------------------------------------
   validate:ai-seals — Phase 2B gate.

   The seal chain is the last thing a reply passes through before it reaches a
   user, and the audit scored it 8.5/10 — the strongest component in the
   system. Until Phase 2B it was also, in test terms, the least defended: the
   only coverage was a handful of greps confirming its regexes were present in
   orchestrator.ts. A grep cannot tell you a guard still BLOCKS anything.

   Moving the seals into their own layer made them reachable, because the whole
   chain is pure and synchronous. This suite calls it. Every case below is a
   real failure mode named in the incident comments in the code — invented
   pricing, fake workflow narration, placeholders, ungrounded field claims,
   leaked tool markup — expressed as an input and an expected output.

   Two properties matter more than any single case and are asserted directly:
     · the chain has ONE entrance (sealFinalReply), and
     · a seal that stands down for one reason must NOT stand down for another
       (the attached-document exemption is scoped to v3 + pricing, never v1/v2).
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import type { AgentStep } from "../src/lib/server/ai-agent/types";
import {
  sealFinalReply,
  sealPricingSafety,
  sealExecutionSafety,
  sealExecutionSafetyV2,
  scrubLeakedToolMarkup,
  cleanAssistantText,
  normaliseBrandName,
  stripProcessNarration,
  PRICING_GUARD_MESSAGE,
} from "../src/lib/server/ai/seals";

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

/* ── Fixtures ──────────────────────────────────────────────────────────
   answer() is always present because every seal mutates the last answer
   step in place; a chain tested without one would exercise a path the
   orchestrator never takes. */
const answer = (text: string): AgentStep => ({ kind: "answer", text });
const pricingEvidence = (): AgentStep => ({
  kind: "tool-result",
  tool: "calculateQuotationPricing",
  permissionStatus: "allowed",
  payload: { total: 12400, unit_price: 6200 },
});
const draftEvidence = (): AgentStep => ({
  kind: "tool-result",
  tool: "createQuotationDraft",
  permissionStatus: "allowed",
  payload: { total: 12400 },
});
const deniedPricing = (): AgentStep => ({
  kind: "tool-result",
  tool: "calculateQuotationPricing",
  permissionStatus: "denied",
  payload: { total: 12400 },
});
const customerEvidence = (): AgentStep => ({
  kind: "tool-result",
  tool: "getCustomerByName",
  permissionStatus: "allowed",
  payload: { id: "c1", name: "Nile Textiles" },
});

const PRICED = "The unit price is $6,200 and the total is $12,400.";

console.log("\n── 1. Pricing seal: a number needs a pricing tool, this turn ──");
check(
  "invented pricing with NO tool evidence is replaced by the guard message",
  sealPricingSafety(PRICED, [answer(PRICED)]) === PRICING_GUARD_MESSAGE,
);
check(
  "the same pricing WITH calculateQuotationPricing evidence survives",
  sealPricingSafety(PRICED, [pricingEvidence(), answer(PRICED)]) === PRICED,
);
check(
  "createQuotationDraft is NOT pricing evidence — the exact audit incident",
  sealPricingSafety(PRICED, [draftEvidence(), answer(PRICED)]) === PRICING_GUARD_MESSAGE,
);
check(
  "a DENIED pricing result is not evidence",
  sealPricingSafety(PRICED, [deniedPricing(), answer(PRICED)]) === PRICING_GUARD_MESSAGE,
);
check(
  "a pricing tool that returned no pricing fields is not evidence",
  sealPricingSafety(PRICED, [
    { kind: "tool-result", tool: "calculateQuotationPricing", permissionStatus: "allowed", payload: { note: "nothing" } },
    answer(PRICED),
  ]) === PRICING_GUARD_MESSAGE,
);
check(
  "a reply with no pricing content is untouched",
  sealPricingSafety("The machine is available in three widths.", [answer("x")]) ===
    "The machine is available in three widths.",
);

console.log("\n── 2. Execution seal v1: claiming a lookup happened ──");
const FAKE_EXEC = "I found the customer in our database and pulled the record.";
check(
  "fake execution narration with no tool results is replaced",
  sealExecutionSafety(FAKE_EXEC, [answer(FAKE_EXEC)]) !== FAKE_EXEC,
);
check(
  "the same narration WITH a real tool result survives",
  sealExecutionSafety(FAKE_EXEC, [customerEvidence(), answer(FAKE_EXEC)]) === FAKE_EXEC,
);
check(
  "a denied tool result is not execution evidence",
  sealExecutionSafety(FAKE_EXEC, [
    { kind: "tool-result", tool: "getCustomerByName", permissionStatus: "denied", payload: null },
    answer(FAKE_EXEC),
  ]) !== FAKE_EXEC,
);

console.log("\n── 3. Execution seal v2: placeholders are never legitimate ──");
const PLACEHOLDER = "Customer Name: [Insert Customer Name]\nAddress: [Insert Address]";
check(
  "a placeholder is blocked even WITH a successful customer lookup",
  sealExecutionSafetyV2(PLACEHOLDER, [customerEvidence(), answer(PLACEHOLDER)]) !== PLACEHOLDER,
);

console.log("\n── 4. Text seals ──");
/* The two markup cleaners handle DIFFERENT syntaxes and are easy to confuse:
   cleanAssistantText strips <function=…> / <tool_call> / [tool:…] wrappers
   out of otherwise-good prose, while scrubLeakedToolMarkup handles the raw
   provider tokens (DSML, tool_calls, invoke name=) by CUTTING the reply at
   the first one. Testing one with the other's input passes vacuously — the
   text simply comes back unchanged — so each is given its own syntax here. */
{
  const leaked =
    "Here are the machines you asked about, in three widths.\n<|tool_calls|>{\"name\":\"searchProducts\"}";
  const scrubbed = scrubLeakedToolMarkup(leaked);
  check("scrubLeakedToolMarkup cuts the reply at the first provider marker", !scrubbed.includes("searchProducts"));
  check("scrubLeakedToolMarkup keeps the legitimate prose before the leak", scrubbed.startsWith("Here are the machines"));
  check("scrubLeakedToolMarkup leaves a clean reply alone", scrubLeakedToolMarkup("Three widths are available.") === "Three widths are available.");
}
{
  const wrapped =
    "Here are the machines you asked about.\n<function=searchProducts>{\"query\":\"DD\"}</function>";
  const cleaned = cleanAssistantText(wrapped);
  check("cleanAssistantText strips a <function=…> wrapper", !cleaned.includes("searchProducts"));
  check("cleanAssistantText keeps the surrounding prose", cleaned.startsWith("Here are the machines"));
  check("cleanAssistantText preserves markdown structure (blank lines survive)", cleanAssistantText("Answer.\n\n## Heading\n\nBody").includes("\n\n## Heading"));
}
check(
  "the brand name is forced back to Latin letters",
  normaliseBrandName("مرحبا بك في كوليكس") === "مرحبا بك في Koleex",
);
check(
  "retrieval narration on the first line is dropped",
  !stripProcessNarration("I found what you need\nThe machine is 1.8 m wide.").startsWith("I found"),
);
check(
  "a long first line is NOT treated as an opener",
  stripProcessNarration(`I found ${"x".repeat(200)}\nreal answer`).startsWith("I found"),
);

console.log("\n── 5. The funnel: one entrance, correct order ──");
check(
  "sealFinalReply blocks invented pricing end to end",
  sealFinalReply(PRICED, [answer(PRICED)]) === PRICING_GUARD_MESSAGE,
);
check(
  "sealFinalReply lets evidenced pricing through end to end",
  sealFinalReply(PRICED, [pricingEvidence(), answer(PRICED)]) === PRICED,
);
{
  /* steps[] is what the UI renders. If the sealed text and the answer step
     diverge, the user reads one thing and the transcript records another —
     which is exactly the bug syncLastAnswerStep exists to prevent. */
  const steps = [answer(PRICED)];
  const out = sealFinalReply(PRICED, steps);
  const last = [...steps].reverse().find((s) => s.kind === "answer");
  check("the answer step is synced to the sealed text, so steps[] cannot diverge", last?.text === out);
}

console.log("\n── 6. The attachment exemption is SCOPED ──");
/* A user's own invoice trips every pricing pattern by nature, so v3 and the
   pricing seal stand down when the turn recites an attachment. v1 and v2 must
   NOT: reciting a document never justifies claiming a tool ran. This is the
   regression that was nearly shipped in Phase 1. */
check(
  "with an attached document, evidenced-looking recital survives the pricing seal",
  sealFinalReply(PRICED, [answer(PRICED)], undefined, true) === PRICED,
);
check(
  "without an attached document, the same text is blocked",
  sealFinalReply(PRICED, [answer(PRICED)], undefined, false) === PRICING_GUARD_MESSAGE,
);
check(
  "the attachment exemption does NOT excuse fake execution narration (v1 stays on)",
  sealFinalReply(FAKE_EXEC, [answer(FAKE_EXEC)], undefined, true) !== FAKE_EXEC,
);
check(
  "the attachment exemption does NOT excuse placeholders (v2 stays on)",
  sealFinalReply(PLACEHOLDER, [customerEvidence(), answer(PLACEHOLDER)], undefined, true) !== PLACEHOLDER,
);

console.log("\n── 7. Structure: the funnel keeps one entrance ──");
const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
const sealsIndex = readFileSync("src/lib/server/ai/seals/index.ts", "utf8");
check(
  "the orchestrator no longer defines any seal",
  !/^(export )?function seal[A-Za-z]*\(/m.test(orch),
);
check(
  "the orchestrator still CALLS the funnel (the move was not a delete)",
  /sealFinalReply\(/.test(orch),
);
check(
  "sealFinalReply is defined exactly once",
  (sealsIndex.match(/^export function sealFinalReply\(/m) || []).length === 1,
);
{
  /* Order is asserted by call POSITION inside the funnel body, not by a
     character window between calls — a window is really a test of how long
     the comments are, and it breaks the moment someone documents a guard
     more thoroughly. Positions say what is actually meant: this call happens
     before that one. */
  const body = sealsIndex.slice(sealsIndex.indexOf("export function sealFinalReply("));
  const at = (needle: string) => body.indexOf(needle);
  const order = [
    "scrubLeakedToolMarkup(",
    "isQuotationRequest(",
    "sealExecutionSafety(",
    "sealExecutionSafetyV2(",
    "sealExecutionSafetyV3(",
    "sealPricingSafety(",
    "syncLastAnswerStep(",
  ].map(at);
  check("every documented guard is actually called in the funnel", order.every((i) => i >= 0));
  check(
    "the funnel calls them in the documented order",
    order.every((v, i) => i === 0 || order[i - 1] < v),
  );
}
check(
  "no route reaches around the funnel to a raw model reply",
  !/from "@\/lib\/server\/ai-agent\/orchestrator"[\s\S]{0,200}sealExecutionSafety/.test(
    readFileSync("src/app/api/ai/agent/route.ts", "utf8"),
  ),
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Every case is a call into the real chain — no case is satisfied by source text alone.");
