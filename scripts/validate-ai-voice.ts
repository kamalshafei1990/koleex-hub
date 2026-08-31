/* ---------------------------------------------------------------------------
   validate:ai-voice — Phase 15 step 1, the handshake.

   WHAT THIS ROUTE DOES THAT NOTHING ELSE IN THE PRODUCT DOES: it spends the
   vendor API key on a caller's behalf, on a request whose body the caller
   supplies. Everything asserted here follows from that one sentence.

   THE PART THAT CANNOT BE TESTED HERE, said plainly: this environment's egress
   policy refuses to reach the vendor, so the SDP exchange itself can only be
   proved in production. That is exactly why the config lives in a pure module
   this suite runs for real — the untestable surface is one fetch, and the
   route around it is checked by reading it.

   Section 1 is behavioural (real functions, real inputs). Section 2 reads the
   route, and says so rather than pretending otherwise.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  parseVoiceConfig,
  diagnoseVoiceConfig,
  voiceConfigured,
} from "../src/lib/server/ai/voice/config";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const GOOD = {
  AI_VOICE_BASE_URL: "https://example.invalid/api/rtc/v1/realtime",
  AI_VOICE_API_KEY: "sk-secret-value-do-not-leak",
  AI_VOICE_MODEL: "some-model-id",
};

console.log("\n── 1. The config either serves or refuses — never half ──");
{
  const ok = parseVoiceConfig(GOOD);
  check("a complete config parses", ok !== null);
  check("the model is applied by US, not by the caller",
    ok!.sdpUrl.includes("model=some-model-id"));
  check("the base path is preserved", ok!.sdpUrl.includes("/api/rtc/v1/realtime"));
  check("voiceConfigured agrees with parse", voiceConfigured(GOOD) === true);

  /* Each of the three is load-bearing. A handshake that reaches a real
     endpoint with no model is a request that costs money and cannot work. */
  for (const missing of ["AI_VOICE_BASE_URL", "AI_VOICE_API_KEY", "AI_VOICE_MODEL"] as const) {
    const env = { ...GOOD, [missing]: undefined };
    check(`without ${missing} it refuses rather than half-configuring`, parseVoiceConfig(env) === null);
  }
  check("whitespace-only is the same as absent",
    parseVoiceConfig({ ...GOOD, AI_VOICE_API_KEY: "   " }) === null);

  /* There is no configuration in which sending this key over http is right. */
  check("plaintext http is refused, not warned about",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "http://example.invalid/rtc" }) === null);
  check("a malformed url is refused",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "not a url" }) === null);
  /* The trap the AI fallback actually hit: a base copied from a quickstart
     that already carries what the code appends. */
  check("a base that already carries a model is refused rather than doubled",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "https://example.invalid/rtc?model=other" }) === null);

  const label = parseVoiceConfig({ ...GOOD, AI_VOICE_REGION_LABEL: "cn" });
  check("a region label is carried", label!.regionLabel === "cn");
  check("and defaults rather than being empty", parseVoiceConfig(GOOD)!.regionLabel === "default");
}

console.log("\n── 2. The diagnosis names variables, never values ──");
{
  const all = diagnoseVoiceConfig({});
  check("an empty environment names all three", all.length >= 3);
  check("a well-formed one points at the redeploy",
    diagnoseVoiceConfig(GOOD).join(" ").includes("redeploy"));
  check("http is diagnosed as a protocol judgement, not as a url",
    diagnoseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "http://example.invalid/rtc" })
      .some((p) => /not https/.test(p)));

  /* THE ONE THAT MATTERS. Proved as the ABSENCE OF A CLASS: no diagnosis, for
     any input, may contain any VALUE it was given. A version that echoed the
     offending string to be helpful would pass a case-by-case check and fail
     this. */
  const secretish = {
    AI_VOICE_BASE_URL: "http://leak.invalid/workspace-abc123?model=leaked-model",
    AI_VOICE_API_KEY: "sk-secret-value-do-not-leak",
    AI_VOICE_MODEL: "leaked-model",
    AI_VOICE_REGION_LABEL: "leaked-region",
  };
  const text = diagnoseVoiceConfig(secretish).join(" ");
  check("no diagnosis echoes the key", !text.includes("sk-secret-value-do-not-leak"));
  check("no diagnosis echoes the host or workspace", !text.includes("leak.invalid") && !text.includes("workspace-abc123"));
  check("no diagnosis echoes the model id", !text.includes("leaked-model"));
  check("no diagnosis echoes the region label", !text.includes("leaked-region"));
}

console.log("\n── 3. The route, read — the surface a fetch cannot be tested through ──");
{
  const src = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
  const code = strip(src);

  check("it authenticates before anything else", /requireAuth\(req\)/.test(code));
  /* THE DOOR THIS ROUTE'S FIRST DRAFT MISSED. Owner directive 2026-08-03 —
     Koleex AI must not be REACHABLE by a non-internal account type, because
     customer-portal logins share the accounts table and "the tools would deny
     anyway" is not acceptable exposure. validate:ai-api-v1 caught it; it is
     asserted here too, so the route that has it is the one that proves it. */
  check("the internal-account door is closed before any permission reasoning",
    /requireInternalUser\(auth\)/.test(code) &&
    code.indexOf("requireInternalUser") < code.indexOf("checkModule"));
  /* Deny-by-default. checkModule has no open-access fallback, so a user with
     no row is refused — the correct default for a capability that spends
     money per minute. */
  check("access is a permission decision, not a hard-coded role",
    /checkModule\(ctx, "AI Voice", "view"\)/.test(code) && /!decision\.allowed/.test(code));
  check("a budget is consumed after auth and before the vendor",
    code.indexOf("consumeBudget") > code.indexOf("requireAuth") &&
    code.indexOf("consumeBudget") < code.indexOf("fetch("));
  check("the body is size-capped, because we spend our key on it",
    /MAX_SDP_BYTES/.test(code) && /offer\.length > MAX_SDP_BYTES/.test(code));
  check("the handshake has a deadline", /AbortSignal\.timeout\(HANDSHAKE_TIMEOUT_MS\)/.test(code));

  /* THE CLIENT MUST NOT NAME THE ENDPOINT. A client that could would be a
     client that could send our key somewhere we did not choose. The url comes
     only from the config module. */
  check("the url comes from the config, never from the request",
    /fetch\(cfg\.sdpUrl,/.test(code));
  check("no request field is read into the url or headers",
    !/body\.(url|endpoint|region|model)/.test(code) && !/searchParams\.get/.test(code));

  /* NOTHING VENDOR-SHAPED MAY TRAVEL BACK. Absence of a class again: the
     success path returns the answer body and constructs no JSON at all. */
  const successReturn = code.slice(code.lastIndexOf("return new Response(answer"));
  check("the success path returns the answer SDP and nothing else",
    /return new Response\(answer, \{/.test(successReturn) &&
    !/model/.test(successReturn) && !/sdpUrl/.test(successReturn) && !/apiKey/.test(successReturn));
  check("the vendor's error body is logged, never forwarded",
    /detail=\$\{detail\}/.test(code) && !/error: detail/.test(code) && !/error: `.*\$\{detail\}/.test(code));
  check("the config diagnosis goes to the log, not to the caller",
    /console\.error\(`\[ai\.voice\] not configured/.test(code) &&
    !/error: diagnoseVoiceConfig/.test(code));
  /* The key appears exactly once, in the Authorization header it exists for. */
  check("the key is referenced once, in the header",
    (code.match(/cfg\.apiKey/g) ?? []).length === 1 &&
    /Authorization: `Bearer \$\{cfg\.apiKey\}`/.test(code));
  check("the key is never logged", !/console\.\w+\([^)]*apiKey/.test(code));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the SDP exchange itself. This environment cannot reach the vendor — see the header.");
