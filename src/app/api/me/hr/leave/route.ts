import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/me/hr/leave — file a leave request for MYSELF.

   employee_id and requested_by are both the caller (resolveMyEmployee), so
   the body cannot file for anyone else no matter what it carries. The row
   lands `pending` exactly as if HR had typed it in the HR app — same table,
   same review flow, same balance maths (computeBusinessDays is the one
   shared counter).

   Rules enforced here, not trusted from the form:
     · type must be active; dates valid, end ≥ start, not more than a year
     · half_day only on a single date, with a period
     · requires_doc types need an attachment (a path from /api/me/hr/upload)
     · no overlap with my own pending/approved requests
     · days must fit the remaining balance (virtual balance = default_days)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";
import { computeBusinessDays, rangesOverlap } from "@/lib/hr/leave-days";
import { pathBelongsToTenant } from "@/lib/server/storage-tenant";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 500): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const leaveTypeId = str(body.leave_type_id, 64);
  const start = str(body.start_date, 10);
  const end = str(body.end_date, 10);
  if (!leaveTypeId || !start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    return NextResponse.json({ error: "leave_type_id, start_date and end_date are required" }, { status: 400 });
  }
  if (end < start) return NextResponse.json({ error: "end_before_start" }, { status: 400 });
  if (computeBusinessDays(start, end) > 260) return NextResponse.json({ error: "range_too_long" }, { status: 400 });

  const halfDay = body.half_day === true && start === end;
  const halfDayPeriod = halfDay ? str(body.half_day_period, 16) : null;
  if (halfDay && halfDayPeriod !== "morning" && halfDayPeriod !== "afternoon") {
    return NextResponse.json({ error: "half_day_period_required" }, { status: 400 });
  }

  const { data: type } = await supabaseServer.from("hr_leave_types")
    .select("id, default_days, requires_doc, is_active").eq("id", leaveTypeId).maybeSingle();
  const t = type as { id: string; default_days: number; requires_doc: boolean; is_active: boolean } | null;
  if (!t || !t.is_active) return NextResponse.json({ error: "unknown_leave_type" }, { status: 400 });

  /* An attachment must be a path this tenant owns — the upload route mints
     it, and a foreign path would be signable by nobody anyway, but rejecting
     it here keeps the row honest. */
  const attachment = str(body.attachment_url, 512);
  if (attachment && !pathBelongsToTenant(attachment, auth.tenant_id)) {
    return NextResponse.json({ error: "bad_attachment" }, { status: 400 });
  }
  if (t.requires_doc && !attachment) return NextResponse.json({ error: "attachment_required" }, { status: 400 });

  const days = halfDay ? 0.5 : computeBusinessDays(start, end);
  if (days <= 0) return NextResponse.json({ error: "no_working_days" }, { status: 400 });

  const [{ data: mine }, { data: bal }] = await Promise.all([
    supabaseServer.from("hr_leave_requests").select("start_date, end_date, status")
      .eq("employee_id", me.id).in("status", ["pending", "approved"]).gte("end_date", start).lte("start_date", end),
    supabaseServer.from("hr_leave_balances").select("entitled, used, carried_over, adjustment")
      .eq("employee_id", me.id).eq("leave_type_id", leaveTypeId).eq("year", Number(start.slice(0, 4))).maybeSingle(),
  ]);
  const clash = ((mine ?? []) as Array<{ start_date: string; end_date: string }>)
    .some((r) => rangesOverlap(r.start_date, r.end_date, start, end));
  if (clash) return NextResponse.json({ error: "overlap" }, { status: 409 });

  const b = bal as { entitled: number; used: number; carried_over: number; adjustment: number } | null;
  const remaining = b
    ? Number(b.entitled) + Number(b.carried_over) + Number(b.adjustment) - Number(b.used)
    : Number(t.default_days ?? 0);
  /* Unpaid-style types carry a 0 entitlement and are always requestable. */
  if (Number(t.default_days ?? 0) > 0 && days > remaining) {
    return NextResponse.json({ error: "exceeds_balance", remaining }, { status: 409 });
  }

  const { data, error } = await supabaseServer.from("hr_leave_requests").insert({
    employee_id: me.id,
    leave_type_id: leaveTypeId,
    start_date: start,
    end_date: end,
    days,
    half_day: halfDay,
    half_day_period: halfDayPeriod,
    reason: str(body.reason, 2000),
    status: "pending",
    reviewed_by: null, reviewed_at: null, review_notes: null,
    attachment_url: attachment,
    contact_phone: str(body.contact_phone, 64),
    contact_address: str(body.contact_address, 500),
    destination: str(body.destination, 200),
    handover_notes: str(body.handover_notes, 2000),
    emergency_contact_name: str(body.emergency_contact_name, 200),
    emergency_contact_phone: str(body.emergency_contact_phone, 64),
    requested_by: me.id,
  }).select("id, leave_type_id, start_date, end_date, days, half_day, half_day_period, reason, status, reviewed_at, review_notes, attachment_url, created_at").single();

  if (error) {
    console.error("[api/me/hr/leave POST]", error.message);
    return NextResponse.json({ error: "Could not file the request." }, { status: 500 });
  }
  return NextResponse.json({ request: data }, { status: 201 });
}
