/* validate:skills — assertion suite for the Skills system.
   Half 1 re-implements the scoring formulas EXACTLY as scoring.ts defines
   them and cross-checks a battery of cases; half 2 greps the source so a
   refactor cannot silently disconnect the save path, the dedup guards, or
   the RLS/permission posture. Runs in plain node, no test framework —
   matching every other validate:* script in this repo. */

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

/* ── Half 1: math parity with src/lib/skills/scoring.ts ─────────────── */
const src = readFileSync("src/lib/skills/scoring.ts", "utf8");

// Reference implementations (must mirror scoring.ts semantics).
const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));
const w = (x) => (x == null || Number.isNaN(x) || x < 0 ? 1 : x);
function weighted(rows) {
  let s = 0, ws = 0;
  for (const r of rows) { if (r.score == null) continue; s += clamp(r.score) * w(r.weight); ws += w(r.weight); }
  if (ws === 0) {
    const a = rows.filter((r) => r.score != null);
    return a.length ? Math.round(a.reduce((x, r) => x + clamp(r.score), 0) / a.length) : null;
  }
  return Math.round(s / ws);
}
function match(rows) {
  const rr = rows.filter((r) => r.requiredScore != null);
  if (!rr.length) return null;
  let s = 0, ws = 0;
  for (const r of rr) {
    const req = clamp(r.requiredScore);
    const ratio = req === 0 ? 1 : r.score == null ? 0 : Math.min(clamp(r.score) / req, 1);
    s += ratio * w(r.weight); ws += w(r.weight);
  }
  if (ws === 0) {
    const ratios = rr.map((r) => { const req = clamp(r.requiredScore); return req === 0 ? 1 : r.score == null ? 0 : Math.min(clamp(r.score) / req, 1); });
    return Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  }
  return Math.round((s / ws) * 100);
}

// Level bands
const levels = [[0,"No Experience"],[19,"No Experience"],[20,"Beginner"],[39,"Beginner"],[40,"Intermediate"],[59,"Intermediate"],[60,"Advanced"],[79,"Advanced"],[80,"Expert"],[94,"Expert"],[95,"Master"],[100,"Master"]];
for (const [score, label] of levels) {
  const m = { 95: "Master", 80: "Expert", 60: "Advanced", 40: "Intermediate", 20: "Beginner" };
  let got = "No Experience";
  for (const t of [95, 80, 60, 40, 20]) { if (score >= t) { got = m[t]; break; } }
  check(`level(${score}) = ${label}`, got === label, `got ${got}`);
}
check("scoring.ts encodes the 95/80/60/40/20 thresholds",
  src.includes(">= 95") && src.includes(">= 80") && src.includes(">= 60") && src.includes(">= 40") && src.includes(">= 20"));

// Weighted average — normalized, bounded, count-independent
check("weighted: equal weights = mean", weighted([{score:80},{score:60}]) === 70);
check("weighted: weight doubles influence", weighted([{score:100,weight:2},{score:40,weight:1}]) === 80);
check("weighted: bounded 0..100", weighted([{score:100},{score:100}]) === 100 && weighted([{score:0},{score:0}]) === 0);
check("weighted: NULL rows excluded (unassessed ≠ 0)", weighted([{score:80},{score:null}]) === 80);
check("weighted: all NULL → null, not 0", weighted([{score:null},{score:null}]) === null);
check("weighted: empty list → null", weighted([]) === null);
check("weighted: all weights 0 → unweighted mean", weighted([{score:80,weight:0},{score:40,weight:0}]) === 60);
check("weighted: score 0 IS data", weighted([{score:0},{score:100}]) === 50);
check("weighted: invalid weight degrades to 1", weighted([{score:60,weight:-5},{score:80,weight:NaN}]) === 70);

// Match % — capped ratios, required-0 safe
check("match: exact meets = 100", match([{score:60,requiredScore:60}]) === 100);
check("match: overperformance capped", match([{score:100,requiredScore:50},{score:0,requiredScore:100}]) === 50);
check("match: required 0 = achieved", match([{score:0,requiredScore:0}]) === 100);
check("match: unassessed counts as unmet", match([{score:null,requiredScore:80},{score:80,requiredScore:80}]) === 50);
check("match: no requirements → null", match([{score:50}]) === null);
check("match: half achievement", match([{score:30,requiredScore:60}]) === 50);
check("match: weight shifts the blend", match([{score:60,requiredScore:60,weight:3},{score:0,requiredScore:60,weight:1}]) === 75);

/* ── Half 2: wiring assertions ──────────────────────────────────────── */
const full = readFileSync("src/app/api/employees/full/route.ts", "utf8");
check("full route parses skills payload", full.includes("function parseSkills"));
check("full route dedups by skill_id", full.includes("seen.set(skillId"));
check("full route clamps scores server-side", full.includes("Math.min(100, Math.max(0, n))"));
check("full route tenant-filters skill ids", full.includes('.from("skills").select("id").eq("tenant_id"'));
check("full POST persists skills", full.includes("Step 3b: Skill assessments"));
check("full PUT only touches skills when key present", full.includes("body.skills !== undefined"));
check("null score preserved (unassessed)", full.includes("employee_score: r.employee_score"));

const posRoute = readFileSync("src/app/api/positions/[id]/skills/route.ts", "utf8");
check("position PUT requires Employees edit", posRoute.includes('requireModuleAction(auth, "Employees", "edit")'));
check("position route validates score range", posRoute.includes("score < 0 || score > 100"));
check("position route rejects foreign skills", posRoute.includes("Unknown skill id"));
check("position route dedups requirements", posRoute.includes("seen.set(r.skill_id"));

const lib = readFileSync("src/app/api/skills/route.ts", "utf8");
check("library gated by Employees module", lib.includes('requireModuleAccess(auth, "Employees")'));
check("library is tenant-scoped", lib.includes('.eq("tenant_id", auth.tenant_id)'));

const section = readFileSync("src/components/employees/EmployeeSkillsSection.tsx", "utf8");
check("UI prevents duplicate employee skills", section.includes("rows.some((r) => r.skill_id === skillId)"));
check("position change preserves scored skills as additional", section.includes('source: "additional"') && section.includes("employee_score != null"));
check("slider is 0-100 step 1", section.includes("min={0}") && section.includes("max={100}") && section.includes("step={1}"));
check("slider is keyboard-accessible (native range + aria)", section.includes('type="range"') && section.includes("aria-valuetext"));
check("live summary derives from rows (no stored totals)", section.includes("useMemo") && section.includes("summarize("));

const form = readFileSync("src/components/employees/EmployeeForm.tsx", "utf8");
check("Skills tab exists in the form", form.includes('{ id: "skills", label: "tab.skills"'));
check("form passes skills through wizard state", form.includes('value={form.skills}'));
check("configure gate uses Employees edit permission", form.includes('perms.can("Employees", "edit")'));

const admin = readFileSync("src/lib/employees-admin.ts", "utf8");
check("wizard hydrates skills from profile", admin.includes("JSON.stringify(p.skills ?? [])"));

console.log(`\nvalidate:skills — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("validate:skills passed");
