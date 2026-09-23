import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/hr/attendance/corrections/[id] — HR or the owner decides an
   employee's correction request (Phase 1, owner-approved 23 Sep 2026).

   Body: { decision: "approve" | "reject", note? }. Approve applies the
   requested times through setDayTimes() (the ONE writer: the day is marked
   corrected and its overtime waits for a fresh approval) and stores the day
   before and after on the request. Either way the employee is told and every
   unread "please approve" copy is cleared.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadPolicy, resolveEmployeeCountry } from "@/lib/server/work-calendar";
import { setDayTimes } from "@/lib/server/attendance-records";
import { employeeAccountId } from "@/lib/server/leave-review";
import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { decision?: unknown; note?: unknown } | null;
  const decision = body?.decision === "approve" ? "approve" : body?.decision === "reject" ? "reject" : null;
  if (!decision) return NextResponse.json({ error: "decision must be approve|reject" }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  const { data: row } = await supabaseServer.from("hr_attendance_corrections")
    .select("id, employee_id, date, status, kind, clock_in, clock_out").eq("id", id).maybeSingle();
  const r = row as { id: string; employee_id: string; date: string; status: string; kind: string; clock_in: string | null; clock_out: string | null } | null;
  if (!r || r.kind !== "request") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (r.status !== "pending") return NextResponse.json({ error: "not_pending" }, { status: 409 });

  /* Claim the request first, so two approvers pressing at once cannot both
     apply it; if applying the times then fails, the claim is released. */
  const now = new Date().toISOString();
  const { data: claimed } = await supabaseServer.from("hr_attendance_corrections").update({
    status: decision === "approve" ? "approved" : "rejected",
    decided_by: auth.account_id, decided_at: now, decision_note: note || null,
  }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ error: "not_pending" }, { status: 409 });

  if (decision === "approve") {
    const policy = await loadPolicy(await resolveEmployeeCountry(r.employee_id));
    const res = await setDayTimes({
      employeeId: r.employee_id, date: r.date, policy,
      times: { clockIn: r.clock_in ?? undefined, clockOut: r.clock_out ?? undefined },
    });
    if (!res.ok) {
      await supabaseServer.from("hr_attendance_corrections")
        .update({ status: "pending", decided_by: null, decided_at: null, decision_note: null }).eq("id", id);
      return NextResponse.json({ error: res.error }, { status: res.error === "save_failed" ? 500 : 400 });
    }
    await supabaseServer.from("hr_attendance_corrections").update({ before: res.before, after: res.after }).eq("id", id);
  }

  await clearUnreadByMeta({ attendance_correction_id: id });
  const { data: emp } = await supabaseServer.from("koleex_employees").select("account_id, person_id").eq("id", r.employee_id).maybeSingle();
  const to = emp ? await employeeAccountId(emp as { account_id: string | null; person_id: string | null }) : null;
  after(() => notifyLite({
    tenantId: auth.tenant_id, recipients: [to], senderId: auth.account_id,
    subject: decision === "approve" ? `Attendance correction approved — ${r.date}` : `Attendance correction not approved — ${r.date}`,
    body: note || null, link: "/me?tab=attendance", type: "hr_attendance_correction_decided",
    metadata: { attendance_correction_id: id }, tag: `att-correction-${id}`,
  }));
  return NextResponse.json({ ok: true, status: decision === "approve" ? "approved" : "rejected" });
}
