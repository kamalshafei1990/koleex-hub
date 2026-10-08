import "server-only";

/* ---------------------------------------------------------------------------
   /api/hr/attendance/overtime — the overtime approval queue (owner rule,
   23 Sep 2026): overtime is only the time after the policy's end time, and
   payroll pays it only once HR or the owner approves it.

   GET  — every closed day of the last 62 days with overtime and no decision
          yet, with the employee, the times and the minutes.
   POST — { decisions: [{ record_id, decision: "approve" | "reject",
            minutes? }] }. Approving may lower the minutes (never raise them
          above what the punches show). The employee is told.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadPolicyRows, overtimeMinutes, pickPolicy, resolveEmployeeCountries } from "@/lib/server/work-calendar";
import { employeeNames } from "@/lib/server/attendance-records";
import { employeeAccountId } from "@/lib/server/leave-review";
import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";
import { dmyDate } from "@/lib/work-reports";

type Rec = { id: string; employee_id: string; date: string; clock_in: string | null; clock_out: string | null; overtime_status: string | null };
/** One decided day, as the employee's notification tells it. */
type Decided = { date: string; decision: "approved" | "rejected"; duration: string | null };

async function withOvertime(recs: Rec[]) {
  const [rows, countries] = await Promise.all([loadPolicyRows(), resolveEmployeeCountries(recs.map((r) => r.employee_id))]);
  return recs.map((r) => {
    const policy = pickPolicy(rows, countries.get(r.employee_id) ?? null);
    return { rec: r, policy, minutes: overtimeMinutes(r.clock_in, r.clock_out, r.date, policy) };
  });
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const since = new Date(Date.now() - 62 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseServer.from("hr_attendance_records")
    .select("id, employee_id, date, clock_in, clock_out, overtime_status")
    .gte("date", since).not("clock_out", "is", null).is("overtime_status", null).order("date", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Could not load overtime." }, { status: 500 });
  const rows = (await withOvertime((data ?? []) as Rec[])).filter((x) => x.minutes > 0);
  const names = await employeeNames(rows.map((x) => x.rec.employee_id));
  return NextResponse.json({
    items: rows.map(({ rec, policy, minutes }) => ({
      record_id: rec.id, employee_id: rec.employee_id, employee_name: names.get(rec.employee_id) ?? "Employee",
      date: rec.date, clock_in: rec.clock_in, clock_out: rec.clock_out, minutes, work_end: policy.workEnd, timezone: policy.timezone,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { decisions?: unknown } | null;
  const list = Array.isArray(body?.decisions) ? body!.decisions as Array<{ record_id?: unknown; decision?: unknown; minutes?: unknown }> : [];
  const wanted = list
    .filter((d) => typeof d.record_id === "string" && /^[0-9a-f-]{36}$/i.test(d.record_id) && (d.decision === "approve" || d.decision === "reject"))
    .slice(0, 200) as Array<{ record_id: string; decision: "approve" | "reject"; minutes?: unknown }>;
  if (wanted.length === 0) return NextResponse.json({ error: "no decisions" }, { status: 400 });

  const { data } = await supabaseServer.from("hr_attendance_records")
    .select("id, employee_id, date, clock_in, clock_out, overtime_status").in("id", wanted.map((w) => w.record_id));
  const byId = new Map((await withOvertime((data ?? []) as Rec[])).map((x) => [x.rec.id, x]));
  const now = new Date().toISOString();
  const done: Array<{ record_id: string; status: string; minutes: number }> = [];
  const perEmployee = new Map<string, Decided[]>();
  for (const w of wanted) {
    const x = byId.get(w.record_id);
    if (!x || x.minutes <= 0 || x.rec.overtime_status) continue;
    const asked = Number(w.minutes);
    const minutes = w.decision === "approve" ? (Number.isFinite(asked) && asked >= 0 ? Math.min(Math.round(asked), x.minutes) : x.minutes) : 0;
    const { data: upd } = await supabaseServer.from("hr_attendance_records").update({
      overtime_status: w.decision === "approve" ? "approved" : "rejected",
      overtime_approved_minutes: minutes, overtime_decided_by: auth.account_id, overtime_decided_at: now,
    }).eq("id", x.rec.id).is("overtime_status", null).select("id").maybeSingle();
    if (!upd) continue;
    done.push({ record_id: x.rec.id, status: w.decision === "approve" ? "approved" : "rejected", minutes });
    await clearUnreadByMeta({ attendance_record_id: x.rec.id });
    const day: Decided = w.decision === "approve"
      ? { date: dmyDate(x.rec.date), decision: "approved", duration: `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` }
      : { date: dmyDate(x.rec.date), decision: "rejected", duration: null };
    perEmployee.set(x.rec.employee_id, [...(perEmployee.get(x.rec.employee_id) ?? []), day]);
  }
  /* One message per employee, however many days were decided. */
  if (perEmployee.size) {
    const { data: emps } = await supabaseServer.from("koleex_employees").select("id, account_id, person_id").in("id", Array.from(perEmployee.keys()));
    for (const e of (emps ?? []) as Array<{ id: string; account_id: string | null; person_id: string | null }>) {
      const to = await employeeAccountId(e);
      const days = perEmployee.get(e.id) ?? [];
      /* One day reads as a sentence in the reader's language; several stay
         the stored list of days (data). */
      const only = days.length === 1 ? days[0] : null;
      after(() => notifyLite({
        tenantId: auth.tenant_id, recipients: [to], senderId: auth.account_id,
        tpl: only
          ? { k: "hr_attendance_overtime_decided.one", p: { date: only.date, decision: only.decision, duration: only.duration } }
          : { k: "hr_attendance_overtime_decided" },
        body: only ? null : days.map((d) => `${d.date}: ${d.decision === "approved" ? `approved ${d.duration}` : "not approved"}`).join(" · "),
        link: "/me?tab=attendance", type: "hr_attendance_overtime_decided", metadata: { employee_id: e.id },
      }));
    }
  }
  return NextResponse.json({ ok: true, decided: done });
}
