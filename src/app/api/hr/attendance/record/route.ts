import "server-only";

/* ---------------------------------------------------------------------------
   PATCH /api/hr/attendance/record — HR (or the owner) sets a day's times
   (Phase 1, owner-approved 23 Sep 2026). Replaces "clock out on behalf",
   which stamped the moment HR pressed the button and looked the day up by
   UTC date.

   Body: { employee_id, date, clock_in: "HH:MM", clock_out: "HH:MM" | "",
           break_minutes, reason }. Times are wall-clock in the EMPLOYEE's
   attendance-policy zone, so a China policy means China time whatever the
   editor's browser says. A reason is required; the change is written to
   hr_attendance_corrections with the day before and after.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadPolicy, resolveEmployeeCountry, wallClockToIso } from "@/lib/server/work-calendar";
import { auditDayChange, setDayTimes } from "@/lib/server/attendance-records";

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as {
    employee_id?: unknown; date?: unknown; clock_in?: unknown; clock_out?: unknown; break_minutes?: unknown; reason?: unknown;
  } | null;
  const employeeId = typeof body?.employee_id === "string" && UUID.test(body.employee_id) ? body.employee_id : "";
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
  const inRaw = typeof body?.clock_in === "string" ? body.clock_in.trim() : "";
  const outRaw = typeof body?.clock_out === "string" ? body.clock_out.trim() : "";
  const breakMin = Number(body?.break_minutes ?? 0);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!employeeId || !date) return NextResponse.json({ error: "employee_id and date required" }, { status: 400 });
  if (!HHMM.test(inRaw) || (outRaw && !HHMM.test(outRaw))) return NextResponse.json({ error: "bad_time" }, { status: 400 });
  if (!Number.isFinite(breakMin) || breakMin < 0 || breakMin > 720) return NextResponse.json({ error: "bad_break" }, { status: 400 });
  if (reason.length < 3) return NextResponse.json({ error: "no_reason" }, { status: 400 });

  const policy = await loadPolicy(await resolveEmployeeCountry(employeeId));
  const clockIn = wallClockToIso(date, inRaw, policy.timezone);
  const clockOut = outRaw ? wallClockToIso(date, outRaw, policy.timezone) : null;
  const res = await setDayTimes({ employeeId, date, times: { clockIn, clockOut, breakMinutes: breakMin }, policy });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "save_failed" ? 500 : 400 });
  await auditDayChange({ tenantId: auth.tenant_id, employeeId, date, kind: "edit", status: "applied", reason, actorAccountId: auth.account_id, before: res.before, after: res.after });
  return NextResponse.json({ record: res.after });
}
