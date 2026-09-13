import "server-only";

/* The pure half of lib/server/todo-scope.ts — the viewer and the clauses —
   kept apart so a suite can prove the rule without a database. */

export interface TodoViewer {
  accountId: string;
  tenantId: string | null;
  department: string | null;
  isSuperAdmin: boolean;
  canViewPrivate: boolean;
}

/** The PostgREST `or` clauses of the scope, or null for a super admin. Pure. */
export function todoScopeClauses(v: TodoViewer, sharedIds: string[]): { scope: string; privacy: string | null } | null {
  if (v.isSuperAdmin) return null;
  const orParts = [
    `created_by_account_id.eq.${v.accountId}`,
    `assigned_by_account_id.eq.${v.accountId}`,
    `assign_to_all.eq.true`,
  ];
  if (v.department) orParts.push(`assigned_department.eq.${v.department}`);
  if (sharedIds.length > 0) orParts.push(`id.in.(${sharedIds.join(",")})`);
  return {
    scope: orParts.join(","),
    privacy: v.canViewPrivate ? null : `is_private.eq.false,created_by_account_id.eq.${v.accountId}`,
  };
}

/** Apply the scope to a koleex_todos query the caller has already bounded
 *  by tenant. Two `.or()` calls AND together, as PostgREST reads them. */
export function applyTodoScope<Q extends { or(filters: string): Q }>(q: Q, v: TodoViewer, sharedIds: string[]): Q {
  const c = todoScopeClauses(v, sharedIds);
  if (!c) return q;
  let out = q.or(c.scope);
  if (c.privacy) out = out.or(c.privacy);
  return out;
}
