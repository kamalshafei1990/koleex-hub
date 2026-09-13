import "server-only";

/* ---------------------------------------------------------------------------
   WHO SEES WHICH TASKS — one rule, written once (tasks phase 6, 2026-09-13).

   The To-do app's visibility scope ("Type C module semantics, hardcoded,
   regardless of koleex_permissions.data_scope") was written in
   /api/todos GET and ported verbatim into the AI's listMyTodos; the same
   class of drift had already bitten /api/me/work once (see the note in the
   route). Both callers, and the morning brief, now read it from here:

     super admin  → the whole tenant
     everyone else → OR of: I created it · I assigned it · I am an assignee ·
                     it is for my department · it is for everyone ·
                     I observe it (metadata.observers)
     MINUS private tasks I did not create, unless can_view_private.
     Always within the tenant (the caller adds the tenant predicate on the
     query it builds; this module only adds the scope clauses).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export { applyTodoScope, todoScopeClauses, type TodoViewer } from "@/lib/server/todo-scope-rule";
import type { TodoViewer } from "@/lib/server/todo-scope-rule";

/** The ids of tasks the viewer is an assignee of or observes — the "shared"
 *  branch of the scope. Empty for a super admin (who needs no branch). */
export async function sharedTodoIds(v: TodoViewer): Promise<string[]> {
  if (v.isSuperAdmin) return [];
  let obsQuery = supabaseServer
    .from("koleex_todos")
    .select("id")
    .contains("metadata", { observers: [{ account_id: v.accountId }] });
  if (v.tenantId) obsQuery = obsQuery.eq("tenant_id", v.tenantId);
  const [{ data: rows }, { data: obsRows }] = await Promise.all([
    supabaseServer.from("koleex_todo_assignees").select("todo_id").eq("account_id", v.accountId),
    obsQuery,
  ]);
  return Array.from(
    new Set([
      ...(rows ?? []).map((r) => (r as { todo_id: string }).todo_id),
      ...(obsRows ?? []).map((r) => (r as { id: string }).id),
    ]),
  );
}

