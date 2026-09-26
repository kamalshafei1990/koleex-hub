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
import { stripComments } from "./lib/strip-comments";
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
  /* Owner, from the live preview: the orbits scatter into loose dots below
     40 px, and a chat bubble thinks at 38. Small orbs think with the solving
     sphere; large ones keep the orbits. Checked at the edges of the switch. */
  check("dots: a small orb thinks with the solving sphere, a large one with the orbits",
    dottedLook("thinking", "none", "none", 38).motion === "solving" &&
    dottedLook("thinking", "none", "none", 30).motion === "solving" &&
    dottedLook("thinking", "none", "none", 39.9).motion === "solving" &&
    dottedLook("thinking", "none", "none", 40).motion === "working" &&
    dottedLook("thinking", "none", "none", 200).motion === "working" &&
    /* the same rule for plain work with no named tool */
    dottedLook("processing", "none", "none", 38).motion === "solving");
  check("dots: the small-size rule changes only the orbits — every other state looks the same at any size",
    (["idle", "listening", "speaking", "success", "error"] as AIOrbState[]).every((st) =>
      dottedLook(st, "none", "none", 30).motion === dottedLook(st, "none", "none", 200).motion) &&
    dottedLook("processing", "searching", "none", 30).motion === "searching");
  check("dots: a search is the scan, on both orbs", dottedLook("processing", "searching").motion === "searching");
  /* Owner's choice, 2026-09-23. */
  check("dots: at rest it is the sash, at half its pace", dottedLook("idle").motion === "composing" && dottedLook("idle").speed === 0.5);
  check("dots: a resting orb is never the picture of a thinking one, at any size",
    [30, 38, 72, 104, 200].every((sz) =>
      dottedLook("idle", "none", "none", sz).motion !== dottedLook("thinking", "none", "none", sz).motion));
  check("dots: at rest it moves slower than it speaks, so the call screen tells them apart",
    dottedLook("idle").motion === dottedLook("speaking").motion &&
    dottedLook("idle").speed < dottedLook("speaking").speed);
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
    const code = stripComments(readFileSync(f, "utf8"), { line: "all" });
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
    /if \(draw === "dots"\) \{[\s\S]{0,300}?<DottedOrb \{\.\.\.props\}/.test(chosen));
  /* The dots load only for whoever chose them: a static import put DottedOrb
     and its engine in the chunk every orb route shares, and validate:budgets
     failed on 19 routes. */
  check("wiring: the dotted orb is loaded on demand, never in the shared bundle every aura user downloads",
    /const DottedOrb = lazy<React\.ComponentType<DottedOrbProps>>\(\(\) => import\("\.\/DottedOrb"\)\);/.test(chosen) &&
    /<Suspense fallback=\{null\}>\s*<DottedOrb /.test(chosen) &&
    /* and not next/dynamic, whose loader runtime lands in the shared shell */
    !/from "next\/dynamic"/.test(chosen) &&
    !/^import DottedOrb/m.test(chosen) &&
    walk(srcRoot).every((f) => {
      const rel = f.slice(srcRoot.length + 1).replace(/\\/g, "/");
      if (rel.startsWith("app/ai-orb-lab/") || rel === "components/ai-orb/DottedOrb.tsx") return true;
      /* `import type` is erased at build time and costs nothing. */
      return !/^import (?!type )[^;]*from "(?:@\/components\/ai-orb|\.)\/DottedOrb";/m.test(readFileSync(f, "utf8")) &&
             !/from "thinking-orbs(?:\/engine)?";/.test(readFileSync(f, "utf8"));
    }));

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
    /kx-reduce-motion/.test(dotted) && /prefers-reduced-motion: reduce/.test(dotted) && /if \(still\) \{\s*const f = frameOf\(lookRef\.current, 0\.6\);[\s\S]{0,160}?return;\s*\}/.test(dotted));
  /* ── THE MORPH (owner, 2026-09-23, chosen from six live samples) ──
     A change of motion is the same dots flying into the new shape. */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const morph = require("../src/components/ai-orb/dotted-orb-morph") as typeof import("../src/components/ai-orb/dotted-orb-morph");
  const { morphDots, pairDots, easeInOutCubic, DOTTED_MORPH_MS } = morph;
  check("morph: 800 ms, eased in and out, from 0 to 1 and nowhere else",
    DOTTED_MORPH_MS === 800 && easeInOutCubic(0) === 0 && easeInOutCubic(1) === 1 &&
    Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9 && easeInOutCubic(-1) === 0 && easeInOutCubic(2) === 1 &&
    [0.1, 0.3, 0.5, 0.7, 0.9].every((x, i, a) => i === 0 || easeInOutCubic(x) > easeInOutCubic(a[i - 1])));
  {
    const c = 36;
    const A = Array.from({ length: 7 }, (_, i) => ({ x: c + 20 * Math.cos(i), y: c + 20 * Math.sin(i), r: 1, white: 0.2, a: 1 }));
    const B = Array.from({ length: 12 }, (_, i) => ({ x: c + 10 * Math.cos(i * 0.5), y: c + 10 * Math.sin(i * 0.5), r: 2, white: 0.8, a: 0.5 }));
    const key = (d: { x: number; y: number }) => `${d.x.toFixed(6)},${d.y.toFixed(6)}`;
    const at0 = morphDots(A, B, c, 0), at1 = morphDots(A, B, c, 1);
    check("morph: every dot of both shapes takes part — the longer list sets the count",
      at0.length === 12 && at1.length === 12 && morphDots(B, A, c, 0).length === 12 &&
      new Set(pairDots(A, B, c).map(([p]) => key(p))).size === 7 &&
      new Set(pairDots(A, B, c).map(([, q]) => key(q))).size === 12);
    check("morph: it starts exactly on the old shape and lands exactly on the new one",
      at0.every((d) => A.some((q) => key(q) === key(d))) && at1.every((d) => B.some((q) => key(q) === key(d))) &&
      at1.every((d) => d.r === 2 && Math.abs(d.white - 0.8) < 1e-9 && Math.abs((d.a ?? 1) - 0.5) < 1e-9));
    check("morph: a side with no dots fades rather than flying from nowhere",
      morphDots([], B, c, 0.25).every((d) => Math.abs((d.a ?? 1) - 0.125) < 1e-9) &&
      morphDots(A, [], c, 0.25).every((d) => Math.abs((d.a ?? 1) - 0.75) < 1e-9) && morphDots([], [], c, 0.5).length === 0);
  }
  {
    /* Real shapes, real sizes: every instant of a real change stays inside
       the orb's box — rest to thinking, thinking to a search, and back. */
    let inside = true, detail = "";
    for (const size of [30, 38, 72, 200]) {
      const changes: [AIOrbState, AIOrbState][] = [["idle", "thinking"], ["thinking", "processing"], ["speaking", "listening"], ["success", "idle"]];
      for (const [a, b] of changes) {
        const la = dottedLook(a, a === "processing" ? "searching" : "none", "none", size);
        const lb = dottedLook(b, b === "processing" ? "searching" : "none", "none", size);
        const fa = engine.resolvePreset(la.motion, dottedPreset(size)), fb = engine.resolvePreset(lb.motion, dottedPreset(size));
        for (const e of [0.25, 0.5, 0.75]) {
          const dots = morphDots(engine.MODE_FRAMES[fa.mode](size, 1.3, fa.opts).dots, engine.MODE_FRAMES[fb.mode](size, 0.4, fb.opts).dots, size / 2, e);
          for (const d of dots) if (!(d.x - d.r >= -0.5 && d.x + d.r <= size + 0.5 && d.y - d.r >= -0.5 && d.y + d.r <= size + 0.5)) { inside = false; detail = `${a}→${b}@${size} e=${e}`; }
        }
      }
    }
    check("morph: every instant of a real change of shape stays inside the orb, at every size", inside, detail);
  }
  check("morph: the orb morphs on a change of MOTION, never in stillness, and does not restart its loop to do it",
    /if \(prev\.motion !== motion && !wantsStill\(\)\) \{\s*morphRef\.current = \{ from: prev, start: performance\.now\(\), phase: clockRef\.current\?\.phase \?\? 0 \};/.test(dotted) &&
    /\}, \[size, lightDots, still, stillKey, palette, lowPower\]\);/.test(dotted) &&
    !/\}, \[motion, speed, ink, size, lightDots, still\]\);/.test(dotted) &&
    /paintDots\(morphDots\(from\.dots, to\.dots, size \/ 2, e\)/.test(dotted) &&
    /const p = \(now - m\.start\) \/ DOTTED_MORPH_MS;/.test(dotted));
  check("morph: a change of pace alone (resting to speaking) is smooth — the clock runs on at the new pace instead of restarting",
    /clock\.phase \+= dt \* paceOf\(cur\);/.test(dotted) &&
    /const dt = Math\.min\(0\.1, Math\.max\(0, \(now - clock\.last\) \/ 1000\)\);/.test(dotted) &&
    !/performance\.now\(\) \/ 1000\) \* pace;/.test(dotted));
  /* ── WANDERING (owner, 2026-09-23, Home greeting) ── */
  {
    const { nextWanderMotion, DOTTED_WANDER_MS } = map;
    let neverSame = true, alwaysValid = true;
    const reached = new Map<string, Set<string>>();
    for (const m of DOTTED_MOTIONS) {
      reached.set(m, new Set());
      for (let k = 0; k < 64; k++) {
        const n = nextWanderMotion(m, k / 64);
        if (n === m) neverSame = false;
        if (!DOTTED_MOTIONS.includes(n)) alwaysValid = false;
        reached.get(m)!.add(n);
      }
      for (const edge of [0, 0.999999, 1, -0.5, 7]) {
        const n = nextWanderMotion(m, edge);
        if (n === m || !DOTTED_MOTIONS.includes(n)) alwaysValid = false;
      }
    }
    check("wander: every change is to a different shape, any of the other eight, even at the edges of the random range",
      neverSame && alwaysValid && [...reached.values()].every((set) => set.size === DOTTED_MOTIONS.length - 1) && DOTTED_WANDER_MS === 6000);
  }
  check("wander: only at rest and never in stillness — the moment the assistant works, the orb says so",
    /const wandering = wander && visual === "idle";/.test(dotted) &&
    /if \(!wandering \|\| wantsStill\(\)\) return;/.test(dotted) &&
    /const look: DottedLook = wandering && wanderMotion \? \{ motion: wanderMotion, speed: 1, ink: 1 \} : stateLook;/.test(dotted) &&
    /if \(document\.visibilityState === "hidden"\) return;/.test(dotted));
  check("wander: passed to the dots only — the aura orb has one shape and is never asked",
    /<DottedOrb \{\.\.\.props\} className="" surface=\{surface\} wander=\{wander\} \/>/.test(chosen) &&
    /return <AIOrb \{\.\.\.props\} \/>;/.test(chosen) &&
    /export default function ChosenOrb\(\{ surface, style, wander, \.\.\.props \}/.test(chosen));
  const home = readFileSync(join(srcRoot, "app/page.tsx"), "utf8");
  check("home: the greeting's orb is 112px from md up, one canvas scaled into 72px on a phone, and it wanders",
    /<KoleexGlowOrb state=\{orbState\} greetKey=\{greet\} size=\{112\} wander \/>/.test(home) &&
    /w-\[72px\] h-\[72px\] md:w-\[112px\] md:h-\[112px\]/.test(home) &&
    /max-md:scale-\[0\.6429\]/.test(home) && Math.abs(0.6429 * 112 - 72) < 0.01 &&
    /wander=\{wander\}/.test(glow));
  check("home: the Koleex AI tile draws its orb at 1.8× the icon slot, centred on the slot, so the tile and its label do not move",
    /const AI_TILE_ORB = 1\.8;/.test(home) &&
    /const orbPx = Math\.round\(iconPx \* AI_TILE_ORB\);/.test(home) &&
    /<span className="relative block" style=\{\{ width: iconPx, height: iconPx \}\}>\s*<span className="absolute left-1\/2 top-1\/2 -translate-x-1\/2 -translate-y-1\/2">\s*<AnimatedIcon size=\{orbPx\} animated scaleClass="scale-100" \/>/.test(home));
  const welcome = readFileSync(join(srcRoot, "components/ai/WelcomeCard.tsx"), "utf8");
  check("welcome: the Koleex AI screen's orb is 144px from md up, one canvas scaled into 128px on a phone",
    /<KoleexOrb state="idle" greetKey=\{greet\} size=\{144\} \/>/.test(welcome) &&
    /w-\[128px\] h-\[128px\] md:w-\[144px\] md:h-\[144px\]/.test(welcome) &&
    /max-md:scale-\[0\.8889\]/.test(welcome) && Math.abs(0.8889 * 144 - 128) < 0.01);
  check("dots: the orb hands its own size to the look, so the small-size rule actually reaches a chat bubble",
    /const stateLook = dottedLook\(state, activity, result, size\);/.test(dotted));
  check("dots: the voice moves it on a call (the aura orb's own smoothing, not a second one)",
    /useAudioSmoothing\(rootRef, clamp01\(audioLevel\), audioActive\);/.test(dotted) && /var\(--kx-orb-audio, 0\)/.test(dotted));

  /* ── COLOUR: AURORA FLOW UNDER AURORA, THE BASIC ORB UNDER CORE (owner, 2026-09-23) ── */
  {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ink = require("../src/components/ai-orb/dotted-orb-ink") as typeof import("../src/components/ai-orb/dotted-orb-ink");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const field = require("../src/lib/aurora-field") as typeof import("../src/lib/aurora-field");
    const { dottedPalette, dottedFlows, rampAt, monoInk, tintedInk, auroraTint, auroraNoise, AURORA_RAMP, AURORA_FLOW_RATE } = ink;
    check("colour: only the Aurora style dresses the dots — Core, a missing or an unknown style is the basic orb",
      dottedPalette("aurora") === "aurora" &&
      (["core", "", "Aurora", "AURORA", "glass", null, undefined] as const).every((s) => dottedPalette(s) === "mono"));
    const fieldColours = new Set([...field.AURORA_PALETTES.dark.waves, ...field.AURORA_PALETTES.light.waves].map((c) => c.toUpperCase()));
    check("colour: every stop of the orb's ramp is one of the Aurora field's own colours, top to bottom, on both grounds",
      (["dark", "light"] as const).every((g) => AURORA_RAMP[g].length === 4 && AURORA_RAMP[g].every((c) => fieldColours.has(c.toUpperCase()))));
    const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const same = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
    check("colour: the ramp runs from its first stop to its last and clamps outside, a bad number lands mid-ramp, never NaN",
      (["dark", "light"] as const).every((g) =>
        same(rampAt(g, 0), rgbOf(AURORA_RAMP[g][0])) && same(rampAt(g, 1), rgbOf(AURORA_RAMP[g][3])) &&
        same(rampAt(g, -4), rgbOf(AURORA_RAMP[g][0])) && same(rampAt(g, 9), rgbOf(AURORA_RAMP[g][3])) &&
        rampAt(g, NaN).every(Number.isFinite)));
    let table = true;
    for (const p of ["mono", "aurora"] as const) for (const pr of [20, 64] as const) for (const st of [false, true]) for (const lp of [false, true]) {
      if (dottedFlows(p, pr, st, lp) !== (p === "aurora" && pr === 64 && !st && !lp)) table = false;
    }
    check("colour: the colours ripple only for Aurora at full-size tuning — held still in a chat bubble, in stillness and on a low-power machine",
      table && AURORA_FLOW_RATE > 0 && AURORA_FLOW_RATE < 0.25);
    let monoSame = true;
    for (const dark of [true, false]) for (const w of [-1, 0, 0.13, 0.3, 0.5, 0.77, 1, 3]) for (const a of [0, 0.4, 1]) {
      const ww = Math.min(1, Math.max(0, w));
      const g = Math.round((dark ? 1 - ww : ww) * 255);
      if (monoInk(w, a, dark) !== `rgba(${g},${g},${g},${a})`) monoSame = false;
    }
    check("colour: Core's ink is byte for byte the grey the orb drew before colour existed", monoSame);
    const parse = (css: string) => css.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/)?.slice(1).map(Number) ?? null;
    const luma = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    let depth = true;
    for (const g of ["dark", "light"] as const) for (const u of [0, 0.5, 1]) {
      const tint = rampAt(g, u), darkGround = g === "dark";
      const near = parse(tintedInk(0, tint, 0.7, darkGround)), far = parse(tintedInk(1, tint, 0.7, darkGround));
      if (!near || !far || near[3] !== 0.7 || far[3] !== 0.7 || [...near, ...far].some((v) => v < 0 || v > 255)) { depth = false; continue; }
      if (darkGround ? luma(near) <= luma(far) : luma(near) >= luma(far)) depth = false;
    }
    check("colour: a tinted orb keeps its depth — near dots stand out from far ones on either ground — and the alpha passes through", depth);
    const noise = auroraNoise();
    let inHull = true, moves = false, steady = true;
    for (const g of ["dark", "light"] as const) {
      const stops = AURORA_RAMP[g].map(rgbOf);
      for (let i = 0; i < 40; i++) {
        const x = (i * 37) % 112, y = (i * 53) % 112;
        const c0 = auroraTint(noise, x, y, 112, 0, g), c1 = auroraTint(noise, x, y, 112, 20, g);
        if (!same(c0, auroraTint(noise, x, y, 112, 0, g))) steady = false;
        if (!same(c0, c1)) moves = true;
        for (const c of [c0, c1]) for (let ch = 0; ch < 3; ch++) {
          const vals = stops.map((s) => s[ch]);
          if (c[ch] < Math.min(...vals) - 1e-9 || c[ch] > Math.max(...vals) + 1e-9) inHull = false;
        }
      }
    }
    check("colour: the Aurora colour at a place is one of the ramp's, the same for the same instant, and it drifts as time runs",
      inHull && moves && steady);
    const fresh = field.buildNoise3D();
    check("colour: the orb's ripple IS the field's noise (same seed, same values), built once for the whole page",
      auroraNoise() === noise && [[0.1, 0.2, 0.3], [1.7, -0.4, 5], [12.5, 3.3, 0.01]].every(([a, b, c]) => fresh(a, b, c) === noise(a, b, c)));
    check("colour: the orb follows the style, theme, stillness and low-power flags on <html> live, and redraws when they change",
      /attributeFilter: \["data-theme", "class", "data-kx-skin", "data-kx-lowpower"\],/.test(dotted) &&
      /return dottedPalette\(document\.documentElement\.dataset\.kxSkin\);/.test(dotted) &&
      /return document\.documentElement\.hasAttribute\("data-kx-lowpower"\);/.test(dotted) &&
      /const \[palette, setPalette\] = useState<DottedPalette>\(\(\) => \(typeof document === "undefined" \? "mono" : appPalette\(\)\)\);/.test(dotted) &&
      /\}, \[size, lightDots, still, stillKey, palette, lowPower\]\);/.test(dotted));
    check("colour: Core draws the basic ink and nothing else; Aurora tints by place and ripples only when dottedFlows allows",
      /const noise = palette === "aurora" \? auroraNoise\(\) : null;/.test(dotted) &&
      /noise\s*\? tintedInk\(white, auroraTint\(noise, x, y, size, flowT, ground\), alpha, lightDots\)\s*: monoInk\(white, alpha, lightDots\);/.test(dotted) &&
      /const flows = dottedFlows\(palette, preset, still, lowPower\);/.test(dotted) &&
      /let flowT = flows \? performance\.now\(\) \/ 1000 : 0;/.test(dotted) &&
      /if \(flows\) flowT = now \/ 1000;/.test(dotted) &&
      !/const tone = /.test(dotted) && (dotted.match(/ctx\.(fill|stroke)Style = /g) ?? []).length === 2);
    /* The field is signed-off artwork: moving its palettes and noise out of
       WavyBackground must not change one pixel. Goldens taken from the
       pre-move source (seed 1337) — they match it to the last bit. */
    const golden: [number, number, number, number][] = [
      [0.1, 0.2, 0.3, -0.6295980693333331], [1.7, -0.4, 5, 0.8030933333333328],
      [12.5, 3.3, 0.01, 0.13483848462297537], [0.8, 0.6, 0.0013, 0.0006225995275690617],
    ];
    check("colour: the Aurora field itself is untouched — same five blues per theme, same grounds, same noise to the last bit",
      golden.every(([a, b, c, v]) => fresh(a, b, c) === v) &&
      JSON.stringify(field.AURORA_PALETTES.dark.waves) === JSON.stringify(["#BCD8F0", "#8FB0D4", "#567FB2", "#2E4B6B", "#1B2A3C"]) &&
      JSON.stringify(field.AURORA_PALETTES.light.waves) === JSON.stringify(["#567FB2", "#8FB0D4", "#3E6796", "#A9C4DE", "#7FA9D6"]) &&
      field.AURORA_PALETTES.dark.ground === "#05070C" && field.AURORA_PALETTES.light.ground === "#F4F7FA");
    const wavy = readFileSync(join(srcRoot, "components/ui/WavyBackground.tsx"), "utf8");
    const defs = (function walk(dir: string): number {
      let n = 0;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) n += walk(p);
        else if (/\.(ts|tsx)$/.test(e.name)) n += (readFileSync(p, "utf8").match(/function buildNoise3D\(/g) ?? []).length;
      }
      return n;
    })(srcRoot);
    check("colour: one Aurora in the tree — the wave field takes its palettes and noise from lib/aurora-field and keeps no copy",
      /import \{ AURORA_PALETTES as PALETTES, buildNoise3D \} from "@\/lib\/aurora-field";/.test(wavy) &&
      !/const PALETTES = \{/.test(wavy) && !/const GRAD3 = /.test(wavy) && defs === 1);
  }
}

if (fail > 0) {
  console.error(`\nvalidate:ai-orb FAILED — ${fail} failing, ${pass} passing`);
  process.exit(1);
}
console.log(`validate:ai-orb OK — ${pass} checks passed`);
