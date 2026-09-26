import "server-only";

/* ---------------------------------------------------------------------------
   todo-access — who may do what to a task, written once.

   The owner test (super admin ∥ creator ∥ assigner), the observer test
   (metadata.observers names me) and the assignee test (a row in
   koleex_todo_assignees) were each copied by hand into the PATCH route, the
   DELETE route, the toggle route and four AI tools — seven owner checks,
   five observer checks, in three different shapes. One definition here; the
   routes and the tools call it.

   The INTERNAL-ONLY filter for assignee ids (a task is company work and can
   never be handed to a customer/portal login) lives in
   lib/server/internal-accounts.ts — the Calendar guest list applies the
   same rule.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { internalAccountIds } from "@/lib/server/internal-accounts";

export interface TodoOwnership {
  id: string;
  tenant_id: string | null;
  title: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  approval_state: string | null;
  /* The state columns the write paths compare against: toggle flips
     `completed` conditionally on the value read here, PATCH only restamps
     completed_at when the status really changes, re-arms a reminder when
     remind_at moves, and re-arms the overdue escalation when due_date moves. */
  status: string | null;
  completed: boolean;
  assign_to_all: boolean;
  updated_at: string | null;
  due_date: string | null;
  remind_at: string | null;
  description: string | null;
  priority: string | null;
  metadata: { observers?: Array<{ account_id?: string }>; mentions?: Array<{ account_id?: string }>; [k: string]: unknown } | null;
}

export interface TodoActor {
  accountId: string;
  isSuperAdmin: boolean;
}

/** The ownership columns, tenant-bounded. Null when the task is not in the
 *  caller's tenant — callers answer 404, never 403, so ids cannot be probed. */
export async function loadTodoOwnership(id: string, tenantId: string | null): Promise<TodoOwnership | null> {
  if (!isUuidLike(id)) return null;
  let q = supabaseServer
    .from("koleex_todos")
    .select(
      "id, tenant_id, title, description, priority, status, completed, assign_to_all, updated_at, due_date, remind_at, created_by_account_id, assigned_by_account_id, approval_state, metadata",
    )
    .eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return (data as TodoOwnership | null) ?? null;
}

/** Super admin, creator or assigner: may edit, reassign, decide, delete. */
export function isTodoOwner(t: Pick<TodoOwnership, "created_by_account_id" | "assigned_by_account_id">, actor: TodoActor): boolean {
  return actor.isSuperAdmin || t.created_by_account_id === actor.accountId || t.assigned_by_account_id === actor.accountId;
}

/** Named in metadata.observers: may follow and move the task's situation. */
export function isTodoObserver(t: Pick<TodoOwnership, "metadata">, accountId: string): boolean {
  const obs = t.metadata?.observers;
  return Array.isArray(obs) && obs.some((o) => o?.account_id === accountId);
}

/** Ids here are UUIDs; anything else is a 404 without a database
 *  round trip (and without the 22P02 cast error PostgREST would log). */
export const isUuidLike = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Has an assignee row. */
export async function isTodoAssignee(todoId: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id")
    .eq("todo_id", todoId)
    .eq("account_id", accountId)
    .maybeSingle();
  return !!data;
}

/** Owner or participant (assignee / observer) — the set that may touch a
 *  task at all. Participants only move its situation; see the PATCH route. */
export async function todoParticipation(
  t: TodoOwnership,
  actor: TodoActor,
): Promise<{ isOwner: boolean; isParticipant: boolean }> {
  const isOwner = isTodoOwner(t, actor);
  if (isOwner) return { isOwner, isParticipant: false };
  const isParticipant = isTodoObserver(t, actor.accountId) || (await isTodoAssignee(t.id, actor.accountId));
  return { isOwner, isParticipant };
}

/** Can the viewer SEE this task — the same rule the list applies, asked of
 *  one id. Used where a write needs "visible to me" rather than ownership
 *  (adding a note). */
export async function canViewTodo(todoId: string, viewer: TodoViewer): Promise<boolean> {
  if (!isUuidLike(todoId)) return false;
  const shared = await sharedTodoIds(viewer);
  let q = supabaseServer.from("koleex_todos").select("id").eq("id", todoId);
  if (viewer.tenantId) q = q.eq("tenant_id", viewer.tenantId);
  q = applyTodoScope(q, viewer, shared);
  const { data } = await q.maybeSingle();
  return !!data;
}

/** Expand a department and/or "everyone" into account ids, then apply the
 *  internal-only rule. Shared by the create route and the AI createTodo. */
export async function resolveAssigneeIds(opts: {
  explicit: string[];
  department: string | null;
  everyone: boolean;
  tenantId: string | null;
}): Promise<string[]> {
  let ids = opts.explicit.filter(isUuidLike);
  if (opts.department && opts.tenantId) {
    const { data: emps } = await supabaseServer
      .from("koleex_employees")
      .select("account_id")
      .eq("department", opts.department)
      .eq("tenant_id", opts.tenantId)
      .not("account_id", "is", null);
    ids.push(...((emps ?? []) as Array<{ account_id: string | null }>).map((e) => e.account_id).filter(Boolean) as string[]);
  }
  if (opts.everyone && opts.tenantId) {
    const { data: all } = await supabaseServer
      .from("accounts")
      .select("id")
      .eq("user_type", "internal")
      .eq("status", "active")
      .eq("tenant_id", opts.tenantId);
    ids = ((all ?? []) as Array<{ id: string }>).map((a) => a.id);
  }
  return internalAccountIds(ids, opts.tenantId);
}

/** "Assign to everyone" is an admin's call (owner, 2026-09-26): it puts a
 *  task on — and notifies — every internal account in the tenant. The same
 *  definition as the AI's createTodo (`ctx.isSuperAdmin || ut === "admin"`
 *  in ai-agent/tools/todos.ts, pinned there by validate-ai-tasks): a super
 *  admin, or an account whose user_type is "admin". */
export function canAssignToEveryone(a: { is_super_admin: boolean; user_type?: string | null }): boolean {
  return a.is_super_admin || (a.user_type ?? "").toLowerCase() === "admin";
}

export const ASSIGN_TO_EVERYONE_DENIED = "Only an admin can assign a task to everyone. Pick a department or the people instead.";
