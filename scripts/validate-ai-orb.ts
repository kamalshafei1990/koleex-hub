/* validate:ai-orb — behavioural tests for the AI orb status system.
   Same convention as the other validate:* scripts (tsx, exit 1 on fail). */

import {
  ACTIVITY_FAMILY,
  clamp01,
  resolveOrbState,
  STATE_PRIORITY,
  type AIOrbActivity,
  type AIOrbState,
} from "../src/components/ai-orb/ai-orb-types";
import { TOOL_ACTIVITY_MAP, toolActivity } from "../src/components/ai-orb/ai-orb-tool-map";
import { orbStatusLabel } from "../src/components/ai-orb/ai-orb-labels";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ── clamp01 ── */
check("clamp01 clamps negatives", clamp01(-3) === 0);
check("clamp01 clamps >1", clamp01(7) === 1);
check("clamp01 passes mid", clamp01(0.42) === 0.42);
check("clamp01 handles NaN", clamp01(NaN) === 0);
check("clamp01 handles undefined", clamp01(undefined) === 0);
check("clamp01 handles string garbage", clamp01("x" as unknown) === 0);

/* ── result precedence ── */
check("error beats base", resolveOrbState("speaking", "error") === "error");
check("warning beats base", resolveOrbState("processing", "warning") === "warning");
check("success beats base", resolveOrbState("thinking", "success") === "success");
check("none keeps base", resolveOrbState("listening", "none") === "listening");

/* ── priority table sanity ── */
const order: AIOrbState[] = [
  "error", "warning", "success", "speaking", "listening", "transcribing",
  "processing", "thinking", "awakening", "idle", "sleeping",
];
for (let i = 1; i < order.length; i++) {
  check(
    `priority ${order[i - 1]} > ${order[i]}`,
    STATE_PRIORITY[order[i - 1]] > STATE_PRIORITY[order[i]],
  );
}

/* ── tool map: full coverage of the real registry ── */
const REAL_TOOLS = [
  "getUserPermissions", "getInventoryStatus", "getCustomerByName",
  "getCustomerByCode", "listMyCalendar", "createCalendarEvent",
  "getProductDetails", "getPricingRules", "calculateQuotationPricing",
  "createQuotationDraft", "listMyProjects", "listProjectTasks",
  "createProjectTask", "searchProducts", "countProducts", "getCatalogStats",
  "getProductByCode", "listMyPlanning", "createPlanningItem",
  "listMyTodos", "createTodo",
  /* The rest of the registry, mapped the day the activity got a caption:
     an unmapped tool showed "Working on it" under the orb for a web search. */
  "updateTodo", "completeTodo", "reassignTodo", "deleteTodo",
  "updateProjectTask", "completeProjectTask", "deleteProjectTask",
  "updatePlanningItem", "deletePlanningItem", "updateCalendarEvent", "deleteCalendarEvent",
  "getProductFullDetails", "getProductPrice", "listCatalogFamilies", "searchCatalog", "auditProductData",
  "search_web", "search_knowledge", "searchMachineKnowledge", "searchTradeTerms", "suggest_team_knowledge",
  "findTeamMember", "remember_about_user", "forget_about_user", "generate_image", "askUser",
];
check("the web is browsing, so the caption can say where the lookup goes", toolActivity("search_web") === "browsing");
check("a picture is generating, an edit is updating, a question back is reasoning",
  toolActivity("generate_image") === "generating" && toolActivity("updateTodo") === "updating-record" && toolActivity("askUser") === "reasoning");
for (const t of REAL_TOOLS) {
  check(`tool mapped: ${t}`, t in TOOL_ACTIVITY_MAP, "add it to TOOL_ACTIVITY_MAP");
}
check("unknown tool falls back", toolActivity("someFutureTool") === "executing-action");
check("null tool → none", toolActivity(null) === "none");
check("undefined tool → none", toolActivity(undefined) === "none");

/* ── every busy activity has a motion family ── */
const familyless: AIOrbActivity[] = ["none", "waiting-for-user", "requesting-permission"];
for (const [act, fam] of Object.entries(ACTIVITY_FAMILY)) {
  const expectNull = familyless.includes(act as AIOrbActivity);
  check(
    `family for ${act}`,
    expectNull ? fam === null : fam !== null,
  );
}

/* ── labels ── */
check("label: activity wins while processing",
  orbStatusLabel("processing", "searching", "en") === "Searching…");
check("label: zh activity", orbStatusLabel("processing", "reading", "zh") === "阅读中…");
check("label: ar state", orbStatusLabel("thinking", "none", "ar") === "يفكر…");
check("label: unknown lang falls back to en",
  orbStatusLabel("listening", "none", "fr") === "Listening…");
check("label: idle stays brand", orbStatusLabel("idle", "none", "en") === "Koleex AI");

/* ── INDICATOR GEOMETRY LOCK: static source assertions ── */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const orbSrc = readFileSync(join(__dirname, "../src/components/ai-orb/AIOrb.tsx"), "utf8");

check("lock: base geometry 16x48 r8 present",
  orbSrc.includes("width: 16px") && orbSrc.includes("height: 48px") &&
  orbSrc.includes("border-radius: 8px") && orbSrc.includes("box-shadow: 40px 0 0 #fff"));
check("lock: base position 47%/44% present",
  orbSrc.includes("left: 47%") && orbSrc.includes("top: 44%"));
check("lock: single indicator node (twin via box-shadow)",
  orbSrc.includes('className="ind"') && !orbSrc.includes('className="eye'));

/* every state-scoped .ind rule may only touch opacity/filter/transform(scaleY)/animation */
const indRules = [...orbSrc.matchAll(/\.kx-aiorb\.[\w-]+ \.ind \{([^}]*)\}/g)];
check("lock: state .ind rules exist", indRules.length >= 5);
const FORBIDDEN = ["width", "height", "border-radius", "left:", "top:", "margin", "box-shadow", "gap"];
for (const m of indRules) {
  const body = m[1];
  const bad = FORBIDDEN.filter((f) => body.includes(f));
  check(`lock: state rule clean (${m[0].slice(0, 40)}…)`, bad.length === 0, `forbidden: ${bad.join(",")}`);
  const transforms = body.match(/transform:[^;]+/g) ?? [];
  for (const t of transforms) {
    check("lock: transform is translate+scaleY only",
      /translate\(-50%, -50%\)( scaleY\([^)]*\))?/.test(t) && !/rotate|translateX|translateY\(|scaleX/.test(t));
  }
}
/* no cartoon acting keyframes remain */
for (const k of ["kxA-life", "kxA-bounce", "kxA-sway", "kxA-gaze", "kxA-hunt", "kxA-ponder", "kxA-trackline", "kxA-shake", "kxA-eyes"]) {
  check(`no cartoon keyframe: ${k}`, !orbSrc.includes(`@keyframes ${k}`));
}

/* ══ THE SECOND STYLE: "dots" (owner, 2026-09-23) ════════════════════════
   The user chooses the orb in Settings → Koleex AI, and every orb in the Hub
   follows. Three things must hold: the dotted orb means what the aura orb
   means, it draws inside its box at every size the Hub uses, and no surface
   can draw one style while the user chose the other. */
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const engine = require("thinking-orbs/engine") as typeof import("thinking-orbs/engine");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map = require("../src/components/ai-orb/dotted-orb-map") as typeof import("../src/components/ai-orb/dotted-orb-map");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const style = require("../src/components/ai-orb/orb-style") as typeof import("../src/components/ai-orb/orb-style");
  const { dottedLook, dottedPreset, DOTTED_MOTIONS } = map;

  /* Our list of motions IS the engine's list — a motion we name that the
     engine does not know would draw nothing. */
  const engineMotions = Object.keys(engine.STATE_TO_MODE).sort();
  check("dots: our motion list is exactly the engine's", JSON.stringify([...DOTTED_MOTIONS].sort()) === JSON.stringify(engineMotions),
    `ours=${[...DOTTED_MOTIONS].sort().join(",")} engine=${engineMotions.join(",")}`);

  const STATES_ALL = Object.keys(STATE_PRIORITY) as AIOrbState[];
  const ACTS_ALL = Object.keys(ACTIVITY_FAMILY) as AIOrbActivity[];
  const RESULTS_ALL = ["none", "success", "warning", "error"] as const;
  let everyOk = true;
  for (const st of STATES_ALL) for (const a of ACTS_ALL) for (const r of RESULTS_ALL) {
    const l = dottedLook(st, a, r);
    if (!DOTTED_MOTIONS.includes(l.motion) || !(l.speed > 0) || !(l.ink > 0 && l.ink <= 1)) everyOk = false;
  }
  check("dots: every state × activity × result draws a real motion at a sane pace and ink", everyOk);

  check("dots: listening is the waveform", dottedLook("listening").motion === "listening");
  check("dots: speaking is the sash — distinct from listening, so a call shows whose turn it is",
    dottedLook("speaking").motion === "composing" && dottedLook("speaking").motion !== dottedLook("listening").motion);
  check("dots: plain thinking is the orbits", dottedLook("thinking").motion === "working");
  check("dots: a search is the scan, on both orbs", dottedLook("processing", "searching").motion === "searching");
  check("dots: at rest it breathes", dottedLook("idle").motion === "breathing");
  check("dots: a live result wins over the base state, as on the aura orb",
    dottedLook("speaking", "none", "error").motion === "breathing" && dottedLook("speaking", "none", "error").ink < 1 &&
    dottedLook("thinking", "none", "success").motion === "shaping");
  /* One family, one motion: activities the aura orb already groups together
     must not look different on the dotted one. */
  const byFamily = new Map<string, Set<string>>();
  for (const a of ACTS_ALL) {
    const fam = ACTIVITY_FAMILY[a];
    if (!fam) continue;
    if (!byFamily.has(fam)) byFamily.set(fam, new Set());
    byFamily.get(fam)!.add(dottedLook("processing", a).motion);
  }
  check("dots: every activity family maps to exactly one motion", [...byFamily.values()].every((s2) => s2.size === 1));
  check("dots: waiting on the user is a pause, not work",
    dottedLook("processing", "waiting-for-user").motion === "breathing" && dottedLook("processing", "requesting-permission").motion === "breathing");

  check("dots: the inline tuning below 40px, the avatar tuning from 40px",
    dottedPreset(26) === 20 && dottedPreset(38) === 20 && dottedPreset(39.9) === 20 && dottedPreset(40) === 64 && dottedPreset(200) === 64);

  /* Every size the Hub draws, every motion, several instants: dots inside the
     box and a picture that is not empty. The library ships 64 and 20 only;
     this is the proof the geometry holds at the rest. */
  let boxOk = true;
  let boxDetail = "";
  for (const size of [26, 30, 36, 38, 40, 64, 72, 104, 200]) {
    for (const m of DOTTED_MOTIONS) {
      const { mode, opts } = engine.resolvePreset(m, dottedPreset(size));
      for (const t of [0, 0.37, 1.9, 4.2, 11.5]) {
        const f = engine.MODE_FRAMES[mode](size, t, opts);
        if (f.dots.length === 0) { boxOk = false; boxDetail = `${m}@${size} t=${t}: no dots`; }
        for (const d of f.dots) {
          if (!(d.x - d.r >= -0.5 && d.x + d.r <= size + 0.5 && d.y - d.r >= -0.5 && d.y + d.r <= size + 0.5)) {
            boxOk = false; boxDetail = `${m}@${size} t=${t}: dot at ${d.x.toFixed(1)},${d.y.toFixed(1)} r${d.r.toFixed(1)}`;
          }
        }
      }
    }
  }
  check("dots: every motion draws, inside its box, at every size the Hub uses", boxOk, boxDetail);

  /* Mainland China without a VPN: the engine is maths. Nothing in it can
     reach the network. */
  const engineSrc = readFileSync(join(__dirname, "../node_modules/thinking-orbs/dist/engine.es.js"), "utf8");
  check("dots: the engine makes no request and loads nothing at runtime",
    !/fetch\(|XMLHttpRequest|WebSocket|import\(|https?:\/\//.test(engineSrc));

  /* The store. */
  check("style: the two styles, aura first and default",
    JSON.stringify(style.ORB_STYLES) === JSON.stringify(["aura", "dots"]) && style.DEFAULT_ORB_STYLE === "aura");
  check("style: anything unknown reads as the default",
    style.normalizeOrbStyle("dots") === "dots" && style.normalizeOrbStyle("aura") === "aura" &&
    style.normalizeOrbStyle("DOTS") === "aura" && style.normalizeOrbStyle(null) === "aura" && style.normalizeOrbStyle(7) === "aura");
  check("style: without a window it reads the default and writes nothing",
    style.getOrbStyle() === "aura" && (() => { style.setOrbStyle("dots"); return style.getOrbStyle() === "aura"; })());

  /* The account keeps it — and every wholesale save keeps it too. */
  const acSrc = readFileSync(join(__dirname, "../src/lib/access-control.ts"), "utf8");
  check("style: the account type names it, the defaults default it, and withDefaults passes it through",
    /orb\?: "aura" \| "dots";/.test(acSrc) && /ai: DEFAULT_AI_PERSONALIZATION,\s*orb: "aura",/.test(acSrc) &&
    /orb: p\.orb === "dots" \? "dots" : DEFAULT_PREFERENCES\.orb,/.test(acSrc));

  /* THE ONE DOOR. No surface draws a style directly; only ChosenOrb (and the
     admin labs, which exist to show each one) may. */

  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : /\.(tsx|ts)$/.test(n) ? [f] : [];
  });
  const srcRoot = join(__dirname, "../src");
  const direct = walk(srcRoot).filter((f) => {
    const rel = f.slice(srcRoot.length + 1).replace(/\\/g, "/");
    if (rel === "components/ai-orb/ChosenOrb.tsx" || rel.startsWith("app/ai-orb-lab/")) return false;
    /* Code only: a comment that says "never <AIOrb> directly" is the rule
       being written down, not broken. */
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    return /<(AIOrb|DottedOrb)\b/.test(code);
  }).map((f) => f.slice(srcRoot.length + 1));
  check("wiring: no surface draws <AIOrb> or <DottedOrb> directly — every orb goes through <ChosenOrb>",
    direct.length === 0, direct.join(", "));

  const glow = readFileSync(join(srcRoot, "components/ai/KoleexGlowOrb.tsx"), "utf8");
  check("wiring: KoleexGlowOrb (Home, chat, welcome, header, Discuss, launcher) draws the chosen orb",
    /import ChosenOrb from "@\/components\/ai-orb\/ChosenOrb";/.test(glow) && /<ChosenOrb\b/.test(glow));
  const call = readFileSync(join(srcRoot, "components/ai/VoiceCallScreen.tsx"), "utf8");
  check("wiring: the call screen draws the chosen orb, with light dots on its always-dark ground",
    /<ChosenOrb\b[\s\S]{0,600}?surface="dark"/.test(call) && !/import AIOrb from/.test(call));
  const chosen = readFileSync(join(srcRoot, "components/ai-orb/ChosenOrb.tsx"), "utf8");
  check("wiring: ChosenOrb reads the store, and a preview can pin its own style",
    /const chosen = useOrbStyle\(\);/.test(chosen) && /const draw = style \?\? chosen;/.test(chosen) &&
    /if \(draw === "dots"\) return <DottedOrb/.test(chosen));

  const tab = readFileSync(join(srcRoot, "components/settings/tabs/AiTab.tsx"), "utf8");
  check("settings: Koleex AI has the picker — each option shown as its own live orb, applied at once and saved to the account",
    /<OrbPicker accountId=\{account\.id\}/.test(tab) && /<ChosenOrb style=\{style\}/.test(tab) &&
    /setOrbStyle\(style\);\s*void updateAccountPreferences\(accountId, \{ orb: style \}\)/.test(tab) &&
    /role="radiogroup"/.test(tab) && /aria-checked=\{on\}/.test(tab));
  const disp = readFileSync(join(srcRoot, "lib/display-prefs.tsx"), "utf8");
  check("settings: a choice made on another device arrives with the account, ahead of the display guard",
    /syncOrbStyleFromAccount\(account\.preferences\?\.orb\);\s*\/\*[\s\S]*?\*\/\s*if \(Date\.now\(\) < localWriteUntil\) return;/.test(disp));

  const dotted = readFileSync(join(srcRoot, "components/ai-orb/DottedOrb.tsx"), "utf8");
  check("dots: it rests when it cannot be seen, and holds still when the user asked for stillness",
    /new IntersectionObserver/.test(dotted) && /visibilitychange/.test(dotted) &&
    /kx-reduce-motion/.test(dotted) && /prefers-reduced-motion: reduce/.test(dotted) && /if \(still\) \{ draw\(0\.6\); return; \}/.test(dotted));
  check("dots: the voice moves it on a call (the aura orb's own smoothing, not a second one)",
    /useAudioSmoothing\(rootRef, clamp01\(audioLevel\), audioActive\);/.test(dotted) && /var\(--kx-orb-audio, 0\)/.test(dotted));
}

if (fail > 0) {
  console.error(`\nvalidate:ai-orb FAILED — ${fail} failing, ${pass} passing`);
  process.exit(1);
}
console.log(`validate:ai-orb OK — ${pass} checks passed`);
