import "server-only";

/* GET  /api/hr/ratings/cycles/[id] — cycle detail + per-employee progress
   POST /api/hr/ratings/cycles/[id] — state transitions { action }
         scoring → review → finalized → published; review → scoring (reopen)

   finalize computes every summary (weighted averages through the existing
   skills/scoring.ts math — the same pure functions the skills module runs)
   and stores deltas vs the previous finalized cycle. Finalize refuses while
   a MANDATORY item is unscored, and lists exactly what's missing.
   Publish requires finalized. Nothing here is visible to employees yet —
   the employee view arrives with the report in Phase 3. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { weightedScore } from "@/lib/skills/scoring";

const MODULE = "HR";

type CycleRow = {
  id: string; tenant_id: string; status: string; month: string;
  config: { skills?: number; behavior?: number };
};

async function loadCycle(id: string, tenantId: string | null): Promise<CycleRow | null> {
  const { data } = await supabaseServer
    .from("rating_cycles").select("id, tenant_id, status, month, config")
    .eq("id", id).maybeSingle();
  if (!data) return null;
  if (tenantId && data.tenant_id !== tenantId) return null;
  return data as CycleRow;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { id } = await params;
  const cycle = await loadCycle(id, auth.tenant_id);
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items, error } = await supabaseServer
    .from("rating_items")
    .select("id, employee_id, item_kind, ref_id, scope, required_score, weight, is_mandatory, score, comment, evidence, self_score, scored_by, scored_at")
    .eq("cycle_id", id)
    .order("employee_id")
    .order("item_kind")
    .order("scope");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* Names ride along — two batched lookups for the whole sheet, never one
     per row (China latency rule: one request per screen). */
  const skillRefs = [...new Set((items ?? []).filter((i) => i.item_kind === "skill").map((i) => i.ref_id))];
  const behaviorRefs = [...new Set((items ?? []).filter((i) => i.item_kind === "behavior").map((i) => i.ref_id))];
  const [{ data: skillRows }, { data: behaviorRows }] = await Promise.all([
    skillRefs.length
      ? supabaseServer.from("skills").select("id, name, name_zh, name_ar").in("id", skillRefs)
      : Promise.resolve({ data: [] }),
    behaviorRefs.length
      ? supabaseServer.from("behavior_indicators").select("id, name, name_zh, name_ar").in("id", behaviorRefs)
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = new Map<string, { name: string; name_zh: string | null; name_ar: string | null }>();
  for (const r of skillRows ?? []) nameOf.set(r.id, r);
  for (const r of behaviorRows ?? []) nameOf.set(r.id, r);

  const byEmployee = new Map<string, { total: number; scored: number; missingMandatory: number }>();
  for (const it of items ?? []) {
    const agg = byEmployee.get(it.employee_id) ?? { total: 0, scored: 0, missingMandatory: 0 };
    agg.total += 1;
    if (it.score !== null) agg.scored += 1;
    if (it.is_mandatory && it.score === null) agg.missingMandatory += 1;
    byEmployee.set(it.employee_id, agg);
  }

  return NextResponse.json({
    cycle,
    items: (items ?? []).map((it) => ({ ...it, ...(nameOf.get(it.ref_id) ?? { name: "?", name_zh: null, name_ar: null }) })),
    progress: Object.fromEntries(byEmployee),
  });
}

/* ── finalize: compute + store summaries and deltas ─────────────────────── */

type ItemRow = {
  employee_id: string; item_kind: "skill" | "behavior";
  score: number | null; weight: number | null; is_mandatory: boolean;
};

function bandFor(bands: Array<{ band: string; min_score: number }>, score: number): string {
  let out = bands[0]?.band ?? "critical";
  for (const b of bands) if (score >= b.min_score) out = b.band;
  return out;
}

async function finalizeCycle(cycle: CycleRow) {
  const { data: items } = await supabaseServer
    .from("rating_items")
    .select("employee_id, item_kind, score, weight, is_mandatory")
    .eq("cycle_id", cycle.id);
  const rows = (items ?? []) as ItemRow[];

  /* the gate: unscored mandatory items block finalize, named per employee */
  const gaps = new Map<string, number>();
  for (const it of rows) {
    if (it.is_mandatory && it.score === null) gaps.set(it.employee_id, (gaps.get(it.employee_id) ?? 0) + 1);
  }
  if (gaps.size > 0) {
    return { ok: false as const, missing: Object.fromEntries(gaps) };
  }

  const wSkills = Number(cycle.config?.skills ?? 60) / 100;
  const wBehavior = Number(cycle.config?.behavior ?? 40) / 100;

  const { data: bandsRaw } = await supabaseServer
    .from("rating_band_config").select("band, min_score")
    .eq("tenant_id", cycle.tenant_id).order("min_score", { ascending: true });
  const bands = (bandsRaw ?? []) as Array<{ band: string; min_score: number }>;

  /* previous finalized cycle's summaries, for deltas */
  const { data: prevCycle } = await supabaseServer
    .from("rating_cycles").select("id")
    .eq("tenant_id", cycle.tenant_id).eq("kind", "monthly")
    .in("status", ["finalized", "published"])
    .lt("month", cycle.month).order("month", { ascending: false }).limit(1).maybeSingle();
  const { data: prevSummaries } = prevCycle
    ? await supabaseServer.from("rating_summaries")
        .select("employee_id, overall, skills_avg, behavior_avg").eq("cycle_id", prevCycle.id)
    : { data: [] };
  const prevOf = new Map((prevSummaries ?? []).map((s) => [s.employee_id, s]));

  const byEmp = new Map<string, ItemRow[]>();
  for (const it of rows) byEmp.set(it.employee_id, [...(byEmp.get(it.employee_id) ?? []), it]);

  const summaries = [...byEmp.entries()].map(([employeeId, its]) => {
    const skillsAvg = weightedScore(its.filter((i) => i.item_kind === "skill"));
    const behaviorAvg = weightedScore(its.filter((i) => i.item_kind === "behavior"));
    const overall = skillsAvg !== null && behaviorAvg !== null
      ? Math.round((skillsAvg * wSkills + behaviorAvg * wBehavior) * 100) / 100
      : skillsAvg ?? behaviorAvg; // one side unassessed entirely → the other carries it
    const prev = prevOf.get(employeeId);
    return {
      cycle_id: cycle.id, employee_id: employeeId, tenant_id: cycle.tenant_id,
      skills_avg: skillsAvg, behavior_avg: behaviorAvg, overall,
      band: overall !== null ? bandFor(bands, overall) : null,
      delta_overall: prev?.overall != null && overall !== null
        ? Math.round((overall - Number(prev.overall)) * 100) / 100 : null,
      delta_skills: prev?.skills_avg != null && skillsAvg !== null
        ? Math.round((skillsAvg - Number(prev.skills_avg)) * 100) / 100 : null,
      delta_behavior: prev?.behavior_avg != null && behaviorAvg !== null
        ? Math.round((behaviorAvg - Number(prev.behavior_avg)) * 100) / 100 : null,
    };
  });

  if (summaries.length > 0) {
    const { error } = await supabaseServer.from("rating_summaries").upsert(summaries);
    if (error) throw new Error(error.message);
  }
  return { ok: true as const, summaries: summaries.length };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  const cycle = await loadCycle(id, auth.tenant_id);
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* the state machine, enforced server-side */
  const moves: Record<string, { from: string[]; to: string }> = {
    start_review: { from: ["scoring"], to: "review" },
    reopen_scoring: { from: ["review"], to: "scoring" },
    finalize: { from: ["review"], to: "finalized" },
    publish: { from: ["finalized"], to: "published" },
  };
  const move = action ? moves[action] : undefined;
  if (!move) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!move.from.includes(cycle.status)) {
    return NextResponse.json({ error: `Cannot ${action} from "${cycle.status}".` }, { status: 409 });
  }

  let detail: Record<string, unknown> = {};
  if (action === "finalize") {
    const result = await finalizeCycle(cycle);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Mandatory items are still unscored.", missingMandatory: result.missing },
        { status: 422 },
      );
    }
    detail = { summaries: result.summaries };
  }

  const stamp = action === "finalize" ? { finalized_at: new Date().toISOString() }
    : action === "publish" ? { published_at: new Date().toISOString() } : {};
  const { error } = await supabaseServer.from("rating_cycles")
    .update({ status: move.to, ...stamp, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", cycle.status); // optimistic: another finalize in flight loses
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAudit({
    auth, module: MODULE, action_type: `rating_cycle_${action}`,
    entity_type: "rating_cycle", entity_id: id, entity_label: cycle.month,
    old_values: { status: cycle.status }, new_values: { status: move.to, ...detail },
  });

  return NextResponse.json({ ok: true, status: move.to, ...detail });
}
