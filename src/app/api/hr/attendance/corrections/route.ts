import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/hr/attendance/corrections — the correction requests queue for HR
   and the owner (Phase 1, owner-approved 23 Sep 2026): every pending
   request with the day as it stands now, plus the last 30 days of decided
   requests and HR edits (the audit trail, newest first).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { employeeNames } from "@/lib/server/attendance-records";
import { loadPolicyRows, pickPolicy, resolveEmployeeCountries } from "@/lib/server/work-calendar";

const COLS = "id, employee_id, date, kind, status, clock_in, clock_out, break_minutes, reason, decision_note, requested_by, decided_by, created_at, decided_at, before, after";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: pending, error: e1 }, { data: recent, error: e2 }] = await Promise.all([
    supabaseServer.from("hr_attendance_corrections").select(COLS).eq("status", "pending").order("created_at", { ascending: true }).limit(200),
    supabaseServer.from("hr_attendance_corrections").select(COLS).neq("status", "pending").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
  ]);
  if (e1 || e2) return NextResponse.json({ error: "Could not load corrections." }, { status: 500 });
  const rows = [...(pending ?? []), ...(recent ?? [])] as Array<{ employee_id: string; date: string }>;

  /* The day as it stands, so a request shows what it would change. */
  const days = new Map<string, { clock_in: string | null; clock_out: string | null; break_minutes: number | null }>();
  const pendingRows = (pending ?? []) as Array<{ employee_id: string; date: string }>;
  if (pendingRows.length) {
    const ids = Array.from(new Set(pendingRows.map((r) => r.employee_id)));
    const dates = Array.from(new Set(pendingRows.map((r) => r.date)));
    const { data: recs } = await supabaseServer.from("hr_attendance_records")
      .select("employee_id, date, clock_in, clock_out, break_minutes").in("employee_id", ids).in("date", dates);
    for (const r of (recs ?? []) as Array<{ employee_id: string; date: string; clock_in: string | null; clock_out: string | null; break_minutes: number | null }>) {
      days.set(`${r.employee_id}|${r.date}`, { clock_in: r.clock_in, clock_out: r.clock_out, break_minutes: r.break_minutes });
    }
  }
  const ids = rows.map((r) => r.employee_id);
  const [names, policyRows, countries] = await Promise.all([employeeNames(ids), loadPolicyRows(), resolveEmployeeCountries(ids)]);
  /* Times are stored as instants; the screen shows them in the employee's
     own policy zone, whatever the reviewer's browser zone is. */
  const decorate = (r: Record<string, unknown>) => ({
    ...r,
    employee_name: names.get(String(r.employee_id)) ?? "Employee",
    current: days.get(`${r.employee_id}|${r.date}`) ?? null,
    timezone: pickPolicy(policyRows, countries.get(String(r.employee_id)) ?? null).timezone,
  });
  return NextResponse.json(
    { pending: (pending ?? []).map((r) => decorate(r as Record<string, unknown>)), recent: (recent ?? []).map((r) => decorate(r as Record<string, unknown>)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
