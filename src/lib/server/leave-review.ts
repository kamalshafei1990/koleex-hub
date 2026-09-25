import "server-only";
import { dmyDate } from "@/lib/work-reports";

/* ---------------------------------------------------------------------------
   leave-review — the ONE place a leave request changes state after filing.

   Chain (HR plan Phase B):
       pending ──(manager approves)──▶ manager_approved ──(HR)──▶ approved
          │                                   │
          └──(manager or HR rejects)──────────┴──────────────▶ rejected

   · The first approver is the employee's direct manager (koleex_employees
     .manager_id). No manager, or the manager IS the requester → HR is first.
   · HR may decide a `pending` request without waiting for the manager — the
     manager step informs the line, it does not lock HR out.
   · Approval deducts the balance exactly as the HR app always did; nothing
     else about the row moves (dates, days, type are the requester's).

   Notifications ride on notify-lite (inbox + push, fire-and-forget) and obey
   the inbox lifecycle: an approval request is ENTITY-STATE information, so
   the moment the request is decided every unread "please approve" copy is
   cleared for every recipient (clearUnreadByMeta on leave_request_id).

   Type strings are chosen for the activity classifier:
     leave_approval_request → "approvals"   (the person who must act)
     leave_request_decided  → "hr_activity" (the requester, informed)
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";
import { fillTemplate } from "@/lib/notification-templates";

export type LeaveDecision = "approve" | "reject";
export type ReviewerRole = "manager" | "hr";

interface RequestRow {
  id: string; employee_id: string; leave_type_id: string; start_date: string; end_date: string;
  days: number; status: string; manager_reviewed_by: string | null;
}
interface EmployeeRow {
  id: string; account_id: string | null; person_id: string | null; manager_id: string | null;
  people?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** The account behind an employee — direct link first, then the person link
 *  (the two drift; see me-hr.ts). */
export async function employeeAccountId(emp: { account_id: string | null; person_id: string | null }): Promise<string | null> {
  if (emp.account_id) return emp.account_id;
  if (!emp.person_id) return null;
  const { data } = await supabaseServer.from("accounts").select("id").eq("person_id", emp.person_id).eq("status", "active").limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/** Everyone who can decide leave for HR: active internal accounts whose role
 *  grants HR·edit, plus the tenant's super admins. Best-effort audience — a
 *  per-account override that grants HR is not consulted here. */
export async function hrReviewerAccountIds(tenantId: string | null): Promise<string[]> {
  if (!tenantId) return [];
  const { data: perms } = await supabaseServer.from("koleex_permissions").select("role_id").ilike("module_name", "hr").eq("can_edit", true);
  const roleIds = Array.from(new Set(((perms ?? []) as { role_id: string }[]).map((p) => p.role_id)));
  const or = roleIds.length ? `is_super_admin.eq.true,role_id.in.(${roleIds.join(",")})` : "is_super_admin.eq.true";
  const { data: accts } = await supabaseServer.from("accounts").select("id")
    .eq("tenant_id", tenantId).eq("status", "active").eq("user_type", "internal").or(or).limit(200);
  return ((accts ?? []) as { id: string }[]).map((a) => a.id);
}

async function loadRequest(requestId: string) {
  const { data: req } = await supabaseServer.from("hr_leave_requests")
    .select("id, employee_id, leave_type_id, start_date, end_date, days, status, manager_reviewed_by").eq("id", requestId).maybeSingle();
  if (!req) return null;
  const r = req as RequestRow;
  const [{ data: emp }, { data: type }] = await Promise.all([
    supabaseServer.from("koleex_employees").select("id, account_id, person_id, manager_id, people(full_name)").eq("id", r.employee_id).maybeSingle(),
    supabaseServer.from("hr_leave_types").select("name, code").eq("id", r.leave_type_id).maybeSingle(),
  ]);
  if (!emp) return null;
  const e = emp as EmployeeRow;
  const t = type as { name?: string; code?: string | null } | null;
  const typeName = t?.name ?? "Leave";
  return {
    req: r, emp: e,
    name: one(e.people)?.full_name ?? "Employee",
    /* The leave type for a notification template: its code when the
       dictionary's English word for it is exactly today's name (zh / ar then
       read their own word), else the name itself — an unknown code renders
       as given, so the stored English never changes. */
    leaveType: t?.code && fillTemplate(`enum.leave_type.${t.code}`, "en") === typeName ? t.code : typeName,
  };
}

/** The request's dates for a template: `{from}[[ → {to}]]` — one day has no `to`. */
const span = (r: RequestRow) => ({ from: dmyDate(r.start_date), to: r.start_date === r.end_date ? null : dmyDate(r.end_date) });

/** A request was just filed by the employee: tell the first approver. */
export async function notifyLeaveFiled(requestId: string, tenantId: string | null, requesterAccountId: string | null): Promise<void> {
  const ctx = await loadRequest(requestId);
  if (!ctx) return;
  const { req, emp, name, leaveType } = ctx;
  const managerFirst = !!emp.manager_id && emp.manager_id !== emp.id;
  let recipients: string[] = [];
  let link = "/hr?tab=leave";
  if (managerFirst) {
    const { data: mgr } = await supabaseServer.from("koleex_employees").select("id, account_id, person_id").eq("id", emp.manager_id!).maybeSingle();
    const mgrAccount = mgr ? await employeeAccountId(mgr as EmployeeRow) : null;
    if (mgrAccount) { recipients = [mgrAccount]; link = "/me?tab=approvals"; }
  }
  /* No manager, or a manager with no login → HR is the first approver. */
  if (recipients.length === 0) recipients = await hrReviewerAccountIds(tenantId);
  await notifyLite({
    tenantId, recipients, senderId: requesterAccountId,
    tpl: req.days === 1
      ? { k: "leave_approval_request.one", p: { name, leaveType, ...span(req), days: req.days } }
      : { k: "leave_approval_request.many", p: { name, leaveType, ...span(req), days: req.days } },
    link, type: "leave_approval_request",
    metadata: { leave_request_id: req.id, employee_id: emp.id, step: managerFirst ? "manager" : "hr" },
    tag: `leave-${req.id}`,
  });
}

export type ReviewResult =
  | { ok: true; status: "manager_approved" | "approved" | "rejected" }
  | { ok: false; error: "not_found" | "not_your_report" | "not_pending" | "not_reviewable" | "update_failed" };

/** Decide a request. `as: "manager"` requires the reviewer to be the
 *  requester's manager and the request to be `pending`; `as: "hr"` accepts
 *  `pending` or `manager_approved`. The route decides WHO may call with which
 *  role; this function enforces the state machine. */
export async function reviewLeave(opts: {
  requestId: string;
  decision: LeaveDecision;
  as: ReviewerRole;
  reviewerEmployeeId: string | null;
  reviewerAccountId: string;
  tenantId: string | null;
  notes?: string | null;
}): Promise<ReviewResult> {
  const ctx = await loadRequest(opts.requestId);
  if (!ctx) return { ok: false, error: "not_found" };
  const { req, emp, name, leaveType } = ctx;
  const now = new Date().toISOString();
  const notes = opts.notes?.trim().slice(0, 2000) || null;

  let next: "manager_approved" | "approved" | "rejected";
  let patch: Record<string, unknown>;

  if (opts.as === "manager") {
    if (!opts.reviewerEmployeeId || emp.manager_id !== opts.reviewerEmployeeId) return { ok: false, error: "not_your_report" };
    if (req.status !== "pending") return { ok: false, error: "not_pending" };
    next = opts.decision === "approve" ? "manager_approved" : "rejected";
    patch = { status: next, manager_reviewed_by: opts.reviewerEmployeeId, manager_reviewed_at: now, manager_notes: notes, updated_at: now };
  } else {
    if (req.status !== "pending" && req.status !== "manager_approved") return { ok: false, error: "not_reviewable" };
    next = opts.decision === "approve" ? "approved" : "rejected";
    patch = { status: next, reviewed_by: opts.reviewerEmployeeId, reviewed_at: now, review_notes: notes, updated_at: now };
  }

  /* The status filter makes the update a compare-and-set: two reviewers
     deciding at once cannot both win. */
  const { data: updated, error } = await supabaseServer.from("hr_leave_requests").update(patch)
    .eq("id", req.id).eq("status", req.status).select("id").maybeSingle();
  if (error) { console.error("[leave-review] update:", error.message); return { ok: false, error: "update_failed" }; }
  if (!updated) return { ok: false, error: "not_pending" };

  if (next === "approved") await deductBalance(req);

  /* ── Notifications ── */
  const requesterAccount = await employeeAccountId(emp);
  const label = { leaveType, ...span(req) };
  if (next === "manager_approved") {
    /* The manager's copy is done; HR's turn. */
    await clearUnreadByMeta({ type: "leave_approval_request", leave_request_id: req.id });
    await notifyLite({
      tenantId: opts.tenantId, recipients: await hrReviewerAccountIds(opts.tenantId), senderId: opts.reviewerAccountId,
      tpl: { k: "leave_approval_request.hr", p: { name, ...label } }, link: "/hr?tab=leave",
      type: "leave_approval_request", metadata: { leave_request_id: req.id, employee_id: emp.id, step: "hr" }, tag: `leave-${req.id}`,
    });
    await notifyLite({
      tenantId: opts.tenantId, recipients: [requesterAccount], senderId: opts.reviewerAccountId,
      tpl: { k: "leave_request_decided.manager_approved", p: label }, link: "/me?tab=leave",
      type: "leave_request_decided", metadata: { leave_request_id: req.id, decision: "manager_approved" }, tag: `leave-${req.id}-me`,
    });
  } else {
    await clearUnreadByMeta({ leave_request_id: req.id });
    await notifyLite({
      tenantId: opts.tenantId, recipients: [requesterAccount], senderId: opts.reviewerAccountId,
      tpl: { k: "leave_request_decided", p: { decision: next, ...label, notes } }, link: "/me?tab=leave",
      type: "leave_request_decided", metadata: { leave_request_id: req.id, decision: next }, tag: `leave-${req.id}-me`,
    });
  }
  return { ok: true, status: next };
}

/** Approved → the year's balance carries the days. Same maths the HR app
 *  applied client-side before Phase B; a missing balance row is left alone
 *  (HR initialises balances, never a side effect). */
async function deductBalance(req: RequestRow): Promise<void> {
  const year = Number(req.start_date.slice(0, 4));
  const { data: bal } = await supabaseServer.from("hr_leave_balances").select("id, used")
    .eq("employee_id", req.employee_id).eq("leave_type_id", req.leave_type_id).eq("year", year).maybeSingle();
  const b = bal as { id: string; used: number | null } | null;
  if (!b) return;
  const { error } = await supabaseServer.from("hr_leave_balances")
    .update({ used: Number(b.used ?? 0) + Number(req.days), updated_at: new Date().toISOString() }).eq("id", b.id);
  if (error) console.error("[leave-review] deduct:", error.message);
}
