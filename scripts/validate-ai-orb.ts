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
];
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
import { readFileSync } from "node:fs";
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

if (fail > 0) {
  console.error(`\nvalidate:ai-orb FAILED — ${fail} failing, ${pass} passing`);
  process.exit(1);
}
console.log(`validate:ai-orb OK — ${pass} checks passed`);
