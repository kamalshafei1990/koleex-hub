#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   validate:ratings — the monthly rating system's invariants, pinned.

   Phase 1 shipped cycle open/compose/score/transition/finalize. These checks
   hold the design to its rules so a later edit cannot quietly break them:
   the state machine, unassessed≠0, the evidence rule, snapshot-at-open, and
   the shared scoring math (never re-implemented).
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

const compose = readFileSync("src/lib/server/ratings/compose.ts", "utf8");
const cyclesRoute = readFileSync("src/app/api/hr/ratings/cycles/route.ts", "utf8");
const cycleRoute = readFileSync("src/app/api/hr/ratings/cycles/[id]/route.ts", "utf8");
const itemsRoute = readFileSync("src/app/api/hr/ratings/cycles/[id]/items/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261007_rating_cycles.sql", "utf8");

console.log("── 1. The tables exist with the rules in them ──");
for (const t of ["rating_cycles", "rating_items", "rating_summaries", "rating_band_config"]) {
  check(`${t} is created and RLS-locked`, migration.includes(`CREATE TABLE IF NOT EXISTS public.${t}`) &&
    migration.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`));
}
check("score NULL stays unassessed — the check constraint only bounds 0..100",
  /score\s+smallint CHECK \(score BETWEEN 0 AND 100\)/.test(migration) && !/\bscore\s+smallint NOT NULL/.test(migration));
check("one monthly cycle per tenant per month (partial unique index)",
  /rating_cycles_monthly_uq[\s\S]*?WHERE kind = 'monthly'/.test(migration));
check("occasion cycles carry kind/title/occasion_date",
  /kind IN \('monthly', 'occasion'\)/.test(migration) && /occasion_date date/.test(migration));
check("the item row snapshots the requirement (required_score/weight/is_mandatory on the item)",
  /required_score\s+smallint,/.test(migration) && /weight\s+numeric NOT NULL DEFAULT 1/.test(migration));
check("items are unique per cycle+employee+kind+ref",
  /UNIQUE \(cycle_id, employee_id, item_kind, ref_id\)/.test(migration));
check("deltas are stored on the summary (finalized documents never change their story)",
  /delta_overall\s+numeric/.test(migration) && /delta_skills\s+numeric/.test(migration));

console.log("\n── 2. Compose builds from the four layers, idempotently ──");
check("general pool comes from the is_general flag on BOTH libraries",
  /is_general", true/.test(compose) && (compose.match(/is_general/g) ?? []).length >= 2);
check("position layer rides the active PRIMARY assignment",
  /eq\("is_active", true\)/.test(compose) && /eq\("is_primary", true\)/.test(compose));
check("requirements snapshot required_score and weight onto the item",
  /required_score: r\.required_score/.test(compose) && /weight: r\.weight \?\? 1/.test(compose));
check("compose never rewrites existing rows (ignoreDuplicates on the unique key)",
  /ignoreDuplicates: true/.test(compose));
check("terminated employees are excluded",
  /neq\("employment_status", "terminated"\)/.test(compose));
check("employees with no position are reported, not silently general-only",
  /withoutPosition/.test(compose));

console.log("\n── 3. The state machine is enforced server-side ──");
check("the four moves exist with their from-states",
  /start_review: \{ from: \["scoring"\]/.test(cycleRoute) &&
  /reopen_scoring: \{ from: \["review"\]/.test(cycleRoute) &&
  /finalize: \{ from: \["review"\]/.test(cycleRoute) &&
  /publish: \{ from: \["finalized"\]/.test(cycleRoute));
check("a move from the wrong status is a 409, not a silent jump",
  /Cannot \$\{action\} from/.test(cycleRoute));
check("finalize is optimistic — a concurrent finalize loses the race",
  /\.eq\("status", cycle\.status\)/.test(cycleRoute));
check("finalize refuses with the exact missing-mandatory list per employee",
  /missingMandatory/.test(cycleRoute) && /status: 422/.test(cycleRoute));
check("deltas are computed from the previous FINALIZED/PUBLISHED cycle only",
  /in\("status", \["finalized", "published"\]\)/.test(cycleRoute));
check("the band comes from rating_band_config, not a hardcoded table in the route",
  /from\("rating_band_config"\)/.test(cycleRoute));
check("the averages run the skills module's own math — never re-implemented",
  /import \{ weightedScore \} from "@\/lib\/skills\/scoring"/.test(cycleRoute));

console.log("\n── 4. Scoring rules ──");
check("scores write only while the cycle is 'scoring'",
  /cycle\.status !== "scoring"/.test(itemsRoute) && /409/.test(itemsRoute));
check("extreme scores (<30 or >90) require evidence — batch refuses atomically",
  /s < 30 \|\| s > 90/.test(itemsRoute) && /requires an evidence note/.test(itemsRoute));
check("clearing a score (null) also clears scored_by/scored_at",
  /scored_by: score === null \? null/.test(itemsRoute));
check("every score change audits old→new",
  /old_values: \{ score: prev\.score \}, new_values: \{ score \}/.test(itemsRoute));

console.log("\n── 5. Guards ──");
for (const [name, src] of [["cycles list/open", cyclesRoute], ["cycle detail/transition", cycleRoute], ["scoring", itemsRoute]] as const) {
  check(`${name}: auth + HR module gate`,
    /requireAuth\(\)/.test(src) && /requireModule(Access|Action)\(auth, (MODULE)?/.test(src));
}
check("opening the same month twice is a clean 409",
  /error\.code === "23505"/.test(cyclesRoute));

console.log("\n── 6. Phase 3 — the report is born at finalize, delivered at publish ──");
{
  const publish = readFileSync("src/lib/server/ratings/publish.ts", "utf8");
  const catalog = readFileSync("src/lib/reports/catalog.ts", "utf8");
  check("the hr_monthly_rating template exists, confidential, with the four sections",
    /hr\("hr_monthly_rating", "performance", "award"/.test(catalog) && /confidential: true/.test(catalog) &&
    /t\("summary", "text", true\), t\("skills", "list"\), t\("behavior", "list"\), t\("actions", "list"\)/.test(catalog));
  check("finalize generates one submitted+confidential report per employee",
    /generateRatingReports/.test(cycleRoute) && /status: "submitted"/.test(publish) && /confidential: true/.test(publish));
  check("generation is keyed by the cycle — a re-finalize never duplicates reports",
    /eq\("period_key", cycle\.month\.slice\(0, 7\)\)/.test(publish) && /if \(existing && existing\.length > 0\) return \{ created: 0 \}/.test(publish));
  check("the employee is the 'to' reader of their own report; the actor is cc",
    /role: "to" as const/.test(publish) && /role: "cc" as const/.test(publish));
  check("publish notifies recipients once (supersede keyed by report)",
    /notifyRatingPublished\(cycle\)/.test(cycleRoute) && /supersede: \{ report_id/.test(publish));
  check("the improvement list is deterministic until Phase 5 — items below required, weakest first",
    /i\.score < i\.required_score/.test(publish) && /weakest first/.test(publish));
}

console.log("\n── 7. Phase 4 — the calibration overview ──");
{
  const overview = readFileSync("src/app/api/hr/ratings/cycles/[id]/overview/route.ts", "utf8");
  const mod = readFileSync("src/components/hr/modules/Ratings.tsx", "utf8");
  check("the overview is HR-gated and tenant-scoped",
    /requireModuleAccess\(auth, MODULE\)/.test(overview) && /cycle\.tenant_id !== auth\.tenant_id/.test(overview));
  check("it refuses while the cycle is still scoring — the sheet answers there",
    /status === "scoring" \|\| cycle\.status === "draft"/.test(overview) && /409/.test(overview));
  check("extremes without evidence are the review's red flags",
    /i\.score < 30 \|\| i\.score > 90/.test(overview) && /!i\.evidence\?\.trim\(\)/.test(overview));
  check("employee names come from ONE joined read, never per row",
    /from\("koleex_employees"\)\.select\("id, person:person_id\(full_name\)"\)/.test(overview));
  check("the module renders distribution, movers and red flags from the overview",
    /hr\.ratings\.distribution/.test(mod) && /hr\.ratings\.movers/.test(mod) && /extremesNoEvidence/.test(mod));
  check("the overview loads only once the cycle leaves scoring",
    /cycle\.status === "scoring" \|\| cycle\.status === "draft"\) \{ setOverview\(null\)/.test(mod));
}

console.log(failures === 0 ? "\nvalidate:ratings — all checks passed" : `\nvalidate:ratings FAILED — ${failures}`);
process.exit(failures === 0 ? 0 : 1);
