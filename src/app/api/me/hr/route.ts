import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/me/hr — everything the employee's own "My HR" page shows, in ONE
   request.

   Identity-scoped, not permission-scoped: the caller sees their OWN record
   and nothing else, so no HR module permission is required. The employee id
   comes from resolveMyEmployee(auth) — never from the request — and every
   table below is filtered by it. hr_* tables are RLS deny-all; this route
   reads them with the service role on the employee's behalf.

   One request because the page is opened many times a day for a five-second
   look ("did my leave get approved?", "did I clock in?"): six small tables
   for one person is a few KB, and one round-trip is the whole wait. The
   client warm-starts from the previous payload and reconciles.

   Response: MyHrBundle (src/lib/me-hr-types.ts).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { cleanTz, resolveMyEmployee, todayIso } from "@/lib/server/me-hr";
import { loadPolicy, loadWorkCalendar, resolveEmployeeCountry } from "@/lib/server/work-calendar";
import type {
  MyHrBundle, MyLeaveBalance, MyLeaveRequest, MyLeaveType, MyAttendanceRecord, MyPayslip, MyDocument, MyTeamRequest,
} from "@/lib/me-hr-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  /* ?tz=Africa/Cairo — the caller's zone decides which day is "today". */
  const today = todayIso(cleanTz(new URL(req.url).searchParams.get("tz")));
  const year = Number(today.slice(0, 4));
  const monthStart = `${today.slice(0, 7)}-01`;

  /* The working calendar of the country I work in, for the next year — the
     leave form counts days with it, so the screen and the server agree. */
  const horizon = new Date(`${today}T00:00:00Z`); horizon.setUTCFullYear(horizon.getUTCFullYear() + 1);
  const country = await resolveEmployeeCountry(me.id);
  const calendarP = loadPolicy(country).then((pol) => loadWorkCalendar(auth.tenant_id, country, today, horizon.toISOString().slice(0, 10), pol));

  const [person, contacts, assignment, types, balances, requests, month, payslips, documents] = await Promise.all([
    me.personId
      ? supabaseServer.from("people")
          .select("full_name, name_alt, email, phone, mobile, avatar_url, address_line1, address_line2, city, country")
          .eq("id", me.personId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseServer.from("koleex_employees")
      .select("work_email, work_phone, wechat_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact2_name, emergency_contact2_phone, emergency_contact2_relationship")
      .eq("id", me.id).maybeSingle(),
    me.personId
      ? supabaseServer.from("koleex_assignments")
          .select("department_id, position_id, koleex_departments(name), koleex_positions(title)")
          .eq("person_id", me.personId).eq("is_active", true).eq("is_primary", true).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseServer.from("hr_leave_types").select("id, name, code, default_days, requires_doc, is_paid, is_active")
      .eq("is_active", true).order("name"),
    supabaseServer.from("hr_leave_balances").select("leave_type_id, year, entitled, used, carried_over, adjustment")
      .eq("employee_id", me.id).eq("year", year),
    supabaseServer.from("hr_leave_requests")
      .select("id, leave_type_id, start_date, end_date, days, half_day, half_day_period, reason, status, reviewed_at, review_notes, manager_reviewed_at, manager_notes, attachment_url, created_at")
      .eq("employee_id", me.id).order("start_date", { ascending: false }).limit(50),
    supabaseServer.from("hr_attendance_records")
      .select("id, date, clock_in, clock_out, break_minutes, total_hours, status")
      .eq("employee_id", me.id).gte("date", monthStart).lte("date", today).order("date", { ascending: false }),
    supabaseServer.from("hr_payslips")
      .select("id, period_start, period_end, gross_amount, deductions, net_amount, status, paid_at, currency")
      /* A draft is HR's working paper; the employee sees a slip once it is approved. */
      .eq("employee_id", me.id).in("status", ["approved", "paid"]).order("period_start", { ascending: false }).limit(24),
    supabaseServer.from("hr_documents")
      .select("id, name, category, file_url, file_type, expiry_date, created_at")
      .eq("employee_id", me.id).order("created_at", { ascending: false }),
  ]);

  /* Phase B — my reports' requests waiting for me. The team is whoever
     lists me as manager_id; a request of theirs is mine to decide only while
     `pending` (HR takes over after). */
  const { data: reports } = await supabaseServer.from("koleex_employees")
    .select("id, people(full_name, name_alt)").eq("manager_id", me.id).neq("id", me.id);
  const reportRows = (reports ?? []) as Array<{ id: string; people?: { full_name?: string | null; name_alt?: string | null } | { full_name?: string | null; name_alt?: string | null }[] | null }>;
  const teamIds = reportRows.map((r) => r.id);
  let teamPending: MyTeamRequest[] = [];
  if (teamIds.length > 0) {
    const { data: rows } = await supabaseServer.from("hr_leave_requests")
      .select("id, employee_id, leave_type_id, start_date, end_date, days, half_day, half_day_period, reason, attachment_url, created_at")
      .in("employee_id", teamIds).eq("status", "pending").order("start_date", { ascending: true }).limit(100);
    const nameOf = (id: string) => { const r = reportRows.find((x) => x.id === id); const p = Array.isArray(r?.people) ? r?.people[0] : r?.people; return { name: p?.full_name ?? "Employee", alt: p?.name_alt ?? null }; };
    teamPending = ((rows ?? []) as Array<Omit<MyTeamRequest, "employee_name" | "employee_name_alt">>).map((r) => ({
      ...r, employee_name: nameOf(r.employee_id).name, employee_name_alt: nameOf(r.employee_id).alt,
    }));
  }

  /* Manager — the person behind manager_id. Sequential on purpose: it
     depends on nothing above but is needed only when set, which is rare
     enough that a wasted parallel query would cost more than it saves. */
  let managerName: string | null = null;
  if (me.managerId) {
    const mgr = await supabaseServer.from("koleex_employees").select("people(full_name)").eq("id", me.managerId).maybeSingle();
    const p = (mgr.data as { people?: { full_name?: string } | { full_name?: string }[] | null } | null)?.people;
    managerName = (Array.isArray(p) ? p[0]?.full_name : p?.full_name) ?? null;
  }

  const typeRows = (types.data ?? []) as Array<{ id: string; name: string; code: string; default_days: number; requires_doc: boolean; is_paid: boolean }>;
  const balanceRows = (balances.data ?? []) as Array<{ leave_type_id: string; entitled: number; used: number; carried_over: number; adjustment: number }>;

  /* A balance the HR app never initialised is shown from the type's default
     entitlement, flagged `virtual` — the employee sees "21 days" instead of a
     blank, and NOTHING is inserted: balances are HR's to create. */
  const leaveTypes: MyLeaveType[] = typeRows.map((t) => ({
    id: t.id, code: t.code, name: t.name, defaultDays: Number(t.default_days ?? 0), requiresDoc: !!t.requires_doc, isPaid: !!t.is_paid,
  }));
  const leaveBalances: MyLeaveBalance[] = typeRows.map((t) => {
    const b = balanceRows.find((r) => r.leave_type_id === t.id);
    const entitled = b ? Number(b.entitled) : Number(t.default_days ?? 0);
    const used = b ? Number(b.used) : 0;
    const carriedOver = b ? Number(b.carried_over) : 0;
    const adjustment = b ? Number(b.adjustment) : 0;
    return {
      leaveTypeId: t.id, code: t.code, year, entitled, used, carriedOver, adjustment,
      remaining: entitled + carriedOver + adjustment - used, virtual: !b,
    };
  }).filter((b) => b.entitled > 0 || b.used > 0 || b.carriedOver > 0 || b.adjustment > 0);

  const monthRows = (month.data ?? []) as MyAttendanceRecord[];
  const p = person.data as Record<string, string | null> | null;
  const c = contacts.data as Record<string, string | null> | null;
  const a = assignment.data as {
    department_id?: string | null; position_id?: string | null;
    koleex_departments?: { name?: string } | { name?: string }[] | null;
    koleex_positions?: { title?: string } | { title?: string }[] | null;
  } | null;
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  const bundle: MyHrBundle = {
    serverDate: today,
    employee: {
      id: me.id,
      employeeNumber: me.employeeNumber,
      departmentName: one(a?.koleex_departments)?.name ?? me.department ?? null,
      positionTitle: one(a?.koleex_positions)?.title ?? me.position ?? null,
      hireDate: me.hireDate,
      employmentStatus: me.employmentStatus,
      employmentType: me.employmentType,
      workLocation: me.workLocation,
      managerName,
    },
    person: {
      fullName: p?.full_name ?? auth.username,
      nameAlt: p?.name_alt ?? null,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      mobile: p?.mobile ?? null,
      avatarUrl: p?.avatar_url ?? null,
      addressLine1: p?.address_line1 ?? null,
      addressLine2: p?.address_line2 ?? null,
      city: p?.city ?? null,
      country: p?.country ?? null,
    },
    contacts: {
      workEmail: c?.work_email ?? null,
      workPhone: c?.work_phone ?? null,
      wechatId: c?.wechat_id ?? null,
      emergency1: { name: c?.emergency_contact_name ?? null, phone: c?.emergency_contact_phone ?? null, relationship: c?.emergency_contact_relationship ?? null },
      emergency2: { name: c?.emergency_contact2_name ?? null, phone: c?.emergency_contact2_phone ?? null, relationship: c?.emergency_contact2_relationship ?? null },
    },
    leave: {
      types: leaveTypes,
      balances: leaveBalances,
      requests: ((requests.data ?? []) as MyLeaveRequest[]),
    },
    attendance: {
      today: monthRows.find((r) => r.date === today) ?? null,
      month: monthRows,
      monthHours: Math.round(monthRows.reduce((s, r) => s + Number(r.total_hours ?? 0), 0) * 100) / 100,
    },
    team: { isManager: teamIds.length > 0, pending: teamPending },
    calendar: await calendarP,
    payslips: ((payslips.data ?? []) as MyPayslip[]),
    documents: ((documents.data ?? []) as MyDocument[]),
  };

  return NextResponse.json(bundle, { headers: { "Cache-Control": "private, no-store" } });
}
