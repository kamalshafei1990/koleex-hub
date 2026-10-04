import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/hr/reports — the numbers an HR manager is asked for (Phase G),
   computed on the server in ONE response, HR·view.

     headcount     — now, by status; hires per month and leavers per month
                     over the last 12 months (a leaver = employment_status
                     terminated, dated by the row's updated_at — the closest
                     thing to a termination date the record holds); turnover
                     = leavers ÷ average headcount over the window
     tenure        — average years and the <1 / 1–3 / 3–5 / 5+ buckets
     expiries      — the next 90 days: visa, insurance, contract, probation,
                     driving licence, and HR documents with an expiry
     occasions     — birthdays and hire anniversaries in the next 60 days
     cost          — the current salary register summed by department and
                     currency (employer contributions are a payroll-run
                     figure, not repeated here)
     mix           — nationality, work country, gender, employment type

   Every list carries the employee id so the UI can link to the profile, and
   the same rows feed the CSV export client-side.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

const EXPIRY_FIELDS = [
  ["visa_expiry_date", "Visa"], ["insurance_expiry_date", "Insurance"], ["contract_end_date", "Contract"],
  ["probation_end_date", "Probation"], ["driving_license_expiry", "Driving licence"],
] as const;

type Emp = {
  id: string; person_id: string | null; employee_number: string | null; employment_status: string; employment_type: string;
  hire_date: string | null; updated_at: string; birth_date: string | null; nationality: string | null; work_country: string | null; gender: string | null;
  visa_expiry_date: string | null; insurance_expiry_date: string | null; contract_end_date: string | null; probation_end_date: string | null; driving_license_expiry: string | null;
  people?: { full_name?: string | null; country?: string | null } | { full_name?: string | null; country?: string | null }[] | null;
};
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const ym = (iso: string) => iso.slice(0, 7);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const today = (new URL(req.url).searchParams.get("today") ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  const [{ data: emps }, { data: asgs }, { data: depts }, { data: salaries }, { data: docs }] = await Promise.all([
    supabaseServer.from("koleex_employees")
      .select("id, person_id, employee_number, employment_status, employment_type, hire_date, updated_at, birth_date, nationality, work_country, gender, visa_expiry_date, insurance_expiry_date, contract_end_date, probation_end_date, driving_license_expiry, people(full_name, country)")
      .or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null"),
    supabaseServer.from("koleex_assignments").select("person_id, department_id").eq("is_active", true).eq("is_primary", true),
    supabaseServer.from("koleex_departments").select("id, name"),
    supabaseServer.from("hr_salary_records").select("employee_id, base_salary, currency, allowances").is("effective_to", null),
    supabaseServer.from("hr_documents").select("id, employee_id, name, category, expiry_date").not("expiry_date", "is", null).gte("expiry_date", today).lte("expiry_date", addDays(today, 90)),
  ]);
  const employees = (emps ?? []) as Emp[];
  const deptName = new Map(((depts ?? []) as Array<{ id: string; name: string }>).map((d) => [d.id, d.name]));
  const deptOfPerson = new Map(((asgs ?? []) as Array<{ person_id: string; department_id: string }>).map((a) => [a.person_id, deptName.get(a.department_id) ?? "—"]));
  const nameOf = (e: Emp) => one(e.people)?.full_name ?? "Employee";
  const deptOf = (e: Emp) => (e.person_id && deptOfPerson.get(e.person_id)) || "—";
  const active = employees.filter((e) => e.employment_status === "active" || e.employment_status === "on_leave");

  /* ── headcount & turnover ── */
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
  const hires = months.map((m) => employees.filter((e) => e.hire_date && ym(e.hire_date) === m).length);
  const leavers = months.map((m) => employees.filter((e) => e.employment_status === "terminated" && ym(e.updated_at) === m).length);
  const leaversWindow = leavers.reduce((a, b) => a + b, 0);
  const hiresWindow = hires.reduce((a, b) => a + b, 0);
  const headcountNow = active.length;
  const headcountStart = Math.max(0, headcountNow - hiresWindow + leaversWindow);
  const avgHeadcount = (headcountNow + headcountStart) / 2 || 1;
  const byStatus: Record<string, number> = {};
  for (const e of employees) byStatus[e.employment_status] = (byStatus[e.employment_status] ?? 0) + 1;

  /* ── tenure ── */
  const tenures = active.filter((e) => e.hire_date).map((e) => yearsBetween(e.hire_date!, today));
  const buckets = { "<1": 0, "1-3": 0, "3-5": 0, "5+": 0 } as Record<string, number>;
  for (const y of tenures) buckets[y < 1 ? "<1" : y < 3 ? "1-3" : y < 5 ? "3-5" : "5+"]++;

  /* ── expiries ── */
  const horizon = addDays(today, 90);
  const expiries: Array<{ employeeId: string; name: string; kind: string; date: string; daysLeft: number }> = [];
  for (const e of active) for (const [col, label] of EXPIRY_FIELDS) {
    const d = e[col]; if (d && d.slice(0, 10) >= today && d.slice(0, 10) <= horizon) expiries.push({ employeeId: e.id, name: nameOf(e), kind: label, date: d.slice(0, 10), daysLeft: Math.round((Date.parse(d.slice(0, 10)) - Date.parse(today)) / 86_400_000) });
  }
  for (const d of (docs ?? []) as Array<{ employee_id: string; name: string; category: string; expiry_date: string }>) {
    const e = employees.find((x) => x.id === d.employee_id); if (!e) continue;
    expiries.push({ employeeId: e.id, name: nameOf(e), kind: `Document · ${d.name}`, date: d.expiry_date, daysLeft: Math.round((Date.parse(d.expiry_date) - Date.parse(today)) / 86_400_000) });
  }
  expiries.sort((a, b) => a.daysLeft - b.daysLeft);

  /* ── occasions (next 60 days) ── */
  const occasions: Array<{ employeeId: string; name: string; kind: "birthday" | "anniversary"; date: string; years: number | null; daysLeft: number }> = [];
  const nextOccurrence = (mmdd: string) => { const y = Number(today.slice(0, 4)); const a = `${y}-${mmdd}`; return a >= today ? a : `${y + 1}-${mmdd}`; };
  for (const e of active) {
    if (e.birth_date) { const d = nextOccurrence(e.birth_date.slice(5, 10)); const days = Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000); if (days <= 60) occasions.push({ employeeId: e.id, name: nameOf(e), kind: "birthday", date: d, years: Number(d.slice(0, 4)) - Number(e.birth_date.slice(0, 4)), daysLeft: days }); }
    if (e.hire_date) { const d = nextOccurrence(e.hire_date.slice(5, 10)); const years = Number(d.slice(0, 4)) - Number(e.hire_date.slice(0, 4)); const days = Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000); if (days <= 60 && years > 0) occasions.push({ employeeId: e.id, name: nameOf(e), kind: "anniversary", date: d, years, daysLeft: days }); }
  }
  occasions.sort((a, b) => a.daysLeft - b.daysLeft);

  /* ── cost by department ── */
  const cost: Record<string, Record<string, number>> = {};
  for (const s of (salaries ?? []) as Array<{ employee_id: string; base_salary: number; currency: string; allowances: Record<string, number> | null }>) {
    const e = employees.find((x) => x.id === s.employee_id); if (!e || (e.employment_status !== "active" && e.employment_status !== "on_leave")) continue;
    const dept = deptOf(e); const ccy = s.currency || "USD";
    const monthly = Number(s.base_salary) + Object.values(s.allowances ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
    cost[dept] = cost[dept] ?? {}; cost[dept][ccy] = Math.round(((cost[dept][ccy] ?? 0) + monthly) * 100) / 100;
  }

  /* ── mix ── */
  const count = (pick: (e: Emp) => string | null | undefined) => { const m: Record<string, number> = {}; for (const e of active) { const k = pick(e) || "—"; m[k] = (m[k] ?? 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };

  return NextResponse.json({
    today,
    headcount: { now: headcountNow, byStatus, months, hires, leavers, hiresWindow, leaversWindow, turnoverRate: Math.round((leaversWindow / avgHeadcount) * 1000) / 10 },
    tenure: { averageYears: tenures.length ? Math.round((tenures.reduce((a, b) => a + b, 0) / tenures.length) * 10) / 10 : 0, buckets, people: active.map((e) => ({ employeeId: e.id, name: nameOf(e), number: e.employee_number, department: deptOf(e), hireDate: e.hire_date, years: e.hire_date ? Math.round(yearsBetween(e.hire_date, today) * 10) / 10 : null })) },
    expiries,
    occasions,
    cost,
    mix: { nationality: count((e) => e.nationality), workCountry: count((e) => e.work_country || one(e.people)?.country), gender: count((e) => e.gender), employmentType: count((e) => e.employment_type) },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
