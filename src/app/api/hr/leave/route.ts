import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/hr/leave — HR files a leave request ON BEHALF of an employee.

   Until now the HR app inserted the row through the generic gateway, so an
   HR-filed request skipped everything the self-service path does: the
   country calendar for the day count, the overlap and balance checks, and
   above all the notification to the first approver (the direct manager,
   else HR). Both paths now end in the same row shape and the same
   notifyLeaveFiled(); the only difference is WHO may name the employee —
   here anyone with HR·create, there never.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";
import { computeBusinessDays, rangesOverlap } from "@/lib/hr/leave-days";
import { loadPolicy, loadWorkCalendar, resolveEmployeeCountry } from "@/lib/server/work-calendar";
import { notifyLeaveFiled } from "@/lib/server/leave-review";
import { pathBelongsToTenant } from "@/lib/server/storage-tenant";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 500): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const uuid = (v: unknown): string | null => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const employeeId = uuid(body.employee_id);
  const leaveTypeId = uuid(body.leave_type_id);
  const start = str(body.start_date, 10), end = str(body.end_date, 10);
  if (!employeeId || !leaveTypeId || !start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    return NextResponse.json({ error: "employee_id, leave_type_id, start_date and end_date are required" }, { status: 400 });
  }
  if (end < start) return NextResponse.json({ error: "end_before_start" }, { status: 400 });
  const { data: emp } = await supabaseServer.from("koleex_employees").select("id").eq("id", employeeId).maybeSingle();
  if (!emp) return NextResponse.json({ error: "unknown_employee" }, { status: 404 });

  const halfDay = body.half_day === true && start === end;
  const halfDayPeriod = halfDay ? str(body.half_day_period, 16) : null;
  const { data: type } = await supabaseServer.from("hr_leave_types").select("id, is_active").eq("id", leaveTypeId).maybeSingle();
  if (!(type as { is_active?: boolean } | null)?.is_active) return NextResponse.json({ error: "unknown_leave_type" }, { status: 400 });
  const attachment = str(body.attachment_url, 512);
  if (attachment && /^[^h]/.test(attachment) && !pathBelongsToTenant(attachment, auth.tenant_id)) return NextResponse.json({ error: "bad_attachment" }, { status: 400 });

  const country = await resolveEmployeeCountry(employeeId);
  const calendar = await loadWorkCalendar(auth.tenant_id, country, start, end, await loadPolicy(country));
  const days = halfDay ? 0.5 : computeBusinessDays(start, end, calendar);
  if (days <= 0) return NextResponse.json({ error: "no_working_days" }, { status: 400 });

  const { data: mine } = await supabaseServer.from("hr_leave_requests").select("start_date, end_date")
    .eq("employee_id", employeeId).in("status", ["pending", "manager_approved", "approved"]).gte("end_date", start).lte("start_date", end);
  if (((mine ?? []) as Array<{ start_date: string; end_date: string }>).some((r) => rangesOverlap(r.start_date, r.end_date, start, end))) {
    return NextResponse.json({ error: "overlap" }, { status: 409 });
  }

  /* HR files it, so requested_by is HR's own employee record (when HR is an
     employee) — the row says who typed it, the employee_id whose leave it is. */
  const me = await resolveMyEmployee(auth);
  const handover = uuid(body.handover_to);
  const { data, error } = await supabaseServer.from("hr_leave_requests").insert({
    employee_id: employeeId, leave_type_id: leaveTypeId, start_date: start, end_date: end, days,
    half_day: halfDay, half_day_period: halfDayPeriod, reason: str(body.reason, 2000), status: "pending",
    reviewed_by: null, reviewed_at: null, review_notes: null, attachment_url: attachment,
    contact_phone: str(body.contact_phone, 64), contact_address: str(body.contact_address, 500), destination: str(body.destination, 200),
    handover_to: handover, handover_notes: str(body.handover_notes, 2000),
    emergency_contact_name: str(body.emergency_contact_name, 200), emergency_contact_phone: str(body.emergency_contact_phone, 64),
    requested_by: me?.id ?? null,
  }).select("*").single();
  if (error) {
    console.error("[api/hr/leave POST]", error.message);
    return NextResponse.json({ error: "Could not file the request." }, { status: 500 });
  }
  await notifyLeaveFiled((data as { id: string }).id, auth.tenant_id, auth.account_id);
  return NextResponse.json({ request: data }, { status: 201 });
}
