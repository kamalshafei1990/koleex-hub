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
import { verdictForStatus, probeVoice } from "../src/lib/server/ai/voice/probe";
import { parseVoiceOptions, resolveVoice } from "../src/lib/server/ai/voice/config";
import { buildSessionUpdate, publicVoiceList } from "../src/lib/server/ai/voice/session-config";
import { AI_PROVENANCE_RULE } from "../src/lib/server/ai/prompt-builder";
import { VOICE_TOOL_NAMES } from "../src/lib/server/ai/voice/tools";

let pass = 0;
const failures: string[] = [];
/* A CONDITION MAY THROW, AND A THROW MUST BE A NAMED FAILURE. Applied here for
   the same reason as the other voice suites: a mutation that breaks the
   product should say which guarantee broke, not produce a Node stack trace. */
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
  /* PER ATTEMPT, from the staged table — see validate-voice-tools §2c for why
     the budgets differ by attempt. */
  check("the handshake has a deadline",
    /AbortSignal\.timeout\(budgetMs\)/.test(code) &&
    /const budgetMs = HANDSHAKE_ATTEMPT_BUDGETS_MS\[attempt - 1\]/.test(code));

  /* THE CLIENT MUST NOT NAME THE ENDPOINT. A client that could would be a
     client that could send our key somewhere we did not choose. The url comes
     only from the config module. */
  check("the url comes from the config, never from the request",
    /fetch\(cfg\.sdpUrl,/.test(code));
  /* A voice choice IS now read from the request — but it can only select from
     a server-side catalogue, and it never reaches the vendor url or a header.
     The blanket "no searchParams" ban was the old proxy for that; the
     guarantee is that the fetch is built from the config alone. */
  const vendorCall = code.slice(code.indexOf("fetch(cfg.sdpUrl,"), code.indexOf("} catch (e)", code.indexOf("fetch(cfg.sdpUrl,")));
  check("nothing from the request reaches the vendor url or headers",
    !/searchParams|req\.url|body\./.test(vendorCall));
  check("the only request field read is a voice KEY, resolved against the catalogue",
    (code.match(/searchParams\.get/g) ?? []).length === 1 &&
    /searchParams\.get\("voice"\)/.test(code) &&
    /resolveVoice\(cfg\.voices, requested\)/.test(code));

  /* NOTHING VENDOR-SHAPED MAY TRAVEL BACK. The success path now returns the
     answer BESIDE a session the server authored — deliberately, because the
     browser must not compose that event. What must still be absent is every
     value that identifies the endpoint, the model or the account. */
  const successReturn = code.slice(code.lastIndexOf("return NextResponse.json("));
  check("the success path returns the answer and the authored session, nothing more",
    /sdp: answer, session: payload\.full, session_compact: payload\.compact/.test(successReturn));
  /* BOTH LENGTHS, because only the client can see the channel's size limit but
     shortening a policy is authoring one. Without the compact version there is
     nothing to fall back to and a long policy simply breaks every call. */
  check("and it offers the compact version the client may fall back to",
    /buildVoiceSessionPayload\(voice[,)]/.test(code) && /session_compact/.test(successReturn));
  /* THE TAUGHT INDEX, AND THE THREE THINGS THAT MAKE IT SAFE TO ADD HERE.
     It is what lets a call reach knowledge the owner taught after the session
     was designed — but it is a database read bolted onto the one path in this
     product with a history of timing out, so: it runs AFTER the vendor has
     already answered, it is scoped to the caller's tenant, and it cannot fail
     the call. Losing any one of those turns a nicety into an outage. */
  const afterHandshake = code.slice(code.indexOf("const answer"));
  check("the taught-question index is read after the handshake, never before it",
    afterHandshake.includes("taughtQuestionIndex(") &&
    code.indexOf("taughtQuestionIndex(") > code.indexOf("fetch(cfg.sdpUrl,"));
  check("and it is scoped to the caller's tenant, not the platform",
    /taughtQuestionIndex\(gate\.tenantId, TAUGHT_INDEX_BUDGET_BYTES\)/.test(code) &&
    /tenantId: auth\.tenant_id \?\? null/.test(code));
  check("and a slow or broken knowledge plane loses the index, not the call",
    /Promise\.race\(/.test(code) &&
    /setTimeout\(\(\) => resolve\(\[\]\), TAUGHT_INDEX_TIMEOUT_MS\)/.test(code) &&
    /catch \{[\s\S]{0,400}?taught index unavailable/.test(code) &&
    /let taughtQuestions: string\[\] = \[\];/.test(code));
  check("and the index reaches the full session, never the compact fallback",
    /buildVoiceSessionPayload\(voice, taughtQuestions\)/.test(code));
  /* ── WHERE THIS FUNCTION RUNS, and why it is not where everything else
     runs ────────────────────────────────────────────────────────────────
     Production, on both attempts and repeatedly:

       cause=TypeError/UND_ERR_CONNECT_TIMEOUT afterMs=10389 budgetMs=13000

     That is the TCP connection never opening — not DNS (ENOTFOUND), not a
     refusal (ECONNREFUSED), not TLS, not a reset. An unroutable path is not
     something a route can fix, so the route moved instead.

     A LONE REGION OVERRIDE IS INDISTINGUISHABLE FROM A MISTAKE once the
     person who added it is gone, which is what these assertions are for. */
  {
    const vercelCfg = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      regions?: string[];
      functions?: Record<string, { regions?: string[] }>;
      crons?: unknown[];
    };
    const VOICE_FN = "src/app/api/ai/voice/session/route.ts";
    const pinned = vercelCfg.functions?.[VOICE_FN]?.regions ?? [];
    check("the voice handshake is pinned to its own region",
      pinned.length === 1);
    check("  …and it is NOT the project default it was failing from",
      pinned[0] !== (vercelCfg.regions ?? [])[0]);
    /* ONLY THIS ONE MOVES. The whole app relocating to chase one endpoint
       would be a far larger change than the evidence supports. */
    check("no other function was moved along with it",
      Object.keys(vercelCfg.functions ?? {}).length === 1);
    check("and the project default is untouched",
      JSON.stringify(vercelCfg.regions) === JSON.stringify(["hnd1"]));
    /* Non-vacuity: rewriting vercel.json is how the scheduled work gets
       dropped by accident. */
    check("  …as are the cron jobs that share this file",
      Array.isArray(vercelCfg.crons) && vercelCfg.crons.length === 5);

    /* THE MOVE HAS TO BE OBSERVABLE OR IT CANNOT BE CONFIRMED. `region=` in
       this log is the VENDOR's label; without our own execution region a
       still-failing handshake looks identical to one that never moved. */
    check("a failed handshake reports the region OUR function ran in",
      /from=\$\{process\.env\.VERCEL_REGION \?\? "local"\}/.test(code));
    check("  …distinctly from the vendor's own region label",
      /from=\$\{[^}]*\}[\s\S]{0,60}region=\$\{cfg\.regionLabel\}/.test(code));
  }

  check("and carries no endpoint, model, key or region",
    !/sdpUrl/.test(successReturn) && !/apiKey/.test(successReturn) &&
    !/AI_VOICE_MODEL/.test(successReturn) && !/regionLabel/.test(successReturn));
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

console.log("\n── 3. The probe's verdict table separates the failures that matter ──");
{
  /* THE WHOLE POINT of the probe is that these three are DIFFERENT actions for
     an operator: rotate the key, fix the workspace id, or stop looking because
     it already works. A table that collapsed any two of them would still
     "pass" a test that only checked it returned a string. */
  const bad = verdictForStatus(401);
  const forbidden = verdictForStatus(403);
  const missing = verdictForStatus(404);
  const rejected = verdictForStatus(400);

  check("401 says the credential was rejected", bad.credential_ok === false);
  check("403 is treated as a credential failure too", forbidden.credential_ok === false);
  check("404 is NOT reported as a bad key", missing.credential_ok === false);
  check("400 means the credential was ACCEPTED — the offer was ours to get wrong",
    rejected.credential_ok === true);
  check("422 is accepted the same way as 400", verdictForStatus(422).credential_ok === true);

  /* Distinctness, not mere presence. Three failures that say the same words
     are one failure with three status codes. */
  check("401 and 404 do not give the same advice", bad.verdict !== missing.verdict);
  check("401 names the key variable", bad.verdict.includes("AI_VOICE_API_KEY"));
  check("404 names the base url and the model, which is where a wrong workspace id lives",
    missing.verdict.includes("AI_VOICE_BASE_URL") && missing.verdict.includes("AI_VOICE_MODEL"));
  check("400's verdict says configuration is correct",
    /configured correctly/i.test(rejected.verdict));

  check("429 is a credential success, not a config error",
    verdictForStatus(429).credential_ok === true);
  check("500 does not blame the configuration",
    verdictForStatus(500).credential_ok === true && /vendor/i.test(verdictForStatus(500).verdict));
  check("an unmapped status is reported rather than guessed",
    verdictForStatus(418).credential_ok === false && verdictForStatus(418).verdict.includes("418"));
}

/* Sections 4-6 exercise real async paths, so the rest of the suite runs
   inside an async entry point. tsx compiles to CJS here — top-level await is
   not available. */
void (async () => {
  console.log("\n── 4. The probe spends the key correctly and reports no vendor words ──");
  {
    let seenUrl = "";
    let seenAuth = "";
    let seenType = "";
    let seenBody = "";
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      seenUrl = String(url);
      const h = (init?.headers ?? {}) as Record<string, string>;
      seenAuth = h["Authorization"] ?? "";
      seenType = h["Content-Type"] ?? "";
      seenBody = String(init?.body ?? "");
      return new Response("workspace ws-SECRET-ID quota exceeded", { status: 400 });
    }) as unknown as typeof fetch;

    const out = await probeVoice(GOOD, fakeFetch);
    check("a configured env produces a probe", out !== null);
    check("the probe POSTs to the model-applied url", seenUrl.includes("model=some-model-id"));
    check("the key travels in the Authorization header",
      seenAuth === `Bearer ${GOOD.AI_VOICE_API_KEY}`);
    check("the key is NOT in the url", !seenUrl.includes(GOOD.AI_VOICE_API_KEY));
    check("the content type is SDP", seenType === "application/sdp");
    check("the offer sent is deliberately incomplete — no session can open",
      seenBody.startsWith("v=") && seenBody.length < 32);
    check("a 400 is reported as reachable and credential-ok",
      out!.reachable === true && out!.credential_ok === true && out!.status === 400);

    /* THE VENDOR'S BODY MUST NOT COME BACK. The fake returned a workspace id in
       its error text; none of it may appear in what we hand the operator. */
    const asText = JSON.stringify(out);
    check("the vendor's error body is not echoed", !asText.includes("ws-SECRET-ID"));
    check("the key is not echoed", !asText.includes(GOOD.AI_VOICE_API_KEY));
  }

  console.log("\n── 5. Failure modes of the probe itself ──");
  {
    const unconfigured = await probeVoice({ AI_VOICE_BASE_URL: "https://x.invalid/a" });
    check("an unconfigured env probes nothing rather than throwing", unconfigured === null);

    const throwing = (async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:443"); }) as unknown as typeof fetch;
    const dead = await probeVoice(GOOD, throwing);
    check("an unreachable host is reported, not thrown", dead !== null && dead.reachable === false);
    check("an unreachable host is never credential-ok", dead!.credential_ok === false);
    check("the thrown message — which can carry the resolved host — is not echoed",
      !JSON.stringify(dead).includes("10.1.2.3"));
    check("the unreachable verdict names the variable to check",
      dead!.verdict.includes("AI_VOICE_BASE_URL"));
  }

  console.log("\n── 6. The status route reports voice, and reports it safely ──");
  {
    const code = readFileSync("src/app/api/ai/providers/route.ts", "utf8");
    const bare = strip(code);
    check("voice status is reported without ?probe=1 too",
      /voice: voiceStatus/.test(bare));
    check("the probe result is only attached under ?probe=1",
      /voice: \{ \.\.\.voiceStatus, \.\.\.\(voiceProbe \? \{ probe: voiceProbe \} : \{\}\) \}/.test(bare));
    check("the diagnosis is only sent when voice is NOT configured",
      /voiceIsConfigured \? \{\} : \{ not_configured_because: diagnoseVoiceConfig/.test(bare));
    /* The key must enter this file exactly once, to be handed to the probe, and
     must never be read a second time into anything that gets serialised. */
    const keyReads = bare.match(/process\.env\.AI_VOICE_API_KEY/g) ?? [];
    check("the key is read from the environment exactly once", keyReads.length === 1);
    check("that one read is the env getter passed to the probe",
      /AI_VOICE_API_KEY: process\.env\.AI_VOICE_API_KEY/.test(bare) &&
      /probeVoice\(voiceEnv\(\)\)/.test(bare));
    check("no resolved config value is referenced by the route at all",
      !/apiKey/.test(bare) && !/sdpUrl/.test(bare));
    check("the voice probe overlaps the provider probes rather than serialising",
      bare.indexOf("const voiceProbePromise") < bare.indexOf("const probes = await Promise.all") &&
      bare.indexOf("await voiceProbePromise") > bare.indexOf("const probes = await Promise.all"));
    check("this route is still super-admin only", /if \(!auth\.is_super_admin\)/.test(bare));
  }

  console.log("\n── 7. The voice catalogue is configuration, and the server owns it ──");
  {
    const v = parseVoiceOptions("Ethan:Omar, Chelsie:Layla");
    check("pairs parse into id and label",
      v.length === 2 && v[0].vendorId === "Ethan" && v[0].label === "Omar");
    check("keys are ours, not the vendor's",
      v[0].key === "v1" && v[1].key === "v2" && !v.some((o) => o.key === o.vendorId));
    check("a bare id with no label shows as itself",
      () => parseVoiceOptions("Ethan")[0].label === "Ethan");
    check("whitespace around entries is tolerated",
      () => parseVoiceOptions("  Ethan : Omar  ")[0].vendorId === "Ethan");
    check("a label may contain a colon — only the first splits",
      () => parseVoiceOptions("Ethan:Omar: warm")[0].label === "Omar: warm");

    /* A malformed entry must be DROPPED, not offered: a voice in the picker
       the server would reject is a menu item that fails when chosen. */
    check("an empty entry is dropped", parseVoiceOptions("Ethan:Omar,,Chelsie:Layla").length === 2);
    check("an entry with no id is dropped", parseVoiceOptions(":Nameless,Ethan:Omar").length === 1);
    check("a duplicate id is dropped", parseVoiceOptions("Ethan:Omar,Ethan:Other").length === 1);
    check("no configuration is an empty list, not a failure",
      parseVoiceOptions(undefined).length === 0 && parseVoiceOptions("").length === 0);

    /* THE BROWSER PROPOSES, THE SERVER DISPOSES. */
    check("a known key resolves", resolveVoice(v, "v1")?.vendorId === "Ethan");
    check("an unknown key resolves to nothing", resolveVoice(v, "v9") === null);
    check("no key resolves to nothing", resolveVoice(v, null) === null);
    check("a VENDOR id is not accepted as a key — the client never learns them",
      resolveVoice(v, "Ethan") === null);
  }

  console.log("\n── 8. What the client may know, and what it may not ──");
  {
    const v = parseVoiceOptions("Ethan:Omar,Chelsie:Layla");
    const listed = publicVoiceList(v);
    check("the list carries a key and a label",
      () => listed[0].key === "v1" && listed[0].label === "Omar");
    check("the vendor id never appears in the public list",
      !JSON.stringify(listed).includes("Ethan") && !JSON.stringify(listed).includes("Chelsie"));
    check("and nothing else rides along",
      () => Object.keys(listed[0]).sort().join(",") === "key,label");
  }

  console.log("\n── 9. The session the server authors ──");
  {
    const v = parseVoiceOptions("Ethan:Omar");
    const withVoice = buildSessionUpdate(v[0]);
    const without = buildSessionUpdate(null);

    check("it is a session.update", withVoice.type === "session.update");
    check("a chosen voice is applied as the VENDOR id — the one place it travels",
      withVoice.session.voice === "Ethan");
    check("no choice means no voice field, so the vendor's default is used",
      !("voice" in without.session));
    check("it asks for audio, not text alone",
      JSON.stringify(withVoice.session.modalities) === JSON.stringify(["text", "audio"]));
    check("it requests the user's transcript",
      JSON.stringify(withVoice.session.input_audio_transcription) === JSON.stringify({ enabled: true }));
    check("it configures server-side turn detection",
      (withVoice.session.turn_detection as { type?: string })?.type === "server_vad");
    check("it names both audio formats",
      withVoice.session.input_audio_format === "pcm" && withVoice.session.output_audio_format === "pcm");

    /* THE IDENTITY RULE, AND WHY THIS SECTION INVERTED.

       Shipped with no instructions at all, the model answered "who are you"
       with a vendor's name — spoken aloud, to a user. A voice session carries
       no history and no system message unless this event supplies one, so an
       empty `instructions` was never neutral: it was the model's own idea of
       itself. */
    const instructions = String(withVoice.session.instructions ?? "");
    check("the session carries instructions at all", instructions.length > 0);
    check("it names Koleex AI as what it is",
      /Koleex AI/.test(instructions) && /Koleex International Group/.test(instructions));
    check("it forbids naming any underlying model or provider",
      /NEVER name, hint at, confirm/.test(instructions));
    check("it covers the indirect routes, not just a direct question",
      /joke|hypothetical|roleplay|translation/.test(instructions));
    check("it forbids repeating a provider name that appears in tool output",
      /Never repeat a model or provider name/.test(instructions));

    /* IMPORTED, NOT RESTATED. Two copies of an identity policy drift, and the
       copy that drifts is the one nobody is looking at. */
    const cfgSrc = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
    check("the rule is imported from the text path rather than re-typed",
      /import \{ AI_PROVENANCE_RULE \}/.test(cfgSrc) && /AI_PROVENANCE_RULE \+/.test(cfgSrc));
    check("and it is the SAME text the text path uses",
      instructions.includes(AI_PROVENANCE_RULE));

    /* An operator who could switch this off could switch off the identity
       rule. It is what the product is, not a setting. */
    check("the instructions are not configurable by environment",
      !/process\.env/.test(cfgSrc) && !/AI_VOICE_INSTRUCTIONS/.test(cfgSrc));

    /* Spoken answers are heard, not read. */
    check("it asks for spoken style rather than markdown",
      /No markdown/.test(instructions) && /heard, not read/.test(instructions));

    /* THIS USED TO READ "still no tool definitions — acting by voice is a
       later step", and it was the right assertion while voice could not act
       at all. Voice can now look things up, so the safety property is no
       longer "no tools": it is that voice may only ever run READ-ONLY tools
       the SERVER chose, because a call has no confirmation step and a spoken
       "yes" is audio the model transcribed on the same channel as the
       request.

       Deleting the check when the feature landed would have removed the only
       thing standing between "voice can search" and "voice can draft a
       quotation nobody approved". It is narrowed, not dropped. */
    {
      const declared = (withVoice.session as { tools?: Array<{ name?: string }> }).tools ?? [];
      const names = declared.map((t) => String(t?.name ?? ""));
      check("voice declares only tools on the server's own allow-list",
        names.length > 0 && names.every((n) => VOICE_TOOL_NAMES.includes(n)));
      const WRITEY = /^(create|update|delete|complete|reassign|remember|forget|suggest)/i;
      const writes = names.filter((n) => WRITEY.test(n));
      check(
        writes.length === 0
          ? "and not one of them is a write — a call cannot act, only look up"
          : `A WRITE TOOL IS REACHABLE BY VOICE: ${writes.join(", ")}`,
        writes.length === 0,
      );
      /* The client must not be able to widen it: the list is server-side. */
      check("the allow-list lives on the server, not in the browser bundle",
        /server-only/.test(readFileSync("src/lib/server/ai/voice/tools.ts", "utf8")));
    }
    check("no endpoint, model, key or workspace travels in the session",
      !/aliyun|maas|qwen|dashscope|sk-|ws-pl|Bearer/i.test(JSON.stringify(withVoice)));
  }

  console.log("\n── 10. The route gates GET exactly as it gates POST ──");
  {
    const code2 = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
    const bare = strip(code2);

    /* ONE GATE, SHARED. A second handler with its own copy of the chain is a
       second place for a step to be dropped — and requireInternalUser was
       already omitted from this very route once. */
    check("the auth chain lives in one function", /async function authorize\(/.test(bare));
    /* SLICED TO EACH HANDLER'S OWN BODY. A lazy window of N characters after
       `export async function GET` runs past the end of GET and into POST,
       which does call the gate — so removing GET's gate entirely still
       matched. Each body is now examined alone. */
    const bodyOf = (verb: string) => {
      const at = bare.indexOf(`export async function ${verb}(`);
      if (at === -1) return "";
      const next = ["GET", "POST"]
        .map((v) => bare.indexOf(`export async function ${v}(`, at + 1))
        .filter((i) => i > -1);
      return bare.slice(at, next.length ? Math.min(...next) : bare.length);
    };
    check("GET goes through the gate", /authorize\(req\)/.test(bodyOf("GET")));
    check("GET returns nothing before the gate has passed",
      /if \(gate instanceof NextResponse\) return gate;/.test(bodyOf("GET")));
    check("POST goes through the gate", /authorize\(req\)/.test(bodyOf("POST")));
    check("POST returns nothing before the gate has passed",
      /if \(gate instanceof NextResponse\) return gate;/.test(bodyOf("POST")));
    check("the chain still has all three steps in order",
      bare.indexOf("requireAuth(req)") < bare.indexOf("requireInternalUser(auth)") &&
      bare.indexOf("requireInternalUser(auth)") < bare.indexOf('checkModule(ctx, "AI Voice", "view")'));
    /* CALLED once, not merely NAMED once — the import mentions it too, and
       counting mentions made this assertion fail on a correct file. */
    check("neither verb re-implements a gate",
      (bare.match(/requireInternalUser\(auth\)/g) ?? []).length === 1 &&
      (bare.match(/requireAuth\(req\)/g) ?? []).length === 1 &&
      (bare.match(/checkModule\(ctx, "AI Voice", "view"\)/g) ?? []).length === 1);

    check("GET returns the public list, never the raw catalogue",
      /publicVoiceList\(cfg\.voices\)/.test(bare) && !/voices: cfg\.voices/.test(bare));
    check("an unconfigured deployment offers an empty list rather than an error",
      /cfg \? publicVoiceList\(cfg\.voices\) : \[\]/.test(bare));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("NOT proved here: the SDP exchange itself. This environment cannot reach the vendor — see the header.");

})().catch((e) => {
  /* An unexpected rejection must be a NAMED failure, not an uncaught exception.
     A mutation that made probeVoice rethrow instead of reporting crashed this
     suite with a Node stack trace — which fails CI, but tells whoever reads the
     log nothing about which guarantee broke. */
  console.log(`  ✗ the suite threw instead of asserting: ${e instanceof Error ? e.message : String(e)}`);
  console.log("\nFAILED:\n  · an async section rejected — see above");
  process.exit(1);
});
