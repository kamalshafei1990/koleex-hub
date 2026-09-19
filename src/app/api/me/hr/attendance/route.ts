import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/me/hr/attendance — { action: "in" | "out", tz } for MYSELF, today,
   on the SERVER clock. The client sends no time and no date — only its IANA
   zone, which picks the day boundary: a phone whose clock is wrong (or a
   helpful hand) cannot move the punch, only say which calendar it lives on.

   One record per employee per day: "in" refuses when today already has one,
   "out" closes the open one and computes total_hours the same way the HR
   app's clockOut does. source = "self" so HR can tell a self punch from a
   manual entry.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { cleanTz, resolveMyEmployee, todayIso } from "@/lib/server/me-hr";
import { lateMinutes, loadPolicy, resolveEmployeeCountry } from "@/lib/server/work-calendar";

const COLS = "id, date, clock_in, clock_out, break_minutes, total_hours, status";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { action?: unknown; tz?: unknown } | null;
  const action = body?.action;
  if (action !== "in" && action !== "out") return NextResponse.json({ error: "action must be in|out" }, { status: 400 });

  const today = todayIso(cleanTz(body?.tz));
  const now = new Date().toISOString();
  const { data: existing } = await supabaseServer.from("hr_attendance_records")
    .select(COLS).eq("employee_id", me.id).eq("date", today).order("clock_in", { ascending: false }).limit(1).maybeSingle();
  const rec = existing as { id: string; clock_in: string | null; clock_out: string | null; break_minutes: number } | null;

  if (action === "in") {
    if (rec) return NextResponse.json({ error: "already_in", record: rec }, { status: 409 });
    /* Late is judged against the policy of the country I work in, in its
       own zone — the sheet re-derives it too, this just makes the row honest
       from the first second. */
    const policy = await loadPolicy(await resolveEmployeeCountry(me.id));
    const { data, error } = await supabaseServer.from("hr_attendance_records").insert({
      employee_id: me.id, date: today, clock_in: now, clock_out: null,
      break_minutes: 0, total_hours: null, status: lateMinutes(now, policy) > 0 ? "late" : "present", source: "self", notes: null,
    }).select(COLS).single();
    if (error) {
      console.error("[api/me/hr/attendance in]", error.message);
      return NextResponse.json({ error: "Could not clock in." }, { status: 500 });
    }
    return NextResponse.json({ record: data }, { status: 201 });
  }

  if (!rec || !rec.clock_in) return NextResponse.json({ error: "not_in" }, { status: 409 });
  if (rec.clock_out) return NextResponse.json({ error: "already_out", record: rec }, { status: 409 });
  const minutes = (Date.parse(now) - Date.parse(rec.clock_in)) / 60000;
  const totalHours = Math.max(0, Math.round(((minutes - (rec.break_minutes || 0)) / 60) * 100) / 100);
  const { data, error } = await supabaseServer.from("hr_attendance_records")
    .update({ clock_out: now, total_hours: totalHours, updated_at: now })
    .eq("id", rec.id).eq("employee_id", me.id).select(COLS).single();
  if (error) {
    console.error("[api/me/hr/attendance out]", error.message);
    return NextResponse.json({ error: "Could not clock out." }, { status: 500 });
  }
  return NextResponse.json({ record: data });
}
