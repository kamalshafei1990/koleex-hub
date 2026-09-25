import "server-only";
import { dmyDate } from "@/lib/work-reports";

/* ---------------------------------------------------------------------------
   GET /api/cron/attendance  (every 15 minutes)
   Forgotten clock-outs (Phase 1, owner-approved 23 Sep 2026):

   · REMINDER — once the policy's working day has ended 30 minutes ago and
     the day is still open, the employee is reminded once (reminded_at).
   · AUTO-CLOSE — a day still open after midnight in the policy's zone is
     closed at the policy's end time (owner: "close at 6 o'clock"), flagged
     auto_closed so HR sees it, and the employee is told they can ask for a
     correction if they left later. An auto-closed day has no overtime —
     real late hours come back only through an approved correction.

   Both writes are conditional (clock_out IS NULL / reminded_at IS NULL), so
   two overlapping runs cannot double-close or double-remind.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { dayEndIso, loadPolicyRows, pickPolicy, resolveEmployeeCountries, todayInZone, workedHours } from "@/lib/server/work-calendar";
import { employeeAccountId } from "@/lib/server/leave-review";
import { notifyLite } from "@/lib/server/notify-lite";
import { settleClockoutReminders } from "@/lib/server/attendance-records";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REMIND_AFTER_MS = 30 * 60_000;
const LOOKBACK_DAYS = 14;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: open, error } = await supabaseServer.from("hr_attendance_records")
    .select("id, employee_id, date, clock_in, break_minutes, reminded_at")
    .is("clock_out", null).gte("date", since).limit(1000);
  if (error) {
    console.error("[cron/attendance]", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  const recs = (open ?? []) as Array<{ id: string; employee_id: string; date: string; clock_in: string | null; break_minutes: number | null; reminded_at: string | null }>;
  if (recs.length === 0) return NextResponse.json({ ok: true, autoClosed: 0, reminded: 0 });

  const ids = Array.from(new Set(recs.map((r) => r.employee_id)));
  const [rows, countries, { data: emps }] = await Promise.all([
    loadPolicyRows(),
    resolveEmployeeCountries(ids),
    supabaseServer.from("koleex_employees").select("id, account_id, person_id").in("id", ids),
  ]);
  /* Each employee's login and its tenant, for the inbox row. */
  const reach = new Map<string, { accountId: string; tenantId: string | null }>();
  for (const e of (emps ?? []) as Array<{ id: string; account_id: string | null; person_id: string | null }>) {
    const accountId = await employeeAccountId(e);
    if (!accountId) continue;
    const { data: acct } = await supabaseServer.from("accounts").select("tenant_id").eq("id", accountId).maybeSingle();
    reach.set(e.id, { accountId, tenantId: (acct as { tenant_id?: string | null } | null)?.tenant_id ?? null });
  }

  let autoClosed = 0;
  let reminded = 0;
  for (const r of recs) {
    if (!r.clock_in) continue;
    const policy = pickPolicy(rows, countries.get(r.employee_id) ?? null);
    const end = dayEndIso(r.date, policy);
    if (!end) continue;
    const who = reach.get(r.employee_id);

    if (r.date < todayInZone(policy.timezone, now)) {
      const clockOut = Date.parse(r.clock_in) >= Date.parse(end) ? r.clock_in : end;
      const { data: closed } = await supabaseServer.from("hr_attendance_records").update({
        clock_out: clockOut,
        total_hours: workedHours(r.clock_in, clockOut, Number(r.break_minutes ?? 0)),
        auto_closed: true,
        updated_at: now.toISOString(),
      }).eq("id", r.id).is("clock_out", null).select("id").maybeSingle();
      if (!closed) continue;
      autoClosed++;
      await settleClockoutReminders([r.id]);
      if (who) {
        await notifyLite({
          tenantId: who.tenantId, recipients: [who.accountId],
          subject: `Attendance closed automatically — ${dmyDate(r.date)}`,
          body: `Nobody clocked out, so the day was closed at ${policy.workEnd}. If you left later, ask for a correction in My HR.`,
          link: "/me?tab=attendance", type: "hr_attendance_auto_closed",
          metadata: { attendance_record_id: r.id }, tag: `att-closed-${r.id}`,
        });
      }
      continue;
    }

    if (!r.reminded_at && now.getTime() >= Date.parse(end) + REMIND_AFTER_MS) {
      const { data: marked } = await supabaseServer.from("hr_attendance_records")
        .update({ reminded_at: now.toISOString() }).eq("id", r.id).is("reminded_at", null).is("clock_out", null).select("id").maybeSingle();
      if (!marked) continue;
      reminded++;
      if (who) {
        await notifyLite({
          tenantId: who.tenantId, recipients: [who.accountId],
          subject: "Don't forget to clock out",
          body: `Your working day ended at ${policy.workEnd}. Clock out in My HR when you leave.`,
          link: "/me?tab=attendance", type: "hr_attendance_clockout_reminder",
          metadata: { attendance_record_id: r.id }, tag: `att-remind-${r.id}`,
        });
      }
    }
  }
  return NextResponse.json({ ok: true, autoClosed, reminded, open: recs.length });
}
