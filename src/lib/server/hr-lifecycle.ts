import "server-only";

/* ---------------------------------------------------------------------------
   hr-lifecycle — the things that should HAPPEN when an employee's life at the
   company changes, so nobody has to remember to start them (HR plan Phase F).

   · hire        → the department's (or the general) onboarding checklist
                   starts on the hire date
   · termination → the offboarding checklist starts on the day
   · probation   → two weeks before probation_end_date a review task lands
                   with the direct manager (and HR), once, in To-do — with
                   the usual assignment notification

   Every function is idempotent and best-effort: a lifecycle side effect must
   never fail the hire or the edit that triggered it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { hrReviewerAccountIds, employeeAccountId } from "@/lib/server/leave-review";
import { notifyTodoAssigned, pingTodosChanged } from "@/lib/server/todo-notify";

export const PROBATION_REVIEW_LEAD_DAYS = 14;

/** Start the checklist of `type` for an employee — the department's own if
 *  one exists, else the general one. Skips when an instance already exists. */
export async function activateChecklist(employeeId: string, type: "onboarding" | "offboarding", startDate: string, departmentId: string | null): Promise<{ started: boolean; checklistId: string | null }> {
  try {
    const { data } = await supabaseServer.from("hr_checklists").select("id, department_id, items").eq("type", type).eq("is_active", true);
    const rows = (data ?? []) as Array<{ id: string; department_id: string | null; items: unknown[] }>;
    const pick = (departmentId && rows.find((r) => r.department_id === departmentId)) || rows.find((r) => !r.department_id) || rows[0];
    if (!pick) return { started: false, checklistId: null };
    const { data: existing } = await supabaseServer.from("hr_checklist_instances").select("id").eq("employee_id", employeeId).eq("checklist_id", pick.id).limit(1);
    if (existing && existing.length > 0) return { started: false, checklistId: pick.id };
    const { error } = await supabaseServer.from("hr_checklist_instances").insert({
      checklist_id: pick.id, employee_id: employeeId, start_date: startDate, status: "in_progress",
      items_status: (pick.items ?? []).map((_, item_index) => ({ item_index, completed: false })), completed_at: null,
    });
    if (error) { console.error("[hr-lifecycle] checklist:", error.message); return { started: false, checklistId: pick.id }; }
    return { started: true, checklistId: pick.id };
  } catch (e) {
    console.error("[hr-lifecycle] checklist:", e instanceof Error ? e.message : e);
    return { started: false, checklistId: null };
  }
}

/** One probation-review task per employee, created when the end of
 *  probation is within the lead window. Assigned to the direct manager's
 *  account and the HR reviewers; falls back to HR alone. */
export async function ensureProbationReviewTask(emp: {
  id: string; name: string; manager_id: string | null; probation_end_date: string | null; tenant_id: string | null;
}, today: string): Promise<"created" | "exists" | "not_due" | "no_recipients"> {
  if (!emp.probation_end_date) return "not_due";
  const end = emp.probation_end_date.slice(0, 10);
  const lead = new Date(`${today}T00:00:00Z`); lead.setUTCDate(lead.getUTCDate() + PROBATION_REVIEW_LEAD_DAYS);
  if (end < today || end > lead.toISOString().slice(0, 10)) return "not_due";

  const { data: existing } = await supabaseServer.from("koleex_todos").select("id").eq("source_id", `probation:${emp.id}`).limit(1);
  if (existing && existing.length > 0) return "exists";

  let recipients: string[] = [];
  if (emp.manager_id) {
    const { data: mgr } = await supabaseServer.from("koleex_employees").select("account_id, person_id").eq("id", emp.manager_id).maybeSingle();
    const acct = mgr ? await employeeAccountId(mgr as { account_id: string | null; person_id: string | null }) : null;
    if (acct) recipients.push(acct);
  }
  recipients = Array.from(new Set([...recipients, ...(await hrReviewerAccountIds(emp.tenant_id))]));
  if (recipients.length === 0) return "no_recipients";

  const title = `Probation review — ${emp.name}`;
  const description = `Probation ends on ${end}. Decide: confirm, extend, or end the employment. Review the attendance sheet, the skills and behavior assessments, and the manager's notes before the date.`;
  const { data: todo, error } = await supabaseServer.from("koleex_todos").insert({
    title, description, completed: false, status: "todo", priority: "high", label: "HR",
    due_date: end, start_date: today, created_by_account_id: recipients[0], assigned_by_account_id: recipients[0],
    assigned_department: null, assign_to_all: false, is_private: false, tenant_id: emp.tenant_id,
    source: "manual", source_id: `probation:${emp.id}`, recurrence: null,
    metadata: { type: "probation_review", employee_id: emp.id, probation_end_date: end },
  }).select("id").single();
  if (error || !todo) { console.error("[hr-lifecycle] probation todo:", error?.message); return "no_recipients"; }
  const todoId = (todo as { id: string }).id;
  await supabaseServer.from("koleex_todo_assignees").insert(recipients.map((account_id) => ({ todo_id: todoId, account_id })));
  await notifyTodoAssigned({ id: todoId, title, description, priority: "high", tenant_id: emp.tenant_id }, recipients, null);
  await pingTodosChanged(emp.tenant_id);
  return "created";
}
