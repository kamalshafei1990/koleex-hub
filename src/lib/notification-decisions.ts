/* ---------------------------------------------------------------------------
   notification-decisions — approve / reject straight from the notification.

   A notification that waits on the reader for a decision (a leave request,
   a task submitted as done, a report for review, an attendance correction,
   overtime, an account request, an expense) can be decided where it is read — the bell
   and the notification center — instead of opening the app to find it.

   Each decision goes through the SAME route the app's own screen uses, so
   every rule stays on the server: who may decide (a manager for their
   report, HR, the task's assigner, a "To" reviewer), what state it must be
   in, whether a refusal needs its reason. This module only knows which
   route that is and what the route wants; a refusal from the server comes
   back as a message, never a silent success.
   --------------------------------------------------------------------------- */
import { typeOf } from "@/lib/notification-view";

export type Verdict = "approve" | "reject";

export interface DecisionSpec {
  /** "return" for work sent back for rework (a task, a report). */
  rejectWord: "reject" | "return";
  /** The refusal needs words — the route will not take it without. */
  reasonRequired: boolean;
  /** Shortest reason the route accepts. */
  reasonMin: number;
  /** The route takes a note at all (overtime does not). */
  takesNote: boolean;
}

export type DecideResult = { ok: true } | { ok: false; code: "forbidden" | "decided" | "reason" | "failed"; message?: string };

const meta = (m: unknown) => (m ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/* What each type needs to be decided — and the id it is decided by. */
function target(m: unknown): { type: string; id: string } | null {
  const md = meta(m);
  const type = typeOf(m);
  if (!type) return null;
  const id =
    type === "todo_approval_request" ? str(md.todo_id)
    : type === "leave_approval_request" ? str(md.leave_request_id)
    : type === "report_approval_request" ? str(md.report_id)
    : type === "attendance_correction_approval_request" ? str(md.attendance_correction_id)
    : type === "attendance_overtime_approval_request" ? str(md.attendance_record_id)
    : type === "membership_request" ? str(md.membership_request_id) ?? str(md.request_id)
    : type === "expense_approval_request" ? str(md.expense_id)
    : null;
  return id ? { type, id } : null;
}

export function decisionOf(m: unknown): DecisionSpec | null {
  const t = target(m);
  if (!t) return null;
  switch (t.type) {
    case "todo_approval_request": return { rejectWord: "return", reasonRequired: true, reasonMin: 1, takesNote: true };
    case "report_approval_request": return { rejectWord: "return", reasonRequired: true, reasonMin: 3, takesNote: true };
    case "membership_request": return { rejectWord: "reject", reasonRequired: true, reasonMin: 1, takesNote: true };
    case "expense_approval_request": return { rejectWord: "reject", reasonRequired: true, reasonMin: 3, takesNote: true };
    case "attendance_overtime_approval_request": return { rejectWord: "reject", reasonRequired: false, reasonMin: 0, takesNote: false };
    default: return { rejectWord: "reject", reasonRequired: false, reasonMin: 0, takesNote: true };
  }
}

async function call(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
  } catch {
    return { status: 0, json: null };
  }
}

export async function decide(m: unknown, verdict: Verdict, note: string): Promise<DecideResult> {
  const t = target(m);
  if (!t) return { ok: false, code: "failed" };
  const n = note.trim();
  const approve = verdict === "approve";
  let r: { status: number; json: Record<string, unknown> | null };
  switch (t.type) {
    case "todo_approval_request":
      r = await call(`/api/todos/${t.id}`, "PATCH", approve
        ? { updates: { approval_state: "approved", status: "done" } }
        : { updates: { approval_state: "rejected" }, rejectionReason: n });
      break;
    case "leave_approval_request": {
      const url = meta(m).step === "hr" ? `/api/hr/leave/${t.id}/review` : `/api/me/hr/approvals/${t.id}`;
      r = await call(url, "POST", { decision: verdict, notes: n || undefined });
      break;
    }
    case "report_approval_request":
      r = await call(`/api/work-reports/${t.id}/decision`, "POST", approve ? { action: "approve", note: n || undefined } : { action: "return", note: n });
      break;
    case "attendance_correction_approval_request":
      r = await call(`/api/hr/attendance/corrections/${t.id}`, "POST", { decision: verdict, note: n || undefined });
      break;
    case "attendance_overtime_approval_request": {
      r = await call(`/api/hr/attendance/overtime`, "POST", { decisions: [{ record_id: t.id, decision: verdict }] });
      /* The route skips (silently) what it will not decide — already decided,
         nothing to approve. Only a listed record was actually decided. */
      const decided = (r.json?.decided as unknown[] | undefined) ?? [];
      if (r.status === 200 && decided.length === 0) return { ok: false, code: "decided" };
      break;
    }
    case "membership_request":
      r = await call(`/api/membership-requests/${t.id}`, "PATCH", { status: approve ? "approved" : "rejected", note: n || null });
      break;
    case "expense_approval_request":
      /* The Approvals queue's own door (Finance + «Finance Approvals»). */
      r = await call(`/api/approvals`, "POST", approve
        ? { entity: "expense", entityId: t.id, action: "approve", note: n || undefined }
        : { entity: "expense", entityId: t.id, action: "reject", reason: n });
      break;
    default:
      return { ok: false, code: "failed" };
  }
  if (r.status >= 200 && r.status < 300) return { ok: true };
  const err = str(r.json?.error) ?? "";
  if (r.status === 403) return { ok: false, code: "forbidden" };
  if (r.status === 409 || /not_pending|already_decided|not_reviewable/.test(err)) return { ok: false, code: "decided" };
  if (r.status === 422 || /note_required|reason/i.test(err)) return { ok: false, code: "reason" };
  return { ok: false, code: "failed", message: err || undefined };
}
