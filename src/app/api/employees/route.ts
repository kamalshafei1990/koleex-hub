import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/employees — list every employee in the caller's tenant,
   joined with the person / assignment / department / position records
   each row needs. Shape matches EmployeeListItem so fetchEmployeeList
   on the client is a pure 1:1 passthrough.

   Moved server-side because RLS on koleex_employees hides rows from
   the anon client: freshly-created employees appeared nowhere in
   the /employees list even though they existed in the DB.

   Query params:
     activeOnly=1   limit to employment_status='active' (used by the
                    Manager / Supervisor picker). */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "1";

  let empQ = supabaseServer
    .from("koleex_employees")
    .select("*")
    .order("created_at", { ascending: false });
  if (activeOnly) empQ = empQ.eq("employment_status", "active");

  const { data: employees, error: empErr } = await empQ;
  if (empErr || !employees) {
    console.error("[api/employees GET]", empErr?.message);
    return NextResponse.json({ employees: [] });
  }

  type Emp = Record<string, unknown> & {
    id: string;
    person_id: string | null;
    account_id: string | null;
    employee_number: string | null;
    hire_date: string | null;
    employment_status: string;
    employment_type?: string;
    work_email: string | null;
    work_phone: string | null;
    work_location?: string;
  };
  const emps = employees as Emp[];

  const personIds = emps.map((e) => e.person_id).filter(Boolean) as string[];
  if (personIds.length === 0) return NextResponse.json({ employees: [] });

  const [{ data: people }, { data: assignments }] = await Promise.all([
    supabaseServer.from("people").select("*").in("id", personIds),
    supabaseServer
      .from("koleex_assignments")
      .select("*")
      .in("person_id", personIds)
      .eq("is_active", true)
      .eq("is_primary", true),
  ]);

  type Assignment = {
    id: string;
    person_id: string;
    department_id: string;
    position_id: string;
  };
  const asList = (assignments as Assignment[] | null) ?? [];
  const deptIds = [...new Set(asList.map((a) => a.department_id))];
  const posIds = [...new Set(asList.map((a) => a.position_id))];

  const [{ data: departments }, { data: positions }] = await Promise.all([
    deptIds.length
      ? supabaseServer.from("koleex_departments").select("id, name").in("id", deptIds)
      : Promise.resolve({ data: [] }),
    posIds.length
      ? supabaseServer.from("koleex_positions").select("id, title").in("id", posIds)
      : Promise.resolve({ data: [] }),
  ]);

  type Person = {
    id: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    avatar_url: string | null;
  };
  const personMap = new Map((people as Person[] ?? []).map((p) => [p.id, p]));
  const assignMap = new Map(asList.map((a) => [a.person_id, a]));
  const deptMap = new Map(((departments ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]));
  const posMap = new Map(((positions ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));

  const items = emps
    .filter((e) => e.person_id && personMap.has(e.person_id))
    .map((e) => {
      const person = personMap.get(e.person_id!)!;
      const assignment = assignMap.get(e.person_id!);
      return {
        id: e.id,
        person_id: e.person_id!,
        person: {
          full_name: person.full_name,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          phone: person.phone,
          mobile: person.mobile,
          avatar_url: person.avatar_url,
        },
        employee_number: e.employee_number,
        hire_date: e.hire_date,
        employment_status: e.employment_status,
        employment_type: e.employment_type || "full_time",
        work_email: e.work_email,
        work_phone: e.work_phone,
        work_location: e.work_location || "office",
        department_name: assignment ? deptMap.get(assignment.department_id) || null : null,
        position_title: assignment ? posMap.get(assignment.position_id) || null : null,
        department_id: assignment?.department_id || null,
        position_id: assignment?.position_id || null,
        has_account: !!e.account_id,
        account_id: e.account_id,
      };
    });

  return NextResponse.json(
    { employees: items },
    {
      /* Same cache story as /api/accounts: HR directory changes
         rarely during a session, but we still need freshness after
         an admin creates/edits. stale-while-revalidate lets the
         browser serve instantly from cache while revalidating in
         the background. */
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
    },
  );
}

/* POST /api/employees — create a koleex_employees row (tenant_id enforced). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as Record<string, unknown>;
  const row = { ...body, tenant_id: auth.tenant_id };

  const { data, error } = await supabaseServer
    .from("koleex_employees")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/employees POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ employee: data });
}
