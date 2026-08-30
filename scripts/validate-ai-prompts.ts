/* ---------------------------------------------------------------------------
   validate:ai-prompts — Phase 2C gate.

   Three system prompts, one per lane. Historically they drifted, because two
   of them were built by the API route and one by the orchestrator, and a rule
   added to "the prompt" was added to whichever one the author had open. The
   symptom users reported was an assistant that knew who they were on one lane
   and not on another.

   So these assertions are deliberately written as "every lane, without
   exception" rather than per-builder spot checks: they call each builder with
   the same fixture and require the load-bearing rules in ALL of them.

   The vendor check is the one worth explaining. The product rule is that
   Koleex AI never names the model or provider behind it — AI_PROVENANCE_RULE
   says so at length. A code COMMENT naming a vendor is harmless: it never
   reaches the model or the user. Prompt TEXT naming one is a product leak. The
   test therefore inspects the built prompt string, which contains no comments
   at all, rather than the source file — the distinction the source-grep in an
   earlier suite could not make.
   --------------------------------------------------------------------------- */

import type { UserContext } from "../src/lib/server/ai-agent/types";
import {
  buildSystemPrompt,
  buildMinimalSystemPrompt,
  buildBrandSystemPrompt,
  buildDegradedSystemPrompt,
  viewerBlockFor,
  buildNowBlock,
} from "../src/lib/server/ai/prompts";

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

const ctx = {
  auth: {
    account_id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    role_id: null,
    department: "Sales",
    is_super_admin: false,
    can_view_private: false,
    username: "mona",
    login_email: "mona@example.com",
    status: "active",
    user_type: "employee",
    viewing_as: false,
    real_account_id: null,
    view_as_kind: null,
    view_as_role_id: null,
  },
  modulePermissions: {},
  allowedSensitiveFields: new Set<string>(),
  department: "Sales",
  isSuperAdmin: false,
  canViewPrivate: false,
  timezone: "Asia/Dubai",
  viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep", department: "Sales", isSuperAdmin: false },
  memory: { prefers: "short answers" },
} as unknown as UserContext;

/* Every lane a user turn can land on, built with one identical context. */
const LANES: Array<[string, string]> = [
  ["agent (tool loop)", buildSystemPrompt(ctx, "en")],
  ["agent · egyptian", buildSystemPrompt(ctx, "ar", { dialect: "egyptian" })],
  ["small talk", buildMinimalSystemPrompt(ctx, "en")],
  ["brand · company", buildBrandSystemPrompt(ctx, "en", "company")],
  ["brand · ai identity", buildBrandSystemPrompt(ctx, "en", "ai")],
  ["brand · both", buildBrandSystemPrompt(ctx, "zh", "both")],
];

/* The degraded lane (no provider configured) is a FOURTH prompt, found only
   because Phase 2C pulled it out of orchestrateNoGroq() where it was
   assembled inline. It was held apart while finding N7 was open — it was the
   one lane missing the viewer block. N7 is closed in 2E, so it now joins the
   others and is held to every property they are, without exception. It is
   exactly the lane where a tired implementation would name the provider it
   cannot reach, so it is the last one that should get a discount. */
const DEGRADED = buildDegradedSystemPrompt(ctx, "en");
LANES.push(["degraded (no provider)", DEGRADED]);

console.log("\n── 1. No lane leaks the vendor ──");
/* The built prompt contains no comments, so a match here is text the model is
   actually given — unlike a grep of the source, where every hit so far has
   been an ordinary code comment. */
const VENDORS = /\b(deepseek|groq|openai|gpt-[0-9]|anthropic|claude|gemini|qwen|dashscope|mistral|llama)\b/i;
for (const [lane, prompt] of LANES) {
  check(`${lane}: names no model or provider`, !VENDORS.test(prompt));
}

check(
  "degraded lane: explicitly forbids naming the provider it cannot reach",
  /never name any provider/i.test(DEGRADED),
);

console.log("\n── 2. Every lane carries the identity rule ──");
for (const [lane, prompt] of LANES) {
  check(`${lane}: carries the provenance rule`, prompt.includes("YOUR IDENTITY (ABSOLUTE RULE)"));
}
for (const [lane, prompt] of LANES) {
  check(`${lane}: calls itself Koleex AI`, /Koleex AI/.test(prompt));
}

console.log("\n── 3. Every lane knows who it is talking to ──");
/* The incident: an agent running inside the user's own authenticated session
   answering "do you know who I am?" with "I have no access to your identity".
   The fix was the viewer block; the risk is a NEW lane forgetting it. */
for (const [lane, prompt] of LANES) {
  check(`${lane}: names the signed-in user`, prompt.includes("mona"));
}
/* The check above is NOT sufficient on its own and was caught being vacuous:
   every builder also ends with a bare "Current user: <username>" line, so a
   lane that dropped the viewer block entirely still passed it. Removing the
   block was the actual incident — the bare line does not tell the model it
   MAY use the name, which is what produced "I have no access to your
   identity". Anchor on a sentence only viewerBlockFor produces. */
const VIEWER_BLOCK_MARKER = "Never say you don't know who they are.";
for (const [lane, prompt] of LANES) {
  check(`${lane}: carries the viewer block, not just a bare username line`, prompt.includes(VIEWER_BLOCK_MARKER));
}

console.log("\n── 4. Blocks behave ──");
check("the viewer block names the person, not just the login", viewerBlockFor(ctx).includes("Mona Adel"));
check("the viewer block carries remembered facts", viewerBlockFor(ctx).includes("short answers"));
/* Anchored on the section HEADING, not on the word "remember": the block
   always contains the instruction "call remember_about_user", so a
   case-insensitive substring test passes or fails for the wrong reason.
   Third time this class of mistake has been caught by writing the test
   before trusting it — see the seals suite for the other two. */
check(
  "an empty memory omits the memory section entirely",
  !viewerBlockFor({ ...ctx, memory: {} } as UserContext).includes("Things they asked you to remember:"),
);
check(
  "a non-empty memory DOES render the section (so the check above is not vacuous)",
  viewerBlockFor(ctx).includes("Things they asked you to remember:"),
);
check("the now-block resolves in the user's timezone, not UTC", buildNowBlock("Asia/Dubai") !== buildNowBlock("America/New_York"));
check("the now-block states a real year", /20\d\d/.test(buildNowBlock("Asia/Dubai")));

console.log("\n── 5. Lane-specific content is still lane-specific ──");
check(
  "the small-talk prompt stays small — it exists to avoid the tool-schema cost",
  buildMinimalSystemPrompt(ctx, "en").length < buildSystemPrompt(ctx, "en").length,
);
check(
  "the agent prompt carries the data-protection rule",
  /data protection|never expose|sensitive/i.test(buildSystemPrompt(ctx, "en")),
);
check(
  "the agent prompt still forbids invented pricing",
  /hallucinate pricing|never hallucinate/i.test(buildSystemPrompt(ctx, "en")),
);
check(
  "the egyptian dialect rule appears only when asked for",
  buildSystemPrompt(ctx, "ar", { dialect: "egyptian" }) !== buildSystemPrompt(ctx, "ar"),
);
check(
  "the brand sections differ from each other",
  buildBrandSystemPrompt(ctx, "en", "company") !== buildBrandSystemPrompt(ctx, "en", "ai"),
);

console.log("\n── 6. A super admin is told so; an ordinary user is not ──");
{
  const sa = { ...ctx, isSuperAdmin: true, auth: { ...ctx.auth, is_super_admin: true } } as UserContext;
  check("the super-admin flag reaches the prompt", buildSystemPrompt(sa, "en").includes("super admin"));
  check("an ordinary user is not described as one", !buildSystemPrompt(ctx, "en").includes("super admin"));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Assertions run on BUILT prompt text, so a code comment can never satisfy one.");
