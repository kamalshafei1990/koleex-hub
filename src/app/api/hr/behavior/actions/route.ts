import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* Behavior follow-up actions — coaching, training, PIPs, etc. created FROM a
   behavior gap. Never auto-issued from a score: a human authorizes each one.
   GET ?employee_id=X → open + past actions
   POST               → create an action (HR create)
   PATCH ?id=Y        → update status / owner / due date (HR edit)          */

const ACTION_TYPES = new Set(["coaching","communication_training","leadership_training","safety_retraining","policy_refresher","pip","hr_review","other"]);
const STATUSES = new Set(["open","in_progress","done","cancelled"]);

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "HR");
  if (deny) return deny;
  const employeeId = new URL(req.url).searchParams.get("employee_id");
  if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("behavior_followup_actions")
    .select("id, assessment_id, action_type, owner, due_date, status, notes, created_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "HR", "create");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    employee_id?: string; assessment_id?: string | null;
    action_type?: string; due_date?: string | null; notes?: string | null;
  } | null;
  if (!body?.employee_id) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

  const { data: emp } = await supabaseServer
    .from("koleex_employees").select("id, tenant_id, employee_number").eq("id", body.employee_id).maybeSingle();
  if (!emp || (auth.tenant_id && emp.tenant_id && emp.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("behavior_followup_actions")
    .insert({
      tenant_id: auth.tenant_id,
      employee_id: body.employee_id,
      assessment_id: body.assessment_id || null,
      action_type: ACTION_TYPES.has(body.action_type ?? "") ? body.action_type : "coaching",
      owner: auth.account_id ?? null,
      due_date: body.due_date || null,
      status: "open",
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
    })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    auth, action_type: "create", module: "HR",
    entity_type: "behavior_action", entity_id: data.id,
    entity_label: (emp.employee_number as string | null) ?? null,
    new_values: { action_type: body.action_type }, route: "/api/hr/behavior/actions", req,
  });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "HR", "edit");
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data: existing } = await supabaseServer
    .from("behavior_followup_actions").select("id, tenant_id").eq("id", id).maybeSingle();
  if (!existing || (auth.tenant_id && existing.tenant_id && existing.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { status?: string; due_date?: string | null; notes?: string | null } | null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.status && STATUSES.has(body.status)) patch.status = body.status;
  if (body?.due_date !== undefined) patch.due_date = body.due_date || null;
  if (typeof body?.notes === "string") patch.notes = body.notes.slice(0, 2000);

  const { error } = await supabaseServer.from("behavior_followup_actions").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
