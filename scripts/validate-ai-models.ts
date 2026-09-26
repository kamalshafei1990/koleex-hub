/* ---------------------------------------------------------------------------
   validate:ai-models — the Koleex AI models the user chooses between.

   Owner, 2026-09-23: three providers become three Koleex models — Blink,
   Mind, Deep — plus Auto, the default. What must hold:

     1. The catalog is what the picker shows, in three languages, and it
        never names a vendor.
     2. The client ASKS; the server decides — an unknown or switched-off
        model is Auto.
     3. The chosen model goes first and the others stay behind it as
        failover: a choice can never leave a user without an answer.
     4. The browser is told which Koleex model answered, by Koleex name, and
        never credited to a model when none answered.
     5. The route, the orchestrator and the new endpoint are wired that way.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  KOLEEX_MODELS,
  KOLEEX_SERVING_MODELS,
  KOLEEX_MODEL_INFO,
  DEFAULT_KOLEEX_MODEL,
  normalizeKoleexModel,
  normalizeServingModel,
} from "../src/lib/ai/koleex-models";
import {
  adapterForModel,
  parseDisabledModels,
  resolveRequestedModel,
  servedKoleexModel,
  modelAvailability,
  modelAvailable,
} from "../src/lib/server/ai/provider/koleex-model-slots";
import { preferFirst, chatWithToolsVia, withoutSwitchedOff } from "../src/lib/server/ai/provider/registry";
import { createAutoStats, rankForAuto, RECENT_FAIL_MS, MIN_SAMPLES, SLOW_FACTOR } from "../src/lib/server/ai/router/auto-rank";
import { MODEL_SWITCH_KEYS, isModelSwitchKey, parseSwitchRows, SWITCH_TTL_MS } from "../src/lib/server/ai/provider/model-switches";
import { deepseekAdapter } from "../src/lib/server/ai/provider/adapters/deepseek";
import { openAiCompatibleAdapter, secondFallbackAdapter } from "../src/lib/server/ai/provider/adapters/openai-compatible";
import { createBreaker } from "../src/lib/server/ai/router/circuit-breaker";
import type { ProviderAdapter, TurnOutcome } from "../src/lib/server/ai/provider/types";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

const VENDOR = /deepseek|qwen|dashscope|alibaba|aliyun|grok|x\.ai|xai|openai|gpt|gemini|google|anthropic|claude|llama|mistral|moonshot|kimi|zhipu/i;

async function main() {
  console.log("\n── 1. The catalog ──");
  check("Auto first, then fastest to deepest", JSON.stringify(KOLEEX_MODELS) === JSON.stringify(["auto", "blink", "mind", "deep"]));
  check("three models can serve; Auto is a choice, not one of them", JSON.stringify(KOLEEX_SERVING_MODELS) === JSON.stringify(["blink", "mind", "deep"]));
  check("Auto is the default for everyone (owner decision 3)", DEFAULT_KOLEEX_MODEL === "auto");
  check("every model has a name and a line in English, Chinese and Arabic",
    KOLEEX_MODELS.every((id) => {
      const i = KOLEEX_MODEL_INFO[id];
      return i.id === id && (["en", "zh", "ar"] as const).every((l) => i.name[l].trim().length > 0 && i.blurb[l].trim().length > 0);
    }));
  check("the brand names are the owner's and are not translated",
    (["blink", "mind", "deep"] as const).every((id) =>
      (["en", "zh", "ar"] as const).every((l) => KOLEEX_MODEL_INFO[id].name[l] === `Koleex ${id[0].toUpperCase()}${id.slice(1)}`)));
  check("Mind is text only; Blink, Deep and Auto can hold a call",
    KOLEEX_MODEL_INFO.mind.voice === false && KOLEEX_MODEL_INFO.blink.voice && KOLEEX_MODEL_INFO.deep.voice && KOLEEX_MODEL_INFO.auto.voice);
  const catalogSrc = readFileSync("src/lib/ai/koleex-models.ts", "utf8") + readFileSync("src/lib/ai/koleex-model-ids.ts", "utf8");
  check("the catalog the browser ships names no vendor — not in a name, a line, or a comment",
    !VENDOR.test(catalogSrc) && !VENDOR.test(JSON.stringify(KOLEEX_MODEL_INFO)));
  check("…and it is not server-only, because the picker renders it", !/import "server-only"/.test(catalogSrc));

  console.log("\n── 2. The client asks; the server decides ──");
  check("a known model is itself", normalizeKoleexModel("deep") === "deep" && normalizeKoleexModel("blink") === "blink");
  for (const bad of ["Deep", "turbo", "", " mind", null, undefined, 3, {}, ["mind"]]) {
    check(`…anything else is Auto (${JSON.stringify(bad)})`, normalizeKoleexModel(bad) === "auto");
  }
  check("a served model is one of the three, or null", normalizeServingModel("mind") === "mind" && normalizeServingModel("auto") === null && normalizeServingModel("x") === null);
  const off = parseDisabledModels(" Deep , blink,auto,nope ");
  check("the operator switch reads names, case-insensitively, and can never switch off Auto", off.has("deep") && off.has("blink") && off.size === 2);
  check("no switch at all is nothing switched off", parseDisabledModels(undefined).size === 0 && parseDisabledModels("").size === 0);
  check("a switched-off model is served as Auto", resolveRequestedModel("deep", off) === "auto" && resolveRequestedModel("mind", off) === "mind");
  check("an unknown request is Auto whatever the switch", resolveRequestedModel("gpt", new Set()) === "auto");
  check("a switched-off model is unavailable to the picker", modelAvailable("deep", off) === false);

  console.log("\n── 3. The choice goes first; failover stays ──");
  check("each model stands for its slot, Auto for none",
    adapterForModel("auto") === null && adapterForModel("mind") === deepseekAdapter &&
      adapterForModel("blink") === openAiCompatibleAdapter && adapterForModel("deep") === secondFallbackAdapter);

  const fake = (name: string, out: TurnOutcome | (() => TurnOutcome), configured = true): ProviderAdapter & { calls: number } => {
    const a = {
      name,
      calls: 0,
      configured: () => configured,
      model: () => `${name}-m`,
      chat: async () => {
        a.calls++;
        return typeof out === "function" ? out() : out;
      },
    };
    return a;
  };
  const ok = (text: string): TurnOutcome => ({ ok: true, response: { content: text, toolCalls: [], finishReason: "stop", usage: { inputTokens: null, outputTokens: null } } });
  const down: TurnOutcome = { ok: false, status: 503, bodyText: "down" };
  const req = { messages: [{ role: "user" as const, content: "hi" }], maxTokens: 4, temperature: 0 };

  {
    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", ok("C"));
    check("preferFirst moves the chosen one to the front and keeps the rest in order",
      preferFirst([A, B, C], C).map((x) => x.name).join() === "c,a,b");
    check("…no preference, or one that is not a candidate, changes nothing",
      preferFirst([A, B, C], null).map((x) => x.name).join() === "a,b,c" && preferFirst([A, B], C).map((x) => x.name).join() === "a,b");
    const out = await chatWithToolsVia([A, B, C], req, { prefer: C, breaker: createBreaker() });
    check("the chosen model answers first", out.ok && out.servedBy === "c" && A.calls === 0 && B.calls === 0);
  }
  {
    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", down);
    const out = await chatWithToolsVia([A, B, C], req, { prefer: C, breaker: createBreaker() });
    check("a chosen model that is down fails over — the user is still answered, by the next in order",
      out.ok && out.servedBy === "a" && C.calls === 1 && out.failedOver === true);
  }
  {
    const A = fake("a", ok("A")), C = fake("c", ok("C"), false);
    const out = await chatWithToolsVia([A, C], req, { prefer: C, breaker: createBreaker() });
    check("a chosen model that is not configured is skipped, not attempted", out.ok && out.servedBy === "a" && C.calls === 0);
  }
  {
    const A = fake("a", ok("A")), C = fake("c", down);
    const out = await chatWithToolsVia([A, C], req, { prefer: C, failover: false, breaker: createBreaker() });
    check("the kill-switch still holds: with failover off, the chosen model's failure is the answer", !out.ok && A.calls === 0);
  }

  console.log("\n── 4. The browser is told which Koleex model answered ──");
  const slots = {
    mind: fake("primary", ok("")),
    blink: fake("backup-one", ok("")),
    deep: fake("fallback2", ok(""), false),
  };
  check("a served label maps to its Koleex model by the adapter half only",
    servedKoleexModel("primary:some-model", slots) === "mind" &&
      servedKoleexModel("backup-one:m:fast-small+search", slots) === "blink");
  check("no model is credited when none answered — canned, degraded, none, unknown",
    ["fast-path", "fallback", "none", "unknown", "", null, undefined].every((l) => servedKoleexModel(l, slots) === null));
  check("an unconfigured slot is never credited, even when its placeholder name matches",
    servedKoleexModel("fallback2:x", slots) === null);
  check("a configured model is available until an operator switches it off",
    modelAvailable("mind", new Set(), slots) === true && modelAvailable("mind", parseDisabledModels("mind"), slots) === false);
  check("…and an unconfigured one is never offered", modelAvailable("deep", new Set(), slots) === false);
  const avail = modelAvailability();
  check("the picker's list has the four models, Auto always available",
    avail.map((m) => m.id).join() === "auto,blink,mind,deep" && avail[0].available === true);
  check("…and carries names and booleans only — no vendor, no model id",
    avail.every((m) => Object.keys(m).sort().join() === "available,id") && !VENDOR.test(JSON.stringify(avail)));

  console.log("\n── 5. Wiring ──");
  const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  check("the route resolves the request on the server and derives the preference from it",
    /const chosenModel = resolveRequestedModel\(body\.model, await switchedOffModels\(\)\);\s*const prefer = adapterForModel\(chosenModel\);/.test(route));
  check("every fast-lane call carries the preference (the first, the one after a lookup, the one after a page read)",
    (route.match(/\{ onDelta, prefer \}/g) ?? []).length === 3 && !/\{ onDelta \},/.test(route));
  check("both orchestrator calls carry the chosen model",
    (route.match(/orchestrate\(\{\s*model: chosenModel,/g) ?? []).length === 2);
  check("every response names the Koleex model that answered, next to the public provider label",
    (route.match(/agent: withPublicProvider\(agent\),\s*\/\*[\s\S]*?\*\/\s*model: servedKoleexModel\(agent\.provider\),/g) ?? []).length === 4 &&
      (route.match(/agent: withPublicProvider\(agent\),/g) ?? []).length === 4);
  check("the fast lane labels the provider that SERVED, not the one predicted",
    (route.match(/fastProvider = `\$\{out\.servedBy \? `\$\{out\.servedBy\}:\$\{out\.model \?\? "unknown"\}` : activeProviderLabel\(\)\}:fast-/g) ?? []).length === 2);
  const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
  check("the orchestrator turns the model into a preference and passes it on both calls",
    /model = "auto", isCancelled,\s*\} = input;/.test(orch) && /const prefer = adapterForModel\(model\);/.test(orch) &&
      /\}, \{ prefer \}\);/.test(orch) && /liveEmit \? \{ onDelta: liveEmit, prefer \} : \{ prefer \},/.test(orch));
  const reg = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
  check("the registry reorders only the CONFIGURED candidates, before the breaker",
    /const base = withoutSwitchedOff\(configuredAdapters\(adapters\), opts\?\.exclude\);[\s\S]{0,200}?const candidates = preferFirst\(ranked, opts\?\.prefer \?\? null\);/.test(reg));
  const modelsRoute = readFileSync("src/app/api/ai/models/route.ts", "utf8");
  check("the models endpoint is behind the same door as every Koleex AI endpoint",
    /const auth = await requireAuth\(\);\s*if \(auth instanceof NextResponse\) return auth;\s*const notInternal = requireInternalUser\(auth\);\s*if \(notInternal\) return notInternal;/.test(modelsRoute) &&
      /models: modelAvailability\(off\)/.test(modelsRoute) && /private, no-store/.test(modelsRoute));
  check("…and the versioned path is the same handler", /export \{ GET \} from "\.\.\/\.\.\/\.\.\/ai\/models\/route";/.test(readFileSync("src/app/api/v1/ai/models/route.ts", "utf8")));

  console.log("\n── 6. The picker and the saved choice ──");
  const { withDefaults } = await import("../src/lib/access-control");
  check("the choice is kept on the account and survives every wholesale save",
    withDefaults({ ai_model: "deep" }).ai_model === "deep" && withDefaults({}).ai_model === "auto" &&
      withDefaults({ ai_model: "gpt" as never }).ai_model === "auto");
  const store = readFileSync("src/components/ai/model-choice.ts", "utf8");
  check("the store reads through the catalog's normaliser, and a just-made choice outranks a stale account",
    /normalizeKoleexModel\(localStorage\.getItem\(KEY\)\)/.test(store) &&
      /if \(Date\.now\(\) < localWriteUntil\) return;/.test(store));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the account's choice reaches the store on every account refresh — in the app, not on every route",
    /useEffect\(\(\) => \{\s*if \(account\) syncModelChoiceFromAccount\(account\.preferences\?\.ai_model\);\s*\}, \[account\]\);/.test(app) &&
      !/model-choice|koleex-models"/.test(readFileSync("src/lib/display-prefs.tsx", "utf8")) &&
      !/koleex-models"/.test(readFileSync("src/lib/access-control.ts", "utf8")));
  check("every turn carries the choice, and the send callback re-binds when it changes",
    /model: modelChoice,\s*\}\),\s*signal: aborter\.signal,/.test(app) &&
      /\[input, activeId, lang, stopTts, attachments, webSearch, modelChoice,/.test(app));
  check("both reply paths record who answered, through the served-model normaliser",
    /servedModel: normalizeServingModel\(json\?\.model\),/.test(app) &&
      /servedModel = normalizeServingModel\(json\.model\);/.test(app) &&
      (app.match(/askedModel: modelChoice,/g) ?? []).length === 2);
  check("choosing saves to the account as well as this device",
    /setModelChoice\(m\);[\s\S]{0,500}import\("@\/lib\/accounts-admin"\)\s*\.then\(\(\{ updateAccountPreferences \}\) => updateAccountPreferences\(id, \{ ai_model: m \}\)\)/.test(app));
  const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  check("the reply says who answered only when a chosen model did not",
    /msg\.askedModel && msg\.askedModel !== "auto" && msg\.servedModel && msg\.servedModel !== msg\.askedModel/.test(bubble));
  const picker = readFileSync("src/components/ai/ModelPicker.tsx", "utf8");
  check("the picker asks the server what is available and will not pick an unavailable model",
    /fetch\("\/api\/ai\/models"/.test(picker) && /if \(avail\[id\] === false\) return;/.test(picker));
  check("…and names no vendor", !VENDOR.test(picker) && !VENDOR.test(store));
  const { COPY } = await import("../src/components/ai/copy");
  check("its words exist in English, Chinese and Arabic, and name no vendor",
    (["en", "zh", "ar"] as const).every((l) =>
      ["model", "modelUnavailable", "modelTextOnly", "answeredByModel"].every((k) => {
        const v = (COPY[l] as unknown as Record<string, unknown>)[k];
        return typeof v === "string" && v.trim().length > 0 && !VENDOR.test(v);
      })) && (["en", "zh", "ar"] as const).every((l) => COPY[l].answeredByModel.includes("{model}")));
  check("the button's short name drops only the brand prefix",
    (["blink", "mind", "deep"] as const).every((id) => KOLEEX_MODEL_INFO[id].short.en === KOLEEX_MODEL_INFO[id].name.en.replace(/^Koleex /, "")));

  console.log("\n── 7. The call follows the model ──");
  const { pinnedLaneFor } = await import("../src/lib/voice/voice-pref");
  const open = { wsAvailable: true, fellBack: false };
  check("Blink is the mainland line and Deep the international one; Auto and Mind pin nothing",
    pinnedLaneFor("blink", open) === "rtc" && pinnedLaneFor("deep", open) === "ws" &&
      pinnedLaneFor("auto", open) === null && pinnedLaneFor("mind", open) === null);
  check("Deep that cannot have its line — it failed this screen, or the deployment has none — is answered on the mainland line",
    pinnedLaneFor("deep", { wsAvailable: true, fellBack: true }) === "rtc" && pinnedLaneFor("deep", { wsAvailable: false, fellBack: false }) === "rtc" &&
      pinnedLaneFor("blink", { wsAvailable: false, fellBack: true }) === "rtc");
  const btn = readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("every new call applies the model's line first; a resume keeps the line it had",
    /if \(sessionRef\.current\) return;\s*if \(!opts\?\.resume\) applyModelLane\(\);/.test(btn));
  check("a pin moves the lane; Auto after a pin puts the lane rules back; Auto after Auto touches nothing; Deep off its line says so",
    /if \(\(pinned \|\| lanePinnedRef\.current\) && lane !== transportRef\.current\) \{\s*transportRef\.current = lane;\s*offerLane\(lane\);\s*\}\s*lanePinnedRef\.current = pinned;\s*if \(m === "deep" && lane === "rtc"\) setLaneNote\("international-unreachable"\);/.test(btn));
  check("the lane rules' answer is the same one the button already trusts (the server's word and this device's verdicts), and an unknown deployment counts as having an international line",
    /pinnedLaneFor\(m, \{ wsAvailable: wsKnownRef\.current !== false, fellBack: laneFellBackRef\.current \}\)/.test(btn) &&
      /serverLaneRef\.current \? decideLane\(serverLaneRef\.current, saved, now\)\.lane : startingLane\(saved, now\)/.test(btn));
  check("the call reads the same choice as the composer, and saves a choice made on the call through the parent",
    /const model = useModelChoice\(\);/.test(btn) && /onChooseModel=\{chooseModel\}/.test(app));
  const scr = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the call's settings list the Koleex models by their Koleex names, and a Mind call says it is on Auto",
    /KOLEEX_MODEL_INFO\[m\]\.name\[lang\]/.test(scr) && /\{model === "mind" && laneNote !== "international-unreachable" && \(/.test(scr) && !/Qwen|Grok|DeepSeek|xAI|Alibaba/.test(scr.slice(scr.indexOf("THE MODEL (2026-09-23; the Line"), scr.indexOf("{onSelectTalkMode && ("))));

  console.log("\n── 8. The owner's switches (models 4/4) ──");
  {
    check("one key per model, and only those keys count as switches",
      MODEL_SWITCH_KEYS.mind === "ai_model_off_mind" && MODEL_SWITCH_KEYS.blink === "ai_model_off_blink" && MODEL_SWITCH_KEYS.deep === "ai_model_off_deep" &&
        isModelSwitchKey("ai_model_off_deep") && !isModelSwitchKey("qa_reporter_enabled") && !isModelSwitchKey("ai_model_off_auto") && !isModelSwitchKey(null));
    const off = parseSwitchRows([
      { key: "ai_model_off_deep", value: true },
      { key: "ai_model_off_blink", value: "true" },
      { key: "ai_model_off_mind", value: false },
      { key: "qa_reporter_enabled", value: true },
    ]);
    check("only an explicit true switches a model off; a string, a false or another key never does",
      off.has("deep") && !off.has("blink") && !off.has("mind") && off.size === 1 && parseSwitchRows([]).size === 0);

    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", ok("C"));
    check("a switched-off adapter is dropped; the order of the rest is kept",
      withoutSwitchedOff([A, B, C], new Set([A])).map((x) => x.name).join() === "b,c");
    check("…but switching EVERY model off never leaves a user without an answer: the list is kept",
      withoutSwitchedOff([A, B], new Set([A, B])).map((x) => x.name).join() === "a,b" &&
        withoutSwitchedOff([A, B], undefined).map((x) => x.name).join() === "a,b");
    const out = await chatWithToolsVia([A, B, C], req, { exclude: new Set([A]), breaker: createBreaker() });
    check("Auto with the first model switched off is answered by the next, and never calls the switched-off one",
      out.ok && out.servedBy === "b" && A.calls === 0);
    const D = fake("d", ok("D")), E = fake("e", down);
    const out2 = await chatWithToolsVia([D, E], req, { exclude: new Set([D]), breaker: createBreaker() });
    check("…and a switched-off model is not a failover target while another is configured",
      !out2.ok && D.calls === 0 && E.calls === 1);
    const F = fake("f", ok("F")), G = fake("g", ok("G"), false);
    const out3 = await chatWithToolsVia([F, G], req, { exclude: new Set([F]), breaker: createBreaker() });
    check("…unless it is the only configured model — then it still answers",
      out3.ok && out3.servedBy === "f");

    const sw = readFileSync("src/lib/server/ai/provider/model-switches.ts", "utf8");
    check("the switches are read at most once per half minute, a failed read keeps the last known state, and env and table both count",
      SWITCH_TTL_MS === 30_000 && /if \(cache && now - cache\.at < SWITCH_TTL_MS\) return cache\.off;/.test(sw) &&
        /const kept = cache\?\.off \?\? new Set<KoleexServingModel>\(\);/.test(sw) &&
        /return new Set<KoleexServingModel>\(\[\.\.\.env, \.\.\.table\]\);/.test(sw) &&
        /\.from\("platform_settings"\)\s*\.select\("key, value"\)\s*\.in\("key", \[\.\.\.Object\.values\(MODEL_SWITCH_KEYS\), \.\.\.Object\.values\(FEATURE_SWITCH_KEYS\)\]\)/.test(sw));
    const reg = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
    check("every turn path goes through the one door that reads the switches",
      /export async function chatWithTools\([\s\S]{0,300}?const off = await switchedOffModels\(\);[\s\S]{0,300}?return chatWithToolsVia\(REGISTRY, req, \{ \.\.\.opts, exclude, auto: autoStats \}\);/.test(reg) &&
        /const base = withoutSwitchedOff\(configuredAdapters\(adapters\), opts\?\.exclude\);/.test(reg));
    const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
    check("the chat route resolves the user's choice against the switches",
      /const chosenModel = resolveRequestedModel\(body\.model, await switchedOffModels\(\)\);/.test(route));
    const models = readFileSync("src/app/api/ai/models/route.ts", "utf8");
    check("/api/ai/models answers availability with the switches, and the admin block only to a super admin — names only",
      /models: modelAvailability\(off\)/.test(models) && /if \(auth\.is_super_admin\) \{[\s\S]{0,400}?body\.admin = KOLEEX_SERVING_MODELS\.map/.test(models) &&
        !/model\(\)|\.name\b|providerRoster/.test(models));
    const ps = readFileSync("src/app/api/platform-settings/route.ts", "utf8");
    check("only a super admin can flip a switch, only booleans, only known keys; the switches are not readable by everyone; a flip is live at once on that instance",
      /if \(!auth\.is_super_admin\) \{\s*return NextResponse\.json\(\{ error: "Super admin only" \}, \{ status: 403 \}\);/.test(ps) &&
        /if \(\(!READABLE\.includes\(key\) && !modelSwitch\) \|\| typeof body\.value !== "boolean"\)/.test(ps) &&
        /const READABLE = \["qa_reporter_enabled"\] as const;/.test(ps) && /if \(modelSwitch\) \{\s*[\s\S]{0,200}?invalidateModelSwitches\(\);/.test(ps));
    const vs = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
    const ws = readFileSync("src/app/api/ai/voice/ws-session/route.ts", "utf8");
    check("Koleex Deep switched off also closes its call line; the mainland lane is never switched off from here",
      /const deepOff = \(await switchedOffModels\(\)\)\.has\("deep"\);\s*const grok = deepOff \? null : parseGrokVoiceConfig/.test(vs) &&
        /const deepOff = \(await switchedOffModels\(\)\)\.has\("deep"\);\s*const cfg = deepOff \? null : parseGrokVoiceConfig/.test(ws) &&
        !/has\("blink"\)/.test(vs + ws));
    const tab = readFileSync("src/components/settings/tabs/AiTab.tsx", "utf8");
    check("Settings → Koleex AI shows the switches to a super admin only, by Koleex name, and a model not set up (or off by the server) cannot be flipped",
      /\{account\.is_super_admin && <ModelSwitchesSection t=\{t\} lang=\{lang\} \/>\}/.test(tab) &&
        /label=\{KOLEEX_MODEL_INFO\[r\.id\]\.name\[l\]\}/.test(tab) && /disabled=\{!r\.configured \|\| r\.env_off \|\| saving !== null\}/.test(tab) &&
        /body: JSON\.stringify\(\{ key: `ai_model_off_\$\{id\}`, value: !on \}\)/.test(tab) && !/Qwen|Grok|DeepSeek|xAI|Alibaba/.test(tab));
  }

  console.log("\n── 9. Auto that learns (models 4/4, step 2) ──");
  {
    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", ok("C"));
    const names = (xs: ReadonlyArray<{ name: string }>) => xs.map((x) => x.name).join();
    const t0 = 1_000_000;
    {
      const st = createAutoStats();
      check("with no evidence Auto keeps the registry order", names(rankForAuto([A, B, C], st, t0)) === "a,b,c");
      st.recordFailure("a", t0);
      check("a model that failed in the last two minutes goes behind the healthy ones — still in the list, for failover",
        names(rankForAuto([A, B, C], st, t0 + 1000)) === "b,c,a");
      check("…and comes back to its place once the two minutes pass",
        RECENT_FAIL_MS === 120_000 && names(rankForAuto([A, B, C], st, t0 + RECENT_FAIL_MS + 1)) === "a,b,c");
      st.recordSuccess("a", 400);
      check("…or at once when it answers again", names(rankForAuto([A, B, C], st, t0 + 2000)) === "a,b,c");
      st.recordFailure("b", t0); st.recordFailure("c", t0); st.recordFailure("a", t0);
      check("every model failing recently changes nothing but order — nobody is removed",
        rankForAuto([A, B, C], st, t0 + 1000).length === 3 && names(rankForAuto([A, B, C], st, t0 + 1000)) === "a,b,c");
    }
    {
      const st = createAutoStats();
      for (let i = 0; i < MIN_SAMPLES; i++) { st.recordSuccess("a", 3000); st.recordSuccess("b", 800); }
      check("a model more than twice as slow to its first word as another healthy one moves behind it",
        SLOW_FACTOR === 2 && names(rankForAuto([A, B, C], st, t0)) === "b,c,a");
      const st2 = createAutoStats();
      for (let i = 0; i < MIN_SAMPLES; i++) { st2.recordSuccess("a", 1500); st2.recordSuccess("b", 800); }
      check("…but a model of similar speed keeps the registry's place (the order is a decision, not a race)",
        names(rankForAuto([A, B, C], st2, t0)) === "a,b,c");
      const st3 = createAutoStats();
      for (let i = 0; i < MIN_SAMPLES - 1; i++) { st3.recordSuccess("a", 9000); st3.recordSuccess("b", 100); }
      check("…and only on real evidence: fewer than five answers each moves nothing",
        MIN_SAMPLES === 5 && names(rankForAuto([A, B, C], st3, t0)) === "a,b,c");
    }
    {
      const st = createAutoStats();
      const D = fake("d", down), E = fake("e", ok("E"));
      await chatWithToolsVia([D, E], req, { auto: st, breaker: createBreaker() });
      const out = await chatWithToolsVia([D, E], req, { auto: st, breaker: createBreaker() });
      check("in the loop: a provider fault is learnt, and the next Auto turn goes to the healthy model first",
        out.ok && out.servedBy === "e" && D.calls === 1 && E.calls === 2);
      const out2 = await chatWithToolsVia([D, E], req, { auto: st, prefer: D, breaker: createBreaker() });
      check("…but the user's own choice still goes first", D.calls === 2 && out2.servedBy === "e");
      const F = fake("f", ok("F")), G = fake("g", ok("G"));
      const st2 = createAutoStats();
      await chatWithToolsVia([F, G], req, { auto: st2, breaker: createBreaker() });
      check("…and a success is recorded as the model's time", (st2.get("f")?.samples ?? 0) === 1 && G.calls === 0);
    }
    const reg = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
    check("the live door learns: chatWithTools hands the instance's stats in; the speed is taken to the first word when streaming",
      /return chatWithToolsVia\(REGISTRY, req, \{ \.\.\.opts, exclude, auto: autoStats \}\);/.test(reg) &&
        /const ranked = auto \? rankForAuto\(base, auto\) : base;[\s\S]{0,120}?const candidates = preferFirst\(ranked, opts\?\.prefer \?\? null\);/.test(reg) &&
        /auto\?\.recordSuccess\(adapter\.name, \(firstDeltaAt \|\| Date\.now\(\)\) - attemptAt\);/.test(reg) &&
        /if \(providerFault\) \{\s*breaker\.recordFailure\(adapter\.name\);\s*auto\?\.recordFailure\(adapter\.name\);/.test(reg));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
