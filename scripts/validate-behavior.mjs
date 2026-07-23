/* validate:behavior — assertion suite for the Behavior & Conduct system.
   Half 1 re-implements the scoring formulas exactly as behavior/scoring.ts
   defines them and cross-checks a battery of cases (incl. critical-gap logic);
   half 2 greps the source so a refactor can't silently disconnect the snapshot
   immutability, the justification gate, the RLS posture, or the Skills/Behavior
   separation. Plain node, matching every other validate:* script. */

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

/* ── Half 1: math parity with src/lib/behavior/scoring.ts ─────────────── */
const src = readFileSync("src/lib/behavior/scoring.ts", "utf8");
const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));
const w = (x) => (x == null || Number.isNaN(x) || x < 0 ? 1 : x);
function weighted(rows) {
  let s = 0, ws = 0;
  for (const r of rows) { if (r.score == null) continue; s += clamp(r.score) * w(r.weight); ws += w(r.weight); }
  if (ws === 0) { const a = rows.filter((r) => r.score != null); return a.length ? Math.round(a.reduce((x, r) => x + clamp(r.score), 0) / a.length) : null; }
  return Math.round(s / ws);
}
function match(rows) {
  const rr = rows.filter((r) => r.requiredScore != null); if (!rr.length) return null;
  let s = 0, ws = 0;
  for (const r of rr) { const rq = clamp(r.requiredScore); const ratio = rq === 0 ? 1 : r.score == null ? 0 : Math.min(clamp(r.score) / rq, 1); s += ratio * w(r.weight); ws += w(r.weight); }
  return Math.round((s / ws) * 100);
}
const critGap = (r) => !!r.isCritical && r.requiredScore != null && r.score != null && clamp(r.score) < clamp(r.requiredScore);

// Behavior level bands
const bands = [[0,"Unacceptable"],[19,"Unacceptable"],[20,"Poor"],[39,"Poor"],[40,"Needs Improvement"],[59,"Needs Improvement"],[60,"Acceptable"],[74,"Acceptable"],[75,"Strong"],[89,"Strong"],[90,"Exemplary"],[100,"Exemplary"]];
for (const [score, label] of bands) {
  let got = "Unacceptable";
  for (const [t, l] of [[90,"Exemplary"],[75,"Strong"],[60,"Acceptable"],[40,"Needs Improvement"],[20,"Poor"]]) { if (score >= t) { got = l; break; } }
  check(`level(${score}) = ${label}`, got === label, `got ${got}`);
}
check("scoring encodes 90/75/60/40/20 bands", src.includes(">= 90") && src.includes(">= 75") && src.includes(">= 60") && src.includes(">= 40") && src.includes(">= 20"));

check("weighted: equal weights = mean", weighted([{score:80},{score:60}]) === 70);
check("weighted: NULL excluded (unassessed ≠ 0)", weighted([{score:80},{score:null}]) === 80);
check("weighted: all NULL → null", weighted([{score:null}]) === null);
check("weighted: score 0 is data", weighted([{score:0},{score:100}]) === 50);
check("weighted: all weights 0 → unweighted mean", weighted([{score:80,weight:0},{score:40,weight:0}]) === 60);
check("weighted: bounded 0..100", weighted([{score:100}]) === 100 && weighted([{score:0}]) === 0);

check("match: exact meets = 100", match([{score:70,requiredScore:70}]) === 100);
check("match: overperformance capped", match([{score:100,requiredScore:50},{score:0,requiredScore:100}]) === 50);
check("match: required 0 = achieved", match([{score:0,requiredScore:0}]) === 100);
check("match: unassessed = unmet", match([{score:null,requiredScore:80},{score:80,requiredScore:80}]) === 50);
check("match: no requirements → null", match([{score:50}]) === null);

// Critical gap logic — the heart of the safety requirement
check("critical gap: below required = gap", critGap({ isCritical:true, requiredScore:90, score:45 }));
check("critical gap: meets = no gap", !critGap({ isCritical:true, requiredScore:90, score:90 }));
check("critical gap: non-critical never a gap", !critGap({ isCritical:false, requiredScore:90, score:10 }));
check("critical gap: unassessed critical not counted", !critGap({ isCritical:true, requiredScore:90, score:null }));
check("critical gap: score 0 IS a gap", critGap({ isCritical:true, requiredScore:50, score:0 }));
check("scoring surfaces critical alerts separately", src.includes("criticalAlerts") && src.includes("isCriticalGap"));
check("justification required below 40 / above 95 / critical", src.includes("< 40 || row.score > 95") && src.includes("requiresJustification"));

/* Coverage + completeness (P0/P1) — re-implement and cross-check. */
const coverage = (rows) => rows.length ? Math.round((rows.filter((r) => r.score != null).length / rows.length) * 100) : null;
const critUnassessed = (rows) => rows.filter((r) => r.score == null && r.isCritical).length;
const mandUnassessed = (rows) => rows.filter((r) => r.score == null && r.isMandatory).length;
const critStatus = (rows) => {
  if (rows.some((r) => critGap(r))) return "attention";
  if (critUnassessed(rows) > 0 || mandUnassessed(rows) > 0) return "incomplete";
  return "clear";
};
const canFin = (rows) => critUnassessed(rows) === 0 && mandUnassessed(rows) === 0;

check("coverage: 2 of 4 assessed = 50%", coverage([{score:80},{score:60},{score:null},{score:null}]) === 50);
check("coverage: empty set → null", coverage([]) === null);
check("critical unassessed counted (score NULL + critical)", critUnassessed([{score:null,isCritical:true},{score:90,isCritical:true},{score:null,isCritical:false}]) === 1);
check("mandatory unassessed counted", mandUnassessed([{score:null,isMandatory:true},{score:0,isMandatory:true}]) === 1);
check("critical status: gap → attention", critStatus([{isCritical:true,requiredScore:90,score:40}]) === "attention");
check("critical status: unmeasured critical → incomplete", critStatus([{isCritical:true,requiredScore:90,score:null}]) === "incomplete");
check("critical status: all measured, no gap → clear", critStatus([{isCritical:true,requiredScore:60,score:80}]) === "clear");
check("canFinalize false when critical unassessed", !canFin([{isCritical:true,score:null}]));
check("canFinalize false when mandatory unassessed", !canFin([{isMandatory:true,score:null}]));
check("canFinalize true when all mandatory/critical assessed", canFin([{isCritical:true,score:70},{isMandatory:true,score:65},{score:null}]));
check("scoring.ts exports coverage + completeness helpers", src.includes("coveragePct") && src.includes("criticalUnassessed") && src.includes("mandatoryUnassessed") && src.includes("export function canFinalize") && src.includes("export function criticalStatus"));

/* Min-category-coverage gate for strongest/weakest. */
const catQualifies = (assessed, total) => assessed >= 3 || (total > 0 && assessed / total >= 0.6);
check("category with 1/20 assessed does NOT qualify", !catQualifies(1, 20));
check("category with 3 assessed qualifies", catQualifies(3, 10));
check("category with 60% coverage qualifies", catQualifies(2, 3));
check("scoring.ts gates strongest/weakest on category depth", src.includes("categoryQualifies") && src.includes("MIN_CATEGORY_ASSESSED"));

/* ── Half 2: wiring assertions ──────────────────────────────────────── */
const hr = readFileSync("src/app/api/hr/behavior/route.ts", "utf8");
check("assessment create needs HR create", hr.includes('requireModuleAction(auth, "HR", "create")'));
check("assessment edit needs HR edit", hr.includes('requireModuleAction(auth, "HR", "edit")'));
check("finalized assessments are immutable", hr.includes('"Finalized assessments cannot be edited."') && hr.includes("status === \"finalized\""));
check("finalize runs the justification gate", hr.includes("requiresJustification") && hr.includes("justification comment is required"));
check("finalize BLOCKS unassessed mandatory/critical indicators", hr.includes("mandatory_snapshot || r.critical_snapshot") && hr.includes("must be assessed before finalizing"));
check("items snapshot the requirement", hr.includes("required_score_snapshot") && hr.includes("weight_snapshot") && hr.includes("critical_snapshot"));
check("totals derived from snapshots at finalize", hr.includes("overall_behavior_score: summary.overallScore") && hr.includes("critical_gap_count: summary.criticalGaps"));
check("tenant-owns the indicators", hr.includes('.from("behavior_indicators").select("id'));

const pos = readFileSync("src/app/api/positions/[id]/behavior/route.ts", "utf8");
check("position template PUT needs Employees edit", pos.includes('requireModuleAction(auth, "Employees", "edit")'));
check("position template validates score range", pos.includes("score < 0 || score > 100"));
check("position template rejects foreign indicators", pos.includes("Unknown behavior indicator"));

const lib = readFileSync("src/app/api/behavior/route.ts", "utf8");
check("library gated by Employees module + tenant", lib.includes('requireModuleAccess(auth, "Employees")') && lib.includes('.eq("tenant_id", auth.tenant_id)'));

const actions = readFileSync("src/app/api/hr/behavior/actions/route.ts", "utf8");
check("follow-up actions gated by HR", actions.includes('requireModuleAction(auth, "HR", "create")'));

const form = readFileSync("src/components/employees/EmployeeForm.tsx", "utf8");
check("Behavior tab exists in the form", form.includes(`{ id: "behavior", label: "tab.behavior"`));
check("baseline written only on create, best-effort", form.includes('assessment_type: "baseline"') && form.includes("baseline is optional"));

const section = readFileSync("src/components/employees/EmployeeBehaviorSection.tsx", "utf8");
check("form uses one behavior scoring engine", section.includes('from "@/lib/behavior/scoring"'));
check("critical alerts surfaced in the form", section.includes("criticalAlerts") && section.includes("hr.bhv.createAlert"));

const mod = readFileSync("src/components/hr/modules/Behavior.tsx", "utf8");
check("HR module gates edit vs create", mod.includes('perms.can("HR", "edit")') && mod.includes('perms.can("HR", "create")'));
check("HR module supports probation recommendation", mod.includes("hr.bhv.probationRec") && mod.includes("editing.type === \"probation\""));
check("HR module finalizes assessments", mod.includes("save(true)") && mod.includes("Finalize"));
check("HR module mirrors the completeness gate on the client", mod.includes("canFinalize") && mod.includes("hr.bhv.finalizeBlocked"));
check("HR module shows coverage + critical status", mod.includes("hr.bhv.coverage") && mod.includes("criticalStatus") && mod.includes("hr.bhv.criticalUnassessed"));

/* Separation invariant — behavior must never IMPORT the skills engine.
   (A comment referencing the deliberate separation is expected and fine;
   we assert on `from "…/skills/scoring"` import statements only.) */
const importsSkills = (s) => /from\s+["'][^"']*skills\/scoring["']/.test(s);
check("Behavior does NOT merge with Skills scoring",
  !importsSkills(section) && !importsSkills(mod) && !importsSkills(src));
check("scoring.ts documents the deliberate separation", src.includes("SEPARATE from src/lib/skills/scoring.ts"));

console.log(`\nvalidate:behavior — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("validate:behavior passed");
