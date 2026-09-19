import "server-only";

/* GET /api/hr/payslips/[id] — one payslip with its employee, for the print
   sheet. Readable by HR (HR·view) OR by the employee it belongs to — the
   second path is identity-scoped through resolveMyEmployee, never a
   parameter. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const { data } = await supabaseServer.from("hr_payslips")
    .select("*, koleex_employees(id, employee_number, work_country, person_id, people(full_name, name_alt))")
    .eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const slip = data as { employee_id: string; koleex_employees?: { person_id?: string | null } | null };
  const denyHr = await requireModuleAction(auth, "HR", "view");
  if (denyHr) {
    const me = await resolveMyEmployee(auth);
    if (!me || me.id !== slip.employee_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  /* Department + position: assignments hang off the PERSON and carry no
     FK PostgREST can embed through, so resolve them by hand the way
     /api/employees does. */
  let department: string | null = null, position: string | null = null;
  const personId = slip.koleex_employees?.person_id ?? null;
  if (personId) {
    const { data: asg } = await supabaseServer.from("koleex_assignments").select("department_id, position_id, is_primary")
      .eq("person_id", personId).eq("is_active", true).order("is_primary", { ascending: false }).limit(1).maybeSingle();
    const a = asg as { department_id?: string | null; position_id?: string | null } | null;
    if (a) {
      const [{ data: d }, { data: p }] = await Promise.all([
        a.department_id ? supabaseServer.from("koleex_departments").select("name").eq("id", a.department_id).maybeSingle() : Promise.resolve({ data: null }),
        a.position_id ? supabaseServer.from("koleex_positions").select("title").eq("id", a.position_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      department = (d as { name?: string } | null)?.name ?? null;
      position = (p as { title?: string } | null)?.title ?? null;
    }
  }
  return NextResponse.json({ payslip: { ...(data as object), department, position } }, { headers: { "Cache-Control": "private, no-store" } });
}
