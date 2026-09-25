import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the HR numbers (Phase 5C, owner's picks 26 Sep 2026).
   The counting is the pure src/lib/reports/numbers-5c.ts; this file reads.

   Who reads how far (decided once per report, in HrShared):
     HR · view (or a super admin)  the whole company
     a manager without it           their own team (everyone under them who
                                    is active staff) — only where a number
                                    is about people's days (HR_TEAM_READS)
     «Payroll Reports»              the salaries (PAYROLL_SOURCES), whatever
                                    the writer holds in HR
     the role's private switch      insurance (its provider, class, expiry —
                                    never a policy number) and a bank
                                    account's PRESENCE in a file's gaps
   A block about one employee (DATA_ABOUT) reads only them — and only if
   the writer's reach holds them. HR's tables carry no tenant: the tenant's
   employees are the filter.

   Nothing here writes. A leaver is dated by the day their record left
   (HR keeps no termination date); a move is a new department on a later
   assignment (the position history is not written reliably yet).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { canViewPrivate } from "@/lib/server/sensitive-columns";
import { buildAttendanceSheet } from "@/lib/server/attendance-sheet";
import { loadTeamScope } from "@/lib/server/reports/team";
import type { ReportDataRow } from "@/lib/reports/templates";
import { DATA_ABOUT, PAYROLL_MODULE, isHrTeamRead, isPayrollSource, type HrSource } from "@/lib/reports/report-data";
import {
  addDays, appraisalResultRows, expiryRows, fileGaps, headcountRows, hrKpiRows, movementRows, personDays, skillRows, turnoverRows,
  type ExpiryFact, type MoveFact, type SheetDayLite, type StaffFact,
} from "@/lib/reports/numbers-5c";

export interface HrCtx { auth: ServerAuthContext; start: string; end: string; today: string; about: (type: "employee") => string | null }
type Answer = { rows: ReportDataRow[] } | "denied" | "about";

const chunks = <T,>(xs: T[], n = 100): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? Math.round(x * 100) / 100 : null; };
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}
const ACTIVE = ["active", "on_leave", "probation"];

/* ── The people ───────────────────────────────────────────────────────── */

type EmpRow = {
  id: string; account_id: string | null; person_id: string | null; employee_number: string | null;
  employment_status: string | null; employment_type: string | null; hire_date: string | null; birth_date: string | null;
  contract_end_date: string | null; probation_end_date: string | null; visa_expiry_date: string | null; driving_license_expiry: string | null;
  insurance_provider: string | null; insurance_class: string | null; insurance_expiry_date: string | null;
  manager_id: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null;
  bank_account_number: string | null; bank_iban: string | null; national_id_doc_url: string | null; passport_doc_url: string | null;
  updated_at: string | null; people?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};
export interface Staff extends StaffFact { row: EmpRow; accountId: string | null; personId: string | null; positionId: string | null }

/** Every employee of the tenant, with their department (their person's
 *  primary active assignment) — read once per report. */
async function loadStaff(auth: ServerAuthContext): Promise<Staff[]> {
  const emps = listOf<EmpRow>(await supabaseServer.from("koleex_employees")
    .select("id, account_id, person_id, employee_number, employment_status, employment_type, hire_date, birth_date, contract_end_date, probation_end_date, visa_expiry_date, driving_license_expiry, insurance_provider, insurance_class, insurance_expiry_date, manager_id, emergency_contact_name, emergency_contact_phone, bank_account_number, bank_iban, national_id_doc_url, passport_doc_url, updated_at, people(full_name)")
    .or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null").limit(3000), "employees");
  const persons = Array.from(new Set(emps.map((e) => e.person_id).filter((p): p is string => !!p)));
  const asg: Array<{ person_id: string; department_id: string | null; position_id: string | null }> = [];
  for (const part of chunks(persons)) {
    asg.push(...listOf<{ person_id: string; department_id: string | null; position_id: string | null }>(
      await supabaseServer.from("koleex_assignments").select("person_id, department_id, position_id").in("person_id", part).eq("is_active", true).eq("is_primary", true), "assignments"));
  }
  const depts = await deptNames(auth);
  const byPerson = new Map(asg.map((a) => [a.person_id, a]));
  return emps.map((e) => {
    const a = e.person_id ? byPerson.get(e.person_id) : undefined;
    const status = e.employment_status ?? "active";
    return {
      id: e.id, name: one(e.people)?.full_name?.trim() || e.employee_number || "—", department: (a?.department_id && depts.get(a.department_id)) || "",
      status, type: e.employment_type, hire: day(e.hire_date), left: status === "terminated" ? day(e.updated_at) : null,
      row: e, accountId: e.account_id, personId: e.person_id, positionId: a?.position_id ?? null,
    };
  });
}

async function deptNames(auth: ServerAuthContext): Promise<Map<string, string>> {
  let q = supabaseServer.from("koleex_departments").select("id, name").limit(500);
  if (auth.tenant_id) q = q.or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`);
  return new Map(listOf<{ id: string; name: string }>(await q, "departments").map((d) => [d.id, d.name]));
}

/* ── Who the writer may read ──────────────────────────────────────────── */

export interface HrShared {
  hrView: () => Promise<boolean>;
  payroll: () => Promise<boolean>;
  team: () => Promise<Set<string>>;
  staff: () => Promise<Staff[]>;
  days: Map<string, Promise<Map<string, SheetDayLite[]>>>;
}

/** Asked the first time a block needs it, then shared. */
const memo = <T,>(f: () => Promise<T>): (() => Promise<T>) => { let p: Promise<T> | null = null; return () => (p ??= f()); };

/** The rights and the people, each read once for all of a report's HR blocks. */
export function hrShared(auth: ServerAuthContext): HrShared {
  return {
    hrView: memo(async () => auth.is_super_admin || (await requireModuleAction(auth, "HR", "view")) === null),
    payroll: memo(async () => auth.is_super_admin || (await requireModuleAction(auth, PAYROLL_MODULE, "create")) === null),
    team: memo(async () => new Set((await loadTeamScope(auth)).owners.map((o) => o.employeeId))),
    staff: memo(() => loadStaff(auth)),
    days: new Map(),
  };
}

/** The employees a block covers: everyone (HR · view), the team (a people's
 *  days block, without it) or the one it is about — null when the writer may
 *  read none of them. */
async function reach(src: HrSource, x: HrCtx, sh: HrShared): Promise<Staff[] | "denied" | "about"> {
  const about = DATA_ABOUT[src];
  const subject = about ? x.about("employee") : null;
  if (about?.required && !subject) return "about";
  let allowed: ((s: Staff) => boolean) | null = null;
  if (isPayrollSource(src)) {
    if (!(await sh.payroll())) return "denied";
    allowed = () => true;
  } else if (await sh.hrView()) {
    allowed = () => true;
  } else if (isHrTeamRead(src)) {
    const team = await sh.team();
    if (!team.size) return "denied";
    allowed = (s) => team.has(s.id);
  }
  if (!allowed) return "denied";
  const staff = await sh.staff();
  if (subject) {
    const s = staff.find((e) => e.id === subject);
    return s && allowed(s) ? [s] : "denied";
  }
  return staff.filter((s) => allowed!(s) && ACTIVE.includes(s.status));
}

/** Each person's sheet days inside [from, to] — HR's monthly sheet of every
 *  month the days touch, five people at a time; a sheet that fails leaves
 *  that person out. Memoised per set of people. */
function daysOf(sh: HrShared, tenantId: string | null, people: Staff[], from: string, to: string, today: string): Promise<Map<string, SheetDayLite[]>> {
  const key = `${from}|${to}|${people.map((p) => p.id).sort().join(",")}`;
  const hit = sh.days.get(key);
  if (hit) return hit;
  const run = (async () => {
    const months: Array<{ year: number; month: number }> = [];
    for (let d = `${from.slice(0, 7)}-01`; d <= to; d = `${addDays(`${d.slice(0, 7)}-01`, 32).slice(0, 7)}-01`) months.push({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) });
    const out = new Map<string, SheetDayLite[]>();
    for (const group of chunks(people, 5)) {
      await Promise.all(group.map(async (p) => {
        try {
          const sheets = await Promise.all(months.map((m) => buildAttendanceSheet({ employeeId: p.id, tenantId, year: m.year, month: m.month, today })));
          out.set(p.id, sheets.flatMap((s) => s.days.map((d) => ({ date: d.date, status: d.status, hours: d.hours, lateMin: d.lateMin, overtimeH: d.overtimeH, overtimeState: d.overtimeState, overtimeApprovedH: d.overtimeApprovedH }))));
        } catch (e) {
          console.error("[reports.hr] attendance:", e instanceof Error ? e.message : e);
        }
      }));
    }
    return out;
  })();
  sh.days.set(key, run);
  return run;
}

const byName = (a: Staff, b: Staff) => a.name.localeCompare(b.name);

/* ── The blocks ───────────────────────────────────────────────────────── */

export async function hrData(src: HrSource, x: HrCtx, sh: HrShared): Promise<Answer> {
  const people = await reach(src, x, sh);
  if (people === "denied" || people === "about") return people;
  const { start: from, end: to, today } = x;
  const ids = people.map((p) => p.id);
  const nameOf = new Map(people.map((p) => [p.id, p]));

  switch (src) {
    case "hiring": {
      const posts = listOf<{ id: string; title: string | null; department_id: string | null; status: string; closes_at: string | null }>(
        await supabaseServer.from("hr_job_postings").select("id, title, department_id, status, closes_at").in("status", ["open", "paused"]).order("created_at", { ascending: false }).limit(101), "job postings");
      if (!posts.length) return { rows: [] };
      const [apps, depts] = await Promise.all([
        supabaseServer.from("hr_applicants").select("job_posting_id, stage").in("job_posting_id", posts.map((p) => p.id)).limit(5000).then((r) => listOf<{ job_posting_id: string; stage: string | null }>(r, "applicants")),
        deptNames(x.auth),
      ]);
      return { rows: posts.map((p) => {
        const mine = apps.filter((a) => a.job_posting_id === p.id);
        const at = (stage: string) => mine.filter((a) => a.stage === stage).length;
        return { key: p.id, cells: { job: p.title || "—", department: (p.department_id && depts.get(p.department_id)) || "", applicants: mine.length, screening: at("screening"), interview: at("interview"), offer: at("offer"), hired: at("hired"), closes: day(p.closes_at) } };
      }) };
    }
    case "onboarding": {
      const p = people[0];
      const inst = listOf<{ id: string; checklist_id: string; start_date: string | null; items_status: unknown }>(
        await supabaseServer.from("hr_checklist_instances").select("id, checklist_id, start_date, items_status").eq("employee_id", p.id).order("start_date", { ascending: false }).limit(10), "checklist instances");
      if (!inst.length) return { rows: [] };
      const lists = listOf<{ id: string; type: string | null; items: unknown }>(await supabaseServer.from("hr_checklists").select("id, type, items").in("id", inst.map((i) => i.checklist_id)), "checklists");
      const typeOf = new Map(lists.map((l) => [l.id, l]));
      const pick = inst.find((i) => typeOf.get(i.checklist_id)?.type === "onboarding") ?? inst[0];
      const items = Array.isArray(typeOf.get(pick.checklist_id)?.items) ? (typeOf.get(pick.checklist_id)!.items as Array<{ title?: string; due_days?: number }>) : [];
      const states = Array.isArray(pick.items_status) ? (pick.items_status as Array<{ item_index?: number; completed?: boolean; completed_at?: string | null }>) : [];
      const startDay = day(pick.start_date);
      return { rows: items.map((it, i) => {
        const s = states.find((z) => z.item_index === i);
        return { key: `${pick.id}:${i}`, cells: {
          step: (it.title ?? "").trim() || "—", due: startDay && typeof it.due_days === "number" ? addDays(startDay, it.due_days) : null,
          state: s?.completed ? "completed" : "open", done_on: s?.completed ? day(s.completed_at ?? null) : null,
        } };
      }) };
    }
    case "staff_attendance": case "late_absence": case "overtime_hours": {
      const days = await daysOf(sh, x.auth.tenant_id ?? null, people, from, to, today);
      const rows: ReportDataRow[] = [];
      const explained = src === "late_absence" ? await explanations(x, people, from, to) : new Map<string, number>();
      for (const p of [...people].sort(byName)) {
        const list = days.get(p.id);
        if (!list) continue;
        const d = personDays(list, from, to);
        if (src === "staff_attendance") {
          if (!d.workdays && !d.hours) continue;
          rows.push({ key: p.id, cells: { person: p.name, workdays: d.workdays, present: d.present, late_days: d.late, absent: d.absent, leave_days: d.leave, hours: d.hours, overtime_h: d.approvedH } });
        } else if (src === "late_absence") {
          if (!d.late && !d.absent) continue;
          rows.push({ key: p.id, cells: { person: p.name, department: p.department, late_days: d.late, late_minutes: d.lateMin, absent: d.absent, explained: explained.get(p.id) ?? 0 } });
        } else {
          if (!d.overtimeDays) continue;
          rows.push({ key: p.id, cells: { person: p.name, ot_days: d.overtimeDays, approved_h: d.approvedH, pending_h: d.pendingH } });
        }
      }
      return { rows };
    }
    case "leave_balances": {
      const year = Number(from.slice(0, 4));
      const out: Array<{ id: string; employee_id: string; entitled: unknown; used: unknown; carried_over: unknown; adjustment: unknown; hr_leave_types?: { name?: string | null } | Array<{ name?: string | null }> | null }> = [];
      for (const part of chunks(ids)) {
        out.push(...listOf<typeof out[number]>(await supabaseServer.from("hr_leave_balances").select("id, employee_id, entitled, used, carried_over, adjustment, hr_leave_types(name)").eq("year", year).in("employee_id", part), "leave balances"));
      }
      return { rows: out.map((b) => {
        const entitled = (num(b.entitled) ?? 0) + (num(b.carried_over) ?? 0) + (num(b.adjustment) ?? 0);
        const used = num(b.used) ?? 0;
        return { key: b.id, name: nameOf.get(b.employee_id)?.name ?? "—", type: one(b.hr_leave_types)?.name ?? "—", entitled, used };
      }).filter((b) => b.entitled || b.used)
        .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
        .map((b) => ({ key: b.key, cells: { person: b.name, leave_type: b.type, entitled: b.entitled, used: b.used, remaining: Math.round((b.entitled - b.used) * 100) / 100 } })) };
    }
    case "leave_taken": {
      const out: Array<{ id: string; employee_id: string; start_date: string; end_date: string; days: unknown; status: string; hr_leave_types?: { name?: string | null } | Array<{ name?: string | null }> | null }> = [];
      for (const part of chunks(ids)) {
        out.push(...listOf<typeof out[number]>(await supabaseServer.from("hr_leave_requests").select("id, employee_id, start_date, end_date, days, status, hr_leave_types(name)")
          .in("employee_id", part).in("status", ["pending", "manager_approved", "approved"]).lte("start_date", to).gte("end_date", from), "leave requests"));
      }
      return { rows: out.sort((a, b) => a.start_date.localeCompare(b.start_date)).map((r) => ({ key: r.id, cells: {
        person: nameOf.get(r.employee_id)?.name ?? "—", leave_type: one(r.hr_leave_types)?.name ?? "—", starts: day(r.start_date), ends: day(r.end_date), days_off: num(r.days), status: r.status,
      } })) };
    }
    case "payroll": {
      const slips: Array<{ id: string; employee_id: string; gross_amount: unknown; net_amount: unknown; employer_contributions: unknown; status: string | null; currency: string | null }> = [];
      for (const part of chunks(ids)) {
        slips.push(...listOf<typeof slips[number]>(await supabaseServer.from("hr_payslips").select("id, employee_id, gross_amount, net_amount, employer_contributions, status, currency")
          .in("employee_id", part).lte("period_start", to).gte("period_end", from), "payslips"));
      }
      return { rows: slips.map((sl) => {
        const gross = num(sl.gross_amount), net = num(sl.net_amount);
        const employer = sl.employer_contributions && typeof sl.employer_contributions === "object"
          ? Math.round(Object.values(sl.employer_contributions as Record<string, unknown>).reduce<number>((a, v) => a + (Number(v) || 0), 0) * 100) / 100 : null;
        return { key: sl.id, currency: sl.currency ?? undefined, name: nameOf.get(sl.employee_id)?.name ?? "—", cells: {
          person: nameOf.get(sl.employee_id)?.name ?? "—", gross, deductions: gross !== null && net !== null ? Math.round((gross - net) * 100) / 100 : null, net, employer, status: sl.status,
        } };
      }).sort((a, b) => a.name.localeCompare(b.name)).map(({ key, currency, cells }) => ({ key, currency, cells })) };
    }
    case "staff_cost": case "salaries": {
      const recs = await currentSalaries(ids, today);
      if (src === "salaries") {
        return { rows: [...people].sort(byName).map((p) => {
          const r = recs.get(p.id);
          return { key: p.id, ...(r ? { currency: r.currency } : {}), cells: { person: p.name, department: p.department, current: r ? r.monthly : null } };
        }) };
      }
      const by = new Map<string, { department: string; currency: string; people: number; monthly: number }>();
      for (const p of people) {
        const r = recs.get(p.id);
        if (!r) continue;
        const k = `${p.department || "—"}|${r.currency}`;
        const cur = by.get(k) ?? { department: p.department || "—", currency: r.currency, people: 0, monthly: 0 };
        cur.people++; cur.monthly += r.monthly;
        by.set(k, cur);
      }
      return { rows: Array.from(by, ([k, v]) => ({ key: `dept:${k}`, currency: v.currency, cells: { department: v.department, people: v.people, monthly: Math.round(v.monthly * 100) / 100 } }))
        .sort((a, b) => String(a.cells.department).localeCompare(String(b.cells.department)) || String(a.currency).localeCompare(String(b.currency))) };
    }
    case "insurance": {
      /* The provider, the class and the expiry are private columns. */
      if (!canViewPrivate(x.auth)) return "denied";
      return { rows: [...people].sort(byName).filter((p) => p.row.insurance_provider || p.row.insurance_class || p.row.insurance_expiry_date).map((p) => {
        const exp = day(p.row.insurance_expiry_date);
        return { key: p.id, cells: { person: p.name, provider: p.row.insurance_provider ?? "", class: p.row.insurance_class ?? "", expires: exp, days_left: exp ? Math.round((Date.parse(exp) - Date.parse(today)) / 86_400_000) : null } };
      }) };
    }
    case "appraisals": {
      const subject = x.about("employee");
      let cycleIds: string[] | null = null;
      let cycles: Array<{ id: string; name: string | null; start_date: string | null; end_date: string | null }> = [];
      if (!subject) {
        cycles = await cyclesFor(from, to);
        if (!cycles.length) return { rows: [] };
        cycleIds = [cycles[0].id];
      }
      const list: Array<{ id: string; cycle_id: string; employee_id: string; self_rating: number | null; reviewer_rating: number | null; overall_score: unknown; status: string | null; created_at: string }> = [];
      for (const part of chunks(ids)) {
        let q = supabaseServer.from("hr_appraisals").select("id, cycle_id, employee_id, self_rating, reviewer_rating, overall_score, status, created_at").in("employee_id", part);
        if (cycleIds) q = q.in("cycle_id", cycleIds);
        list.push(...listOf<typeof list[number]>(await q.order("created_at", { ascending: false }).limit(500), "appraisals"));
      }
      if (subject) cycles = listOf<typeof cycles[number]>(await supabaseServer.from("hr_appraisal_cycles").select("id, name, start_date, end_date").in("id", Array.from(new Set(list.map((a) => a.cycle_id))).slice(0, 100)), "appraisal cycles");
      const cycleName = new Map(cycles.map((c) => [c.id, c.name ?? ""]));
      return { rows: list.map((a) => ({ key: a.id, cells: {
        person: nameOf.get(a.employee_id)?.name ?? "—", cycle: cycleName.get(a.cycle_id) ?? "", self_rating: a.self_rating, reviewer_rating: a.reviewer_rating, overall: num(a.overall_score), status: a.status,
      } })).sort((a, b) => String(a.cells.person).localeCompare(String(b.cells.person))) };
    }
    case "appraisal_results": {
      const cycles = await cyclesFor(from, to);
      if (!cycles.length) return { rows: [] };
      const list = listOf<{ employee_id: string; status: string | null; overall_score: unknown }>(
        await supabaseServer.from("hr_appraisals").select("employee_id, status, overall_score").eq("cycle_id", cycles[0].id).limit(3000), "appraisals");
      return { rows: appraisalResultRows(list.filter((a) => nameOf.has(a.employee_id)).map((a) => ({ department: nameOf.get(a.employee_id)!.department, status: a.status, overall: num(a.overall_score) }))) };
    }
    case "training": {
      const recs: Array<{ id: string; employee_id: string; course_id: string | null; status: string | null; enrolled_at: string | null; completed_at: string | null; score: unknown; expiry_date: string | null }> = [];
      const lo = `${from}T00:00:00Z`, hi = `${addDays(to, 1)}T00:00:00Z`;
      for (const part of chunks(ids)) {
        recs.push(...listOf<typeof recs[number]>(await supabaseServer.from("hr_training_records").select("id, employee_id, course_id, status, enrolled_at, completed_at, score, expiry_date")
          .in("employee_id", part).or(`and(enrolled_at.gte.${lo},enrolled_at.lt.${hi}),and(completed_at.gte.${lo},completed_at.lt.${hi})`), "training records"));
      }
      const courseIds = Array.from(new Set(recs.map((r) => r.course_id).filter((c): c is string => !!c)));
      const courses = courseIds.length ? new Map(listOf<{ id: string; name: string | null }>(await supabaseServer.from("hr_courses").select("id, name").in("id", courseIds.slice(0, 200)), "courses").map((c) => [c.id, c.name ?? ""])) : new Map<string, string>();
      return { rows: recs.map((r) => ({ key: r.id, cells: {
        person: nameOf.get(r.employee_id)?.name ?? "—", course: (r.course_id && courses.get(r.course_id)) || "—", status: r.status, done_on: day(r.completed_at), score: num(r.score), expires: day(r.expiry_date),
      } })).sort((a, b) => String(a.cells.person).localeCompare(String(b.cells.person))) };
    }
    case "skills": {
      let sq = supabaseServer.from("skills").select("id, name").eq("is_active", true).limit(1000);
      if (x.auth.tenant_id) sq = sq.or(`tenant_id.eq.${x.auth.tenant_id},tenant_id.is.null`);
      const [skills, assessed, reqs] = await Promise.all([
        sq.then((r) => listOf<{ id: string; name: string }>(r, "skills")),
        (async () => { const all: Array<{ employee_id: string; skill_id: string; employee_score: number | null }> = []; for (const part of chunks(ids)) all.push(...listOf<typeof all[number]>(await supabaseServer.from("employee_skill_assessments").select("employee_id, skill_id, employee_score").in("employee_id", part), "skill assessments")); return all; })(),
        supabaseServer.from("position_skill_requirements").select("position_id, skill_id, required_score").limit(5000).then((r) => listOf<{ position_id: string; skill_id: string; required_score: number | null }>(r, "position skills")),
      ]);
      const reqOf = new Map(reqs.map((r) => [`${r.position_id}|${r.skill_id}`, r.required_score]));
      const requiredBy = new Map<string, number>();
      for (const r of reqs) requiredBy.set(r.skill_id, (requiredBy.get(r.skill_id) ?? 0) + 1);
      return { rows: skillRows(skills, assessed.filter((a) => typeof a.employee_score === "number").map((a) => {
        const pos = nameOf.get(a.employee_id)?.positionId;
        const req = pos ? reqOf.get(`${pos}|${a.skill_id}`) : undefined;
        return { skillId: a.skill_id, score: a.employee_score!, required: typeof req === "number" ? req : null };
      }), requiredBy) };
    }
    case "behavior": {
      const list: Array<{ employee_id: string; overall_behavior_score: unknown; position_behavior_match: unknown; critical_gap_count: number | null; recommendation: string | null; finalized_at: string | null }> = [];
      for (const part of chunks(ids)) {
        let q = supabaseServer.from("employee_behavior_assessments").select("employee_id, overall_behavior_score, position_behavior_match, critical_gap_count, recommendation, finalized_at").in("employee_id", part).eq("status", "finalized");
        if (x.auth.tenant_id) q = q.or(`tenant_id.eq.${x.auth.tenant_id},tenant_id.is.null`);
        list.push(...listOf<typeof list[number]>(await q.order("finalized_at", { ascending: false }), "behavior assessments"));
      }
      const latest = new Map<string, typeof list[number]>();
      for (const a of list) if (!latest.has(a.employee_id)) latest.set(a.employee_id, a);
      return { rows: Array.from(latest.values()).map((a) => ({ key: a.employee_id, cells: {
        person: nameOf.get(a.employee_id)?.name ?? "—", score: num(a.overall_behavior_score), match: num(a.position_behavior_match), critical: a.critical_gap_count ?? 0, recommendation: a.recommendation,
      } })).sort((a, b) => Number(a.cells.score ?? 999) - Number(b.cells.score ?? 999)) };
    }
    case "grievances": {
      /* Counts only — never a name, a title or a word of one. */
      const lo = `${addDays(`${to.slice(0, 7)}-01`, -150).slice(0, 7)}-01`;
      let q = supabaseServer.from("work_reports").select("id, submitted_at, work_report_recipients(read_at, acknowledged_at)")
        .eq("template_key", "hr_grievance").neq("status", "draft").eq("superseded", false).gte("submitted_at", `${lo}T00:00:00Z`).lt("submitted_at", `${addDays(to, 1)}T00:00:00Z`).limit(2000);
      if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
      const list = listOf<{ id: string; submitted_at: string | null; work_report_recipients?: Array<{ read_at: string | null; acknowledged_at: string | null }> | null }>(await q, "grievances");
      const by = new Map<string, { received: number; unread: number; acknowledged: number }>();
      for (let m = lo.slice(0, 7); m <= to.slice(0, 7); m = addDays(`${m}-01`, 32).slice(0, 7)) by.set(m, { received: 0, unread: 0, acknowledged: 0 });
      for (const g of list) {
        const m = g.submitted_at?.slice(0, 7);
        const cur = m ? by.get(m) : undefined;
        if (!cur) continue;
        const recs = g.work_report_recipients ?? [];
        cur.received++;
        if (!recs.some((r) => r.read_at)) cur.unread++;
        if (recs.some((r) => r.acknowledged_at)) cur.acknowledged++;
      }
      return { rows: Array.from(by, ([m, v]) => ({ key: m, cells: { month: `${m.slice(5, 7)}/${m.slice(0, 4)}`, ...v } })) };
    }
    case "movement": {
      const all = await sh.staff();
      const moves: MoveFact[] = [];
      for (const s of all) {
        if (s.hire && s.hire >= from && s.hire <= to) moves.push({ key: `${s.id}:hire`, person: s.name, change: "hire", date: s.hire, detail: s.department });
        if (s.left && s.left >= from && s.left <= to) moves.push({ key: `${s.id}:exit`, person: s.name, change: "exit", date: s.left, detail: s.department });
      }
      /* A move: a new department on an assignment that started in the days,
         when the person had another one before it. */
      const persons = all.map((s) => s.personId).filter((p): p is string => !!p);
      const asg: Array<{ person_id: string; department_id: string | null; start_date: string | null }> = [];
      for (const part of chunks(persons)) asg.push(...listOf<typeof asg[number]>(await supabaseServer.from("koleex_assignments").select("person_id, department_id, start_date").in("person_id", part).eq("is_primary", true).order("start_date", { ascending: true }), "assignments"));
      const depts = await deptNames(x.auth);
      const byPerson = new Map<string, typeof asg>();
      for (const a of asg) byPerson.set(a.person_id, [...(byPerson.get(a.person_id) ?? []), a]);
      for (const s of all) {
        const list = s.personId ? byPerson.get(s.personId) ?? [] : [];
        for (let i = 1; i < list.length; i++) {
          const a = list[i], prev = list[i - 1];
          const d = day(a.start_date);
          if (!d || d < from || d > to || a.department_id === prev.department_id) continue;
          moves.push({ key: `${s.id}:move:${d}`, person: s.name, change: "move", date: d, detail: `${(prev.department_id && depts.get(prev.department_id)) || "—"} → ${(a.department_id && depts.get(a.department_id)) || "—"}` });
        }
      }
      return { rows: movementRows(moves, from, to) };
    }
    case "turnover":
      return { rows: turnoverRows(await sh.staff(), from, to) };
    case "headcount":
      return { rows: headcountRows(await sh.staff()) };
    case "expiring": case "contracts": {
      const facts: ExpiryFact[] = [];
      const priv = canViewPrivate(x.auth);
      for (const p of people) {
        const r = p.row;
        if (src === "contracts") {
          const d = day(r.contract_end_date);
          if (d) facts.push({ key: p.id, person: p.name, employeeId: p.id, what: r.employment_type ?? "", date: d });
          continue;
        }
        const add = (what: string, v: string | null) => { const d = day(v); if (d) facts.push({ key: `${p.id}:${what}`, person: p.name, employeeId: p.id, what, date: d }); };
        add("visa", r.visa_expiry_date); add("contract", r.contract_end_date); add("probation", r.probation_end_date); add("licence", r.driving_license_expiry);
        if (priv) add("insurance", r.insurance_expiry_date);
      }
      if (src === "expiring" && ids.length) {
        for (const part of chunks(ids)) {
          const docs = listOf<{ id: string; employee_id: string; name: string | null; expiry_date: string | null }>(await supabaseServer.from("hr_documents").select("id, employee_id, name, expiry_date").in("employee_id", part).not("expiry_date", "is", null).gte("expiry_date", today).lte("expiry_date", addDays(today, 90)), "HR documents");
          for (const d of docs) if (d.expiry_date) facts.push({ key: `${d.employee_id}:doc:${d.id}`, person: nameOf.get(d.employee_id)?.name ?? "—", employeeId: d.employee_id, what: d.name?.trim() || "document", date: d.expiry_date.slice(0, 10) });
        }
      }
      const rows = expiryRows(facts, today, 90);
      if (src === "contracts") return { rows: rows.map((r) => ({ key: r.key, cells: { person: r.cells.person, expires: r.cells.expires, days_left: r.cells.days_left, employment: nameOf.get(r.key)?.type ?? null } })) };
      return { rows };
    }
    case "missing_files": {
      const docCount = new Map<string, number>();
      for (const part of chunks(ids)) for (const d of listOf<{ employee_id: string }>(await supabaseServer.from("hr_documents").select("employee_id").in("employee_id", part).limit(5000), "HR documents")) docCount.set(d.employee_id, (docCount.get(d.employee_id) ?? 0) + 1);
      return { rows: [...people].sort(byName).map((p) => {
        const r = p.row;
        const gaps = fileGaps({
          department: p.department || null, managerId: r.manager_id, hireDate: r.hire_date, birthDate: r.birth_date,
          idDocument: !!(r.national_id_doc_url || r.passport_doc_url), emergency: !!(r.emergency_contact_name && r.emergency_contact_phone),
          bank: !!(r.bank_account_number || r.bank_iban), documents: docCount.get(p.id) ?? 0,
        });
        return { key: p.id, gaps, cells: { person: p.name, department: p.department, gaps: gaps.join("|") } };
      }).filter((r) => r.gaps.length).map(({ key, cells }) => ({ key, cells })) };
    }
    case "hr_kpis": {
      const all = await sh.staff();
      const turnover = turnoverRows(all, from, to)[0]?.cells ?? {};
      const days = await daysOf(sh, x.auth.tenant_id ?? null, people, from, to, today);
      let absent = 0, late = 0, leave = 0, ot = 0;
      for (const list of days.values()) { const d = personDays(list, from, to); absent += d.absent; late += d.late; leave += d.leave; ot += d.approvedH; }
      const posts = listOf<{ id: string }>(await supabaseServer.from("hr_job_postings").select("id").eq("status", "open").limit(500), "job postings");
      const apps = posts.length ? listOf<{ stage: string | null }>(await supabaseServer.from("hr_applicants").select("stage").in("job_posting_id", posts.map((p) => p.id)).limit(5000), "applicants").filter((a) => a.stage !== "rejected" && a.stage !== "hired").length : 0;
      return { rows: hrKpiRows({
        headcount: all.filter((s) => ACTIVE.includes(s.status)).length, hires: Number(turnover.hires ?? 0), leavers: Number(turnover.leavers ?? 0), turnover: Number(turnover.rate ?? 0),
        absentDays: absent, lateDays: late, leaveDays: leave, overtimeHours: ot, openJobs: posts.length, applicants: apps,
      }) };
    }
  }
}

/** The attendance notes (late / absence explanations) each person sent in the days. */
async function explanations(x: HrCtx, people: Staff[], from: string, to: string): Promise<Map<string, number>> {
  const byAccount = new Map(people.filter((p) => p.accountId).map((p) => [p.accountId!, p.id]));
  const out = new Map<string, number>();
  for (const part of chunks(Array.from(byAccount.keys()))) {
    let q = supabaseServer.from("work_reports").select("author_account_id").eq("template_key", "attendance_note").neq("status", "draft").eq("superseded", false)
      .in("author_account_id", part).lte("period_start", to).gte("period_end", from).limit(2000);
    if (x.auth.tenant_id) q = q.eq("tenant_id", x.auth.tenant_id);
    for (const r of listOf<{ author_account_id: string }>(await q, "attendance notes")) {
      const emp = byAccount.get(r.author_account_id);
      if (emp) out.set(emp, (out.get(emp) ?? 0) + 1);
    }
  }
  return out;
}

/** Each person's salary now: base + allowances a month, in its currency. */
async function currentSalaries(ids: string[], today: string): Promise<Map<string, { monthly: number; currency: string }>> {
  const out = new Map<string, { monthly: number; currency: string; from: string }>();
  for (const part of chunks(ids)) {
    const recs = listOf<{ employee_id: string; base_salary: unknown; currency: string | null; allowances: unknown; effective_from: string | null }>(
      await supabaseServer.from("hr_salary_records").select("employee_id, base_salary, currency, allowances, effective_from").in("employee_id", part)
        .lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`), "salary records");
    for (const r of recs) {
      const allowances = r.allowances && typeof r.allowances === "object" ? Object.values(r.allowances as Record<string, unknown>).reduce<number>((a, v) => a + (Number(v) || 0), 0) : 0;
      const monthly = Math.round(((Number(r.base_salary) || 0) + allowances) * 100) / 100;
      const prev = out.get(r.employee_id);
      if (!prev || (r.effective_from ?? "") > prev.from) out.set(r.employee_id, { monthly, currency: (r.currency || "USD").toUpperCase(), from: r.effective_from ?? "" });
    }
  }
  return new Map(Array.from(out, ([k, v]) => [k, { monthly: v.monthly, currency: v.currency }]));
}

/** The appraisal cycle a report's days belong to — the latest that meets
 *  them, else the latest started before they end. */
async function cyclesFor(from: string, to: string): Promise<Array<{ id: string; name: string | null; start_date: string | null; end_date: string | null }>> {
  const list = listOf<{ id: string; name: string | null; start_date: string | null; end_date: string | null }>(
    await supabaseServer.from("hr_appraisal_cycles").select("id, name, start_date, end_date").order("start_date", { ascending: false }).limit(50), "appraisal cycles");
  const meets = list.filter((c) => (!c.start_date || c.start_date <= to) && (!c.end_date || c.end_date >= from));
  if (meets.length) return meets;
  return list.filter((c) => !c.start_date || c.start_date <= to);
}
