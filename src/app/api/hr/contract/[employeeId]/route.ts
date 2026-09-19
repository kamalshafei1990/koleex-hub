import "server-only";

/* GET /api/hr/contract/[employeeId] — everything the employment contract
   prints, in one shape (HR·view). The salary is the register's current
   record; the working hours and weekend come from the country's attendance
   policy; the annual leave from the leave type catalogue. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadPolicy, resolveEmployeeCountry } from "@/lib/server/work-calendar";

export interface EmploymentContractData {
  employee: {
    id: string; employeeNumber: string | null; fullName: string; nameAlt: string | null; nationality: string | null;
    identificationId: string | null; passportNumber: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; country: string | null;
    email: string | null; phone: string | null;
    hireDate: string | null; probationEndDate: string | null; contractEndDate: string | null; employmentType: string; workLocation: string; workCountry: string | null;
    department: string | null; position: string | null;
  };
  salary: { amount: number; currency: string; frequency: string; allowances: Record<string, number> } | null;
  policy: { workStart: string; workEnd: string; weekend: number[]; minHours: number; timezone: string; name: string };
  annualLeaveDays: number | null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ employeeId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const { employeeId } = await ctx.params;
  const { data: emp } = await supabaseServer.from("koleex_employees")
    .select("id, employee_number, person_id, nationality, identification_id, passport_number, hire_date, probation_end_date, contract_end_date, employment_type, work_location, work_country, work_email, work_phone, people(full_name, name_alt, email, phone, mobile, address_line1, address_line2, city, country)")
    .eq("id", employeeId).maybeSingle();
  if (!emp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const e = emp as Record<string, unknown> & { people?: Record<string, string | null> | Record<string, string | null>[] | null };
  const p = (Array.isArray(e.people) ? e.people[0] : e.people) ?? {};
  const personId = e.person_id as string | null;

  const [asg, sal, country, annual] = await Promise.all([
    personId ? supabaseServer.from("koleex_assignments").select("department_id, position_id").eq("person_id", personId).eq("is_active", true).eq("is_primary", true).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    supabaseServer.from("hr_salary_records").select("base_salary, currency, pay_frequency, allowances").eq("employee_id", employeeId).is("effective_to", null).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    resolveEmployeeCountry(employeeId),
    supabaseServer.from("hr_leave_types").select("default_days").eq("code", "annual").maybeSingle(),
  ]);
  const a = asg.data as { department_id?: string | null; position_id?: string | null } | null;
  const [dept, pos] = await Promise.all([
    a?.department_id ? supabaseServer.from("koleex_departments").select("name").eq("id", a.department_id).maybeSingle() : Promise.resolve({ data: null }),
    a?.position_id ? supabaseServer.from("koleex_positions").select("title").eq("id", a.position_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const policy = await loadPolicy(country);
  const s = sal.data as { base_salary: number; currency: string; pay_frequency: string; allowances: Record<string, number> | null } | null;

  const data: EmploymentContractData = {
    employee: {
      id: e.id as string, employeeNumber: (e.employee_number as string | null) ?? null, fullName: p.full_name ?? "Employee", nameAlt: p.name_alt ?? null,
      nationality: (e.nationality as string | null) ?? null, identificationId: (e.identification_id as string | null) ?? null, passportNumber: (e.passport_number as string | null) ?? null,
      addressLine1: p.address_line1 ?? null, addressLine2: p.address_line2 ?? null, city: p.city ?? null, country: p.country ?? null,
      email: (e.work_email as string | null) ?? p.email ?? null, phone: (e.work_phone as string | null) ?? p.mobile ?? p.phone ?? null,
      hireDate: (e.hire_date as string | null) ?? null, probationEndDate: (e.probation_end_date as string | null) ?? null, contractEndDate: (e.contract_end_date as string | null) ?? null,
      employmentType: (e.employment_type as string) ?? "full_time", workLocation: (e.work_location as string) ?? "office", workCountry: country,
      department: (dept.data as { name?: string } | null)?.name ?? null, position: (pos.data as { title?: string } | null)?.title ?? null,
    },
    salary: s ? { amount: Number(s.base_salary), currency: s.currency, frequency: s.pay_frequency, allowances: s.allowances ?? {} } : null,
    policy: { workStart: policy.workStart, workEnd: policy.workEnd, weekend: policy.weekend, minHours: policy.minHours, timezone: policy.timezone, name: policy.name },
    annualLeaveDays: (annual.data as { default_days?: number } | null)?.default_days ?? null,
  };
  return NextResponse.json({ contract: data }, { headers: { "Cache-Control": "private, no-store" } });
}
