import "server-only";
import { dmyDate } from "@/lib/work-reports";

/* ---------------------------------------------------------------------------
   /api/me/hr/attendance/corrections — MY correction requests (Phase 1,
   owner-approved 23 Sep 2026).

   GET  — my requests of the last 120 days, newest first.
   POST — { date, clock_in: "HH:MM" | null, clock_out: "HH:MM" | null, reason,
            tz }: "I forgot to clock out", "the time is wrong". The times are
          wall-clock in my attendance policy's zone. Nothing changes on the
          day until HR or the owner approves (POST /api/hr/attendance/
          corrections/[id]); they are told at once.

   Identity-scoped like every /api/me/hr route: the employee is resolved from
   the session, never read from the request.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { cleanTz, resolveMyEmployee, todayIso } from "@/lib/server/me-hr";
import { loadPolicy, resolveEmployeeCountry, wallClockToIso } from "@/lib/server/work-calendar";
import { hrReviewerAccountIds } from "@/lib/server/leave-review";
import { notifyLite } from "@/lib/server/notify-lite";

const COLS = "id, date, kind, status, clock_in, clock_out, reason, decision_note, created_at, decided_at";
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS_BACK = 60;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseServer.from("hr_attendance_corrections")
    .select(COLS).eq("employee_id", me.id).eq("kind", "request").gte("date", since).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load requests." }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { date?: unknown; clock_in?: unknown; clock_out?: unknown; reason?: unknown; tz?: unknown } | null;
  const today = todayIso(cleanTz(body?.tz));
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - MAX_DAYS_BACK * 86_400_000).toISOString().slice(0, 10);
  if (!date || date > today || date < oldest) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  const inRaw = typeof body?.clock_in === "string" && body.clock_in.trim() ? body.clock_in.trim() : null;
  const outRaw = typeof body?.clock_out === "string" && body.clock_out.trim() ? body.clock_out.trim() : null;
  if ((inRaw && !HHMM.test(inRaw)) || (outRaw && !HHMM.test(outRaw))) return NextResponse.json({ error: "bad_time" }, { status: 400 });
  if (!inRaw && !outRaw) return NextResponse.json({ error: "no_times" }, { status: 400 });
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) return NextResponse.json({ error: "no_reason" }, { status: 400 });

  const policy = await loadPolicy(await resolveEmployeeCountry(me.id));
  const clockIn = inRaw ? wallClockToIso(date, inRaw, policy.timezone) : null;
  const clockOut = outRaw ? wallClockToIso(date, outRaw, policy.timezone) : null;

  /* The day as it stands: a clock-out alone must still come after the
     clock-in the day already has, and a day with no clock-in needs one. */
  const { data: day } = await supabaseServer.from("hr_attendance_records")
    .select("clock_in").eq("employee_id", me.id).eq("date", date).maybeSingle();
  const effectiveIn = clockIn ?? (day as { clock_in?: string | null } | null)?.clock_in ?? null;
  if (!effectiveIn) return NextResponse.json({ error: "no_clock_in" }, { status: 400 });
  if (clockOut && Date.parse(clockOut) <= Date.parse(effectiveIn)) return NextResponse.json({ error: "out_before_in" }, { status: 400 });

  const { data: open } = await supabaseServer.from("hr_attendance_corrections")
    .select("id").eq("employee_id", me.id).eq("date", date).eq("status", "pending").limit(1);
  if (open && open.length > 0) return NextResponse.json({ error: "already_pending" }, { status: 409 });

  const { data, error } = await supabaseServer.from("hr_attendance_corrections").insert({
    employee_id: me.id, tenant_id: auth.tenant_id, date, kind: "request", status: "pending",
    clock_in: clockIn, clock_out: clockOut, reason, requested_by: auth.account_id,
  }).select(COLS).single();
  if (error || !data) {
    console.error("[api/me/hr/attendance/corrections]", error?.message);
    return NextResponse.json({ error: "Could not send the request." }, { status: 500 });
  }

  const { data: who } = await supabaseServer.from("koleex_employees").select("people(full_name)").eq("id", me.id).maybeSingle();
  const person = (who as { people?: { full_name?: string | null } | { full_name?: string | null }[] | null } | null)?.people;
  const name = (Array.isArray(person) ? person[0] : person)?.full_name ?? "Employee";
  after(async () => notifyLite({
    tenantId: auth.tenant_id,
    recipients: await hrReviewerAccountIds(auth.tenant_id),
    senderId: auth.account_id,
    subject: `Attendance correction — ${name}`,
    body: `${dmyDate(date)} · ${[inRaw ? `in ${inRaw}` : null, outRaw ? `out ${outRaw}` : null].filter(Boolean).join(" · ")} · ${reason}`,
    link: "/hr?tab=attendance",
    type: "attendance_correction_approval_request",
    metadata: { attendance_correction_id: (data as { id: string }).id, employee_id: me.id },
    tag: `att-correction-${(data as { id: string }).id}`,
  }));
  return NextResponse.json({ request: data }, { status: 201 });
}
