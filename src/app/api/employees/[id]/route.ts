import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/employees/[id] — full profile joined across tables.
 *
 * Returns the EmployeeWithLinks shape the /employees/[id] profile
 * page expects: { person, employee, account, assignment, department,
 * position }. Reads via service_role so RLS on koleex_employees
 * doesn't hide the row from the signed-in viewer. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data: emp, error: empErr } = await supabaseServer
    .from("koleex_employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (empErr) {
    console.error("[api/employees/[id] GET]", empErr.message);
    return NextResponse.json({ error: empErr.message }, { status: 500 });
  }
  if (!emp || !emp.person_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /* Parallelise everything we can. The assignment lookup scopes to
     the most recent active+primary record — rare to have more than
     one, but `.maybeSingle()` protects us from bad data. */
  const [{ data: person }, accountRes, { data: assignment }] = await Promise.all([
    supabaseServer.from("people").select("*").eq("id", emp.person_id).maybeSingle(),
    emp.account_id
      ? supabaseServer.from("accounts").select("*").eq("id", emp.account_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseServer
      .from("koleex_assignments")
      .select("*")
      .eq("person_id", emp.person_id)
      .eq("is_active", true)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  if (!person) {
    return NextResponse.json({ error: "Person record missing" }, { status: 404 });
  }

  let department = null, position = null;
  if (assignment) {
    const [{ data: dept }, { data: pos }] = await Promise.all([
      supabaseServer.from("koleex_departments").select("*").eq("id", assignment.department_id).maybeSingle(),
      supabaseServer.from("koleex_positions").select("*").eq("id", assignment.position_id).maybeSingle(),
    ]);
    department = dept;
    position = pos;
  }

  return NextResponse.json({
    person,
    employee: emp,
    account: (accountRes as { data: unknown }).data ?? null,
    assignment,
    department,
    position,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let q = supabaseServer.from("koleex_employees").select("id").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await q.maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  const { error } = await supabaseServer
    .from("koleex_employees")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/employees/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
