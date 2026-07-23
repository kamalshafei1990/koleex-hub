import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { summarize, requiresJustification, type BehaviorItem } from "@/lib/behavior/scoring";

/* Behavior assessment lifecycle — the record-based half of the system.
   Assessments are draft → reviewed → finalized. Items snapshot the position
   requirement AS IT STOOD, so a finalized result never drifts when the
   template is edited later. Finalized assessments are immutable.

   GET ?employee_id=X  → assessment headers + current position requirements
   GET ?assessment_id=Y → one assessment with its items
   POST                → create an assessment (draft or baseline), items snapshotted
   PUT ?assessment_id=Y → update a DRAFT; status→finalized freezes it          */

const ASSESSMENT_TYPES = new Set(["baseline","manager","hr_review","probation","periodic","annual","quarterly","incident","self","peer"]);

async function employeeInTenant(id: string, tenantId: string | null) {
  const { data } = await supabaseServer
    .from("koleex_employees")
    .select("id, tenant_id, person_id, employee_number")
    .eq("id", id).maybeSingle();
  if (!data) return null;
  if (tenantId && data.tenant_id && data.tenant_id !== tenantId) return null;
  return data;
}

async function currentPositionId(personId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("koleex_assignments").select("position_id")
    .eq("person_id", personId).eq("is_active", true).eq("is_primary", true).maybeSingle();
  return data?.position_id ?? null;
}

async function positionRequirements(positionId: string | null) {
  if (!positionId) return [] as { behavior_indicator_id: string; required_score: number; weight: number; is_mandatory: boolean; is_critical: boolean; sort_order: number }[];
  const { data } = await supabaseServer
    .from("position_behavior_requirements")
    .select("behavior_indicator_id, required_score, weight, is_mandatory, is_critical, sort_order")
    .eq("position_id", positionId).order("sort_order");
  return data ?? [];
}

/* Turn stored items into engine rows (categoryId resolved by the caller). */
function toEngineRows(
  items: { employee_score: number | null; required_score_snapshot: number | null; weight_snapshot: number | null; mandatory_snapshot: boolean; critical_snapshot: boolean; behavior_indicator_id: string }[],
  catByIndicator: Map<string, string>,
): BehaviorItem[] {
  return items.map((i) => ({
    score: i.employee_score,
    weight: i.weight_snapshot,
    requiredScore: i.required_score_snapshot,
    isMandatory: i.mandatory_snapshot,
    isCritical: i.critical_snapshot,
    categoryId: catByIndicator.get(i.behavior_indicator_id),
  }));
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "HR");
  if (deny) return deny;

  const url = new URL(req.url);
  const assessmentId = url.searchParams.get("assessment_id");

  if (assessmentId) {
    const { data: a } = await supabaseServer
      .from("employee_behavior_assessments").select("*").eq("id", assessmentId).maybeSingle();
    if (!a || (auth.tenant_id && a.tenant_id && a.tenant_id !== auth.tenant_id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: items } = await supabaseServer
      .from("employee_behavior_assessment_items")
      .select("behavior_indicator_id, source, employee_score, required_score_snapshot, weight_snapshot, mandatory_snapshot, critical_snapshot, comment, evidence")
      .eq("assessment_id", assessmentId);
    return NextResponse.json({ assessment: a, items: items ?? [] });
  }

  const employeeId = url.searchParams.get("employee_id");
  if (!employeeId) return NextResponse.json({ error: "employee_id or assessment_id required" }, { status: 400 });
  const emp = await employeeInTenant(employeeId, auth.tenant_id);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const positionId = await currentPositionId(emp.person_id);
  const [{ data: assessments }, requirements] = await Promise.all([
    supabaseServer
      .from("employee_behavior_assessments")
      .select("id, assessment_type, status, assessment_period_start, assessment_period_end, review_date, finalized_at, overall_behavior_score, position_behavior_match, critical_gap_count, recommendation, assessed_by, created_at")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false }),
    positionRequirements(positionId),
  ]);
  return NextResponse.json({
    assessments: assessments ?? [],
    requirements,
    position_id: positionId,
  });
}

interface ItemIn {
  behavior_indicator_id?: string;
  source?: "position" | "additional";
  employee_score?: number | null;
  comment?: string | null;
  evidence?: string | null;
}

/** Validate + snapshot the items for a NEW assessment. Position items snapshot
    the live requirement; additional items snapshot the indicator's critical
    default and no requirement. Returns rows ready to insert + the engine rows. */
async function buildItems(
  tenantId: string | null,
  assessmentId: string,
  rawItems: ItemIn[],
  positionId: string | null,
) {
  const reqs = await positionRequirements(positionId);
  const reqByInd = new Map(reqs.map((r) => [r.behavior_indicator_id, r]));

  const seen = new Map<string, ItemIn>();
  for (const it of rawItems) {
    if (!it.behavior_indicator_id || typeof it.behavior_indicator_id !== "string") continue;
    seen.set(it.behavior_indicator_id, it);
  }
  const indIds = [...seen.keys()];
  if (!indIds.length) return { rows: [], error: null as string | null };

  /* Tenant-own the indicators + pull critical defaults for additional items. */
  const { data: owned } = await supabaseServer
    .from("behavior_indicators").select("id, is_critical_default")
    .eq("tenant_id", tenantId).in("id", indIds);
  const ownedMap = new Map((owned ?? []).map((s) => [s.id, s.is_critical_default as boolean]));

  const rows: Record<string, unknown>[] = [];
  for (const [indId, it] of seen) {
    if (!ownedMap.has(indId)) return { rows: [], error: "Unknown behavior indicator id" };
    let score: number | null = null;
    if (it.employee_score != null && (it.employee_score as unknown) !== "") {
      const n = Math.round(Number(it.employee_score));
      if (!Number.isFinite(n) || n < 0 || n > 100) return { rows: [], error: `score out of range for ${indId}` };
      score = n;
    }
    const req = it.source === "additional" ? undefined : reqByInd.get(indId);
    const isAdditional = it.source === "additional" || !req;
    rows.push({
      tenant_id: tenantId,
      assessment_id: assessmentId,
      behavior_indicator_id: indId,
      source: isAdditional ? "additional" : "position",
      employee_score: score,
      required_score_snapshot: req ? req.required_score : null,
      weight_snapshot: req ? req.weight : 1,
      mandatory_snapshot: req ? req.is_mandatory : false,
      critical_snapshot: req ? req.is_critical : (ownedMap.get(indId) ?? false),
      comment: typeof it.comment === "string" && it.comment.trim() ? it.comment.trim().slice(0, 2000) : null,
      evidence: typeof it.evidence === "string" && it.evidence.trim() ? it.evidence.trim().slice(0, 2000) : null,
    });
  }
  return { rows, error: null };
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "HR", "create");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    employee_id?: string;
    assessment_type?: string;
    assessment_period_start?: string | null;
    assessment_period_end?: string | null;
    summary?: string | null;
    recommendation?: string | null;
    status?: "draft" | "finalized";
    items?: ItemIn[];
  } | null;
  if (!body?.employee_id) return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  const emp = await employeeInTenant(body.employee_id, auth.tenant_id);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const type = ASSESSMENT_TYPES.has(body.assessment_type ?? "") ? body.assessment_type! : "manager";
  const positionId = await currentPositionId(emp.person_id);
  const finalize = body.status === "finalized";

  /* Shell first — items need the assessment id. */
  const { data: shell, error: shellErr } = await supabaseServer
    .from("employee_behavior_assessments")
    .insert({
      tenant_id: auth.tenant_id,
      employee_id: body.employee_id,
      position_id_at_assessment: positionId,
      assessment_type: type,
      assessment_period_start: body.assessment_period_start || null,
      assessment_period_end: body.assessment_period_end || null,
      status: "draft",
      assessed_by: auth.account_id ?? null,
      summary: typeof body.summary === "string" ? body.summary.slice(0, 4000) : null,
      recommendation: ["confirm","extend","develop","escalate"].includes(body.recommendation ?? "") ? body.recommendation : null,
    })
    .select("id").single();
  if (shellErr || !shell) return NextResponse.json({ error: shellErr?.message || "create failed" }, { status: 500 });

  const { rows, error: itemErr } = await buildItems(auth.tenant_id, shell.id, body.items ?? [], positionId);
  if (itemErr) {
    await supabaseServer.from("employee_behavior_assessments").delete().eq("id", shell.id);
    return NextResponse.json({ error: itemErr }, { status: 400 });
  }
  if (rows.length) {
    const { error: insErr } = await supabaseServer.from("employee_behavior_assessment_items").insert(rows);
    if (insErr) {
      await supabaseServer.from("employee_behavior_assessments").delete().eq("id", shell.id);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  if (finalize) {
    const err = await finalizeAssessment(auth, shell.id, req);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  await logAudit({
    auth, action_type: "create", module: "HR",
    entity_type: "behavior_assessment", entity_id: shell.id,
    entity_label: (emp.employee_number as string | null) ?? null,
    new_values: { type, finalized: finalize }, route: "/api/hr/behavior", req,
  });
  return NextResponse.json({ ok: true, assessment_id: shell.id, finalized: finalize });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "HR", "edit");
  if (denied) return denied;

  const assessmentId = new URL(req.url).searchParams.get("assessment_id");
  if (!assessmentId) return NextResponse.json({ error: "assessment_id required" }, { status: 400 });

  const { data: a } = await supabaseServer
    .from("employee_behavior_assessments").select("*").eq("id", assessmentId).maybeSingle();
  if (!a || (auth.tenant_id && a.tenant_id && a.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  /* Finalized = immutable. Reopening is a deliberate future feature, not a
     silent overwrite. */
  if (a.status === "finalized") {
    return NextResponse.json({ error: "Finalized assessments cannot be edited." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    summary?: string | null;
    recommendation?: string | null;
    status?: "draft" | "reviewed" | "finalized";
    scores?: { behavior_indicator_id?: string; employee_score?: number | null; comment?: string | null; evidence?: string | null }[];
  } | null;
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  /* Update existing items in place (draft edits change numbers/comments; they
     don't re-snapshot the requirement). */
  if (Array.isArray(body.scores)) {
    for (const s of body.scores) {
      if (!s.behavior_indicator_id) continue;
      let score: number | null = null;
      if (s.employee_score != null && (s.employee_score as unknown) !== "") {
        const n = Math.round(Number(s.employee_score));
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return NextResponse.json({ error: `score out of range for ${s.behavior_indicator_id}` }, { status: 400 });
        }
        score = n;
      }
      await supabaseServer
        .from("employee_behavior_assessment_items")
        .update({
          employee_score: score,
          comment: typeof s.comment === "string" && s.comment.trim() ? s.comment.trim().slice(0, 2000) : null,
          evidence: typeof s.evidence === "string" && s.evidence.trim() ? s.evidence.trim().slice(0, 2000) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("assessment_id", assessmentId)
        .eq("behavior_indicator_id", s.behavior_indicator_id);
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.summary === "string") patch.summary = body.summary.slice(0, 4000);
  if (body.recommendation !== undefined) {
    patch.recommendation = ["confirm","extend","develop","escalate"].includes(body.recommendation ?? "") ? body.recommendation : null;
  }
  if (body.status === "reviewed") { patch.status = "reviewed"; patch.reviewed_by = auth.account_id ?? null; patch.review_date = new Date().toISOString().split("T")[0]; }
  await supabaseServer.from("employee_behavior_assessments").update(patch).eq("id", assessmentId);

  if (body.status === "finalized") {
    const err = await finalizeAssessment(auth, assessmentId, req);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  await logAudit({
    auth, action_type: "update", module: "HR",
    entity_type: "behavior_assessment", entity_id: assessmentId,
    new_values: { status: body.status ?? a.status }, route: "/api/hr/behavior", req,
  });
  return NextResponse.json({ ok: true });
}

/* Compute totals from the FROZEN item snapshots, run the justification gate,
   then stamp the assessment finalized. Returns an error string or null. */
async function finalizeAssessment(
  auth: { tenant_id: string | null; account_id: string | null },
  assessmentId: string,
  _req: Request,
): Promise<string | null> {
  const { data: items } = await supabaseServer
    .from("employee_behavior_assessment_items")
    .select("behavior_indicator_id, employee_score, required_score_snapshot, weight_snapshot, mandatory_snapshot, critical_snapshot, comment")
    .eq("assessment_id", assessmentId);
  const rows = items ?? [];

  /* Category resolution for strongest/weakest (not persisted, but summarize
     needs it to stay consistent with the client). */
  const { data: inds } = await supabaseServer
    .from("behavior_indicators").select("id, category_id")
    .in("id", rows.map((r) => r.behavior_indicator_id));
  const catByInd = new Map((inds ?? []).map((i) => [i.id, i.category_id as string]));

  /* Justification gate: extreme scores and critical gaps must carry a comment
     before an assessment can be finalized. */
  for (const r of rows) {
    const engineRow: BehaviorItem = {
      score: r.employee_score, weight: r.weight_snapshot,
      requiredScore: r.required_score_snapshot, isCritical: r.critical_snapshot,
    };
    if (requiresJustification(engineRow, r.comment)) {
      return "A justification comment is required for extreme scores and critical gaps before finalizing.";
    }
  }

  const summary = summarize(toEngineRows(rows, catByInd));
  const { error } = await supabaseServer
    .from("employee_behavior_assessments")
    .update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
      reviewed_by: auth.account_id ?? null,
      overall_behavior_score: summary.overallScore,
      position_behavior_match: summary.matchPct,
      critical_gap_count: summary.criticalGaps,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);
  return error?.message ?? null;
}
