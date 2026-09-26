import "server-only";

/* The pure half of lib/server/todo-scope.ts — the viewer and the clauses —
   kept apart so a suite can prove the rule without a database
   (scripts/validate-ai-tasks.ts does). */

export interface TodoViewer {
  accountId: string;
  tenantId: string | null;
  department: string | null;
  isSuperAdmin: boolean;
  canViewPrivate: boolean;
}

/** A value inside a PostgREST filter string. A department name is free
 *  text: a comma, parenthesis, quote or colon in it would split or break the
 *  `or=(…)` list (a 400, i.e. an empty To-do list for everyone in "R&D,
 *  Quality"). Plain words stay bare; anything else is double-quoted with
 *  `"` and `\` escaped, as PostgREST reads reserved characters. */
function filterValue(v: string): string {
  return /^[\p{L}\p{N} _&.\-/]+$/u.test(v) ? v : `"${v.replace(/["\\]/g, "\\$&")}"`;
}

/** The ids sharedTodoIds() returns: every task the viewer is an assignee of
 *  or observes, carrying — as `assigned` — the subset they are an ASSIGNEE
 *  of. A plain string[] (no `assigned`) is accepted everywhere and means
 *  "no assignee exemption from privacy": the safe reading. */
export type SharedTodoIds = string[] & { assigned?: string[] };

/** The PostgREST `or` clauses of the scope, or null for a super admin. Pure.
 *
 *  PRIVACY (owner decision 2026-09-27: "yes let assignees see private
 *  tasks"): a private task is visible to its creator and to its ASSIGNEES.
 *  Observers, the department and everyone else still do not see it (unless
 *  they are also an assignee); can_view_private (break-glass) sees all. The
 *  assignee exemption is written here once, so the list, a task's notes,
 *  the AI's listMyTodos, the brief and the calendar feed all agree. */
export function todoScopeClauses(v: TodoViewer, sharedIds: SharedTodoIds): { scope: string; privacy: string | null } | null {
  if (v.isSuperAdmin) return null;
  const orParts = [
    `created_by_account_id.eq.${v.accountId}`,
    `assigned_by_account_id.eq.${v.accountId}`,
    `assign_to_all.eq.true`,
  ];
  if (v.department) orParts.push(`assigned_department.eq.${filterValue(v.department)}`);
  if (sharedIds.length > 0) orParts.push(`id.in.(${sharedIds.join(",")})`);
  let privacy: string | null = null;
  if (!v.canViewPrivate) {
    const privParts = [`is_private.eq.false`, `created_by_account_id.eq.${v.accountId}`];
    const assigned = Array.isArray(sharedIds.assigned) ? sharedIds.assigned : [];
    if (assigned.length > 0) privParts.push(`id.in.(${assigned.join(",")})`);
    privacy = privParts.join(",");
  }
  return { scope: orParts.join(","), privacy };
}

/** Apply the scope to a koleex_todos query the caller has already bounded
 *  by tenant. Two `.or()` calls AND together, as PostgREST reads them. */
export function applyTodoScope<Q extends { or(filters: string): Q }>(q: Q, v: TodoViewer, sharedIds: SharedTodoIds): Q {
  const c = todoScopeClauses(v, sharedIds);
  if (!c) return q;
  let out = q.or(c.scope);
  if (c.privacy) out = out.or(c.privacy);
  return out;
}
