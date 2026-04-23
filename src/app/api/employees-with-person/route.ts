import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/employees-with-person
   Returns the Employee picker list (joined with each employee's Person row)
   scoped to the caller's tenant.

   Query params:
     includeLinked=1   include employees who already have an account_id.
                       Defaults to false (only unlinked, so the picker
                       doesn't offer people that already have logins).
*/

interface EmployeeWithPerson {
  employee_id: string;
  person_id: string;
  account_id: string | null;
  employee_number: string | null;
  department: string | null;
  position: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  work_email: string | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const includeLinked =
    new URL(req.url).searchParams.get("includeLinked") === "1";

  const { data, error } = await supabaseServer
    .from("koleex_employees")
    .select(
      `id, person_id, account_id, employee_number, department, position, work_email,
       person:people(full_name, email, job_title)`,
    )
    .eq("tenant_id", auth.tenant_id)
    .order("employee_number", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[api/employees-with-person]", error.message);
    return NextResponse.json(
      { error: "Failed to load employees" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped = rows
    .map((r): EmployeeWithPerson | null => {
      const personRaw = r.person;
      const person = Array.isArray(personRaw)
        ? (personRaw[0] as Record<string, unknown> | undefined)
        : (personRaw as Record<string, unknown> | null);
      if (!r.person_id || !person) return null;
      return {
        employee_id: r.id as string,
        person_id: r.person_id as string,
        account_id: (r.account_id as string | null) ?? null,
        employee_number: (r.employee_number as string | null) ?? null,
        department: (r.department as string | null) ?? null,
        position: (r.position as string | null) ?? null,
        full_name: (person.full_name as string) || "Unnamed employee",
        email: (person.email as string | null) ?? null,
        job_title: (person.job_title as string | null) ?? null,
        work_email: (r.work_email as string | null) ?? null,
      };
    })
    .filter((x): x is EmployeeWithPerson => x !== null);

  const filtered = includeLinked
    ? mapped
    : mapped.filter((e) => e.account_id === null);

  return NextResponse.json({ employees: filtered }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}
