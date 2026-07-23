import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* HR-side skill management — the "while they work here" half of the system.
   Hire-time scores come from the employee form; THIS route is how a manager
   or super admin re-assesses them later, and where the comparison data
   (append-only history) is read for the weekly/monthly/annual reports.

   GET ?employee_id=… → assessments + the position's requirements + full
                        score history for that employee (HR module read)
   PUT { employee_id, scores: [{skill_id, employee_score}] }
                      → update ONLY scores of existing assessment rows
                        (HR module EDIT — managers / super admins).          */

async function employeeInTenant(id: string, tenantId: string | null) {
  const { data } = await supabaseServer
    .from("koleex_employees")
    .select("id, tenant_id, person_id, employee_number")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (tenantId && data.tenant_id && data.tenant_id !== tenantId) return null;
  return data;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "HR");
  if (deny) return deny;

  const employeeId = new URL(req.url).searchParams.get("employee_id");
  if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  const emp = await employeeInTenant(employeeId, auth.tenant_id);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* Position requirements come via the employee's active primary assignment —
     the same chain the employee form follows. */
  const { data: assignment } = await supabaseServer
    .from("koleex_assignments")
    .select("position_id")
    .eq("person_id", emp.person_id)
    .eq("is_active", true)
    .eq("is_primary", true)
    .maybeSingle();

  const [{ data: assessments }, { data: history }, reqRes] = await Promise.all([
    supabaseServer
      .from("employee_skill_assessments")
      .select("skill_id, source, employee_score, last_assessed_at")
      .eq("employee_id", employeeId),
    supabaseServer
      .from("employee_skill_history")
      .select("skill_id, employee_score, recorded_at")
      .eq("employee_id", employeeId)
      .order("recorded_at", { ascending: true })
      /* Bounded: an employee touches dozens of skills a handful of times a
         year; 2000 rows is years of history. */
      .limit(2000),
    assignment?.position_id
      ? supabaseServer
          .from("position_skill_requirements")
          .select("skill_id, required_score, weight, is_mandatory")
          .eq("position_id", assignment.position_id)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return NextResponse.json({
    assessments: assessments ?? [],
    history: history ?? [],
    requirements: (reqRes as { data: unknown[] }).data ?? [],
    position_id: assignment?.position_id ?? null,
  });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "HR", "edit");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    employee_id?: string;
    scores?: { skill_id?: string; employee_score?: number }[];
  } | null;
  if (!body?.employee_id || !Array.isArray(body.scores)) {
    return NextResponse.json({ error: "employee_id and scores[] required" }, { status: 400 });
  }
  const emp = await employeeInTenant(body.employee_id, auth.tenant_id);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* Only rows that ALREADY exist for this employee are updatable here —
     re-assessment changes numbers, it doesn't invent skills. Adding/removing
     skills stays in the employee form where the position template lives. */
  const { data: existing } = await supabaseServer
    .from("employee_skill_assessments")
    .select("skill_id, employee_score")
    .eq("employee_id", body.employee_id);
  const current = new Map((existing ?? []).map((r) => [r.skill_id as string, r.employee_score as number | null]));

  const updates: { skill_id: string; employee_score: number }[] = [];
  const seen = new Set<string>();
  for (const s of body.scores) {
    if (!s.skill_id || typeof s.skill_id !== "string" || seen.has(s.skill_id)) continue;
    seen.add(s.skill_id);
    if (!current.has(s.skill_id)) continue;
    const n = Math.round(Number(s.employee_score));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: `score out of range for skill ${s.skill_id}` }, { status: 400 });
    }
    if (current.get(s.skill_id) === n) continue;   // unchanged → no write, no history noise
    updates.push({ skill_id: s.skill_id, employee_score: n });
  }

  const now = new Date().toISOString();
  for (const u of updates) {
    const { error } = await supabaseServer
      .from("employee_skill_assessments")
      .update({ employee_score: u.employee_score, last_assessed_at: now, updated_at: now })
      .eq("employee_id", body.employee_id)
      .eq("skill_id", u.skill_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (updates.length) {
    const { error: histErr } = await supabaseServer.from("employee_skill_history").insert(
      updates.map((u) => ({
        tenant_id: auth.tenant_id,
        employee_id: body!.employee_id,
        skill_id: u.skill_id,
        employee_score: u.employee_score,
        recorded_by: auth.account_id ?? null,
      })),
    );
    if (histErr) console.error("[hr/skills history]", histErr.message);

    await logAudit({
      auth,
      action_type: "update",
      module: "HR",
      entity_type: "employee_skills",
      entity_id: body.employee_id,
      entity_label: (emp.employee_number as string | null) ?? null,
      new_values: { updated: updates.length },
      route: "/api/hr/skills",
      req,
    });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
