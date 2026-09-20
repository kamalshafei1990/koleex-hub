import "server-only";

/* ---------------------------------------------------------------------------
   todo-access — who may do what to a task, written once.

   The owner test (super admin ∥ creator ∥ assigner), the observer test
   (metadata.observers names me) and the assignee test (a row in
   koleex_todo_assignees) were each copied by hand into the PATCH route, the
   DELETE route, the toggle route and four AI tools — seven owner checks,
   five observer checks, in three different shapes. One definition here; the
   routes and the tools call it.

   Also here: the INTERNAL-ONLY filter for assignee ids (a task is company
   work and can never be handed to a customer/portal login), which the
   create route, the resync path and the AI tool each carried separately.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";

export interface TodoOwnership {
  id: string;
  tenant_id: string | null;
  title: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  approval_state: string | null;
  metadata: { observers?: Array<{ account_id?: string }>; mentions?: Array<{ account_id?: string }>; [k: string]: unknown } | null;
}

export interface TodoActor {
  accountId: string;
  isSuperAdmin: boolean;
}

/** The ownership columns, tenant-bounded. Null when the task is not in the
 *  caller's tenant — callers answer 404, never 403, so ids cannot be probed. */
export async function loadTodoOwnership(id: string, tenantId: string | null): Promise<TodoOwnership | null> {
  let q = supabaseServer
    .from("koleex_todos")
    .select("id, tenant_id, title, created_by_account_id, assigned_by_account_id, approval_state, metadata")
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
  const shared = await sharedTodoIds(viewer);
  let q = supabaseServer.from("koleex_todos").select("id").eq("id", todoId);
  if (viewer.tenantId) q = q.eq("tenant_id", viewer.tenantId);
  q = applyTodoScope(q, viewer, shared);
  const { data } = await q.maybeSingle();
  return !!data;
}

/** Keep only ACTIVE INTERNAL accounts of the tenant. Enforced on the server
 *  so it holds whatever the client — or the model — sends. */
export async function internalAccountIds(ids: string[], tenantId: string | null): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  let q = supabaseServer
    .from("accounts")
    .select("id")
    .in("id", unique)
    .eq("user_type", "internal")
    .eq("status", "active");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string }>).map((a) => a.id);
}

/** Expand a department and/or "everyone" into account ids, then apply the
 *  internal-only rule. Shared by the create route and the AI createTodo. */
export async function resolveAssigneeIds(opts: {
  explicit: string[];
  department: string | null;
  everyone: boolean;
  tenantId: string | null;
}): Promise<string[]> {
  let ids = [...opts.explicit];
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
