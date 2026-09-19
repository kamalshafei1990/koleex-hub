import "server-only";

/* me-hr — who is asking, as an EMPLOYEE.
 *
 * The employee self-service routes (/api/me/hr/*) are identity-scoped, not
 * permission-scoped: a signed-in person may read and act on their OWN HR
 * record without holding the HR module. The whole safety of that rests on
 * one thing — every route derives the employee id from the session HERE,
 * and never from the request. This module is the only place that derivation
 * lives; validate:me-hr checks every route goes through it.
 *
 * Resolution order mirrors /api/employees: the account's direct link
 * (koleex_employees.account_id) first, then the person link
 * (accounts.person_id → koleex_employees.person_id) — the two are known to
 * drift, and either alone would lose people.
 *
 * View-as: a super admin previewing another account resolves to THAT
 * person's employee record (the whole point of view-as is seeing what they
 * see); requireAuth already blocks mutations while viewing as.
 */
import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";

export interface MyEmployee {
  id: string;
  personId: string | null;
  employeeNumber: string | null;
  department: string | null;
  position: string | null;
  hireDate: string | null;
  employmentStatus: string | null;
  employmentType: string | null;
  workLocation: string | null;
  managerId: string | null;
  tenantId: string | null;
}

const EMPLOYEE_COLS = "id, person_id, account_id, employee_number, department, position, hire_date, employment_status, employment_type, work_location, manager_id, tenant_id";

type Row = {
  id: string; person_id: string | null; account_id: string | null; employee_number: string | null;
  department: string | null; position: string | null; hire_date: string | null; employment_status: string | null;
  employment_type: string | null; work_location: string | null; manager_id: string | null; tenant_id: string | null;
};

const shape = (r: Row): MyEmployee => ({
  id: r.id, personId: r.person_id, employeeNumber: r.employee_number, department: r.department,
  position: r.position, hireDate: r.hire_date, employmentStatus: r.employment_status,
  employmentType: r.employment_type, workLocation: r.work_location, managerId: r.manager_id, tenantId: r.tenant_id,
});

export async function resolveMyEmployee(auth: ServerAuthContext): Promise<MyEmployee | null> {
  if (auth.user_type !== "internal") return null;

  const direct = await supabaseServer
    .from("koleex_employees").select(EMPLOYEE_COLS).eq("account_id", auth.account_id).maybeSingle();
  if (direct.data) return shape(direct.data as Row);

  const acct = await supabaseServer.from("accounts").select("person_id").eq("id", auth.account_id).maybeSingle();
  const personId = (acct.data as { person_id?: string | null } | null)?.person_id ?? null;
  if (!personId) return null;
  const viaPerson = await supabaseServer
    .from("koleex_employees").select(EMPLOYEE_COLS).eq("person_id", personId).maybeSingle();
  return viaPerson.data ? shape(viaPerson.data as Row) : null;
}

/** ISO date (YYYY-MM-DD) of "today" — server clock, UTC. Attendance and
 *  leave rows key on it; one convention everywhere. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);
