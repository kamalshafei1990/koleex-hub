import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/todos
   Returns the enriched todo list (with assignees, assigner, notes) scoped
   to what the caller is allowed to see.

   Type C module semantics (hardcoded, regardless of koleex_permissions
   data_scope):
     - Super Admin: sees every todo in the tenant.
     - Everyone else: sees todos where ANY of:
         - created_by_account_id = me
         - assigned_by_account_id = me
         - appears in koleex_todo_assignees as me
         - assigned_department = my department
         - assign_to_all = true (broadcast)
       MINUS any is_private=true unless I'm the creator or have
       can_view_private (break-glass).

   Multi-tenancy: always filtered by auth.tenant_id.
*/

interface AssigneeInfo {
  account_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  // Step 1: resolve the set of todo_ids the caller is an assignee of.
  // Needed for the "shared" branch of the scope OR.
  let assigneeTodoIds: string[] = [];
  if (!auth.is_super_admin) {
    const { data: rows } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id")
      .eq("account_id", auth.account_id);
    assigneeTodoIds = (rows ?? []).map(
      (r) => (r as { todo_id: string }).todo_id,
    );
  }

  // Step 2: main todos query with scope + tenant + privacy filters.
  let query = supabaseServer
    .from("koleex_todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (auth.tenant_id) {
    query = query.eq("tenant_id", auth.tenant_id);
  }

  if (!auth.is_super_admin) {
    // Build a PostgREST "or" clause for the scope match.
    const orParts: string[] = [
      `created_by_account_id.eq.${auth.account_id}`,
      `assigned_by_account_id.eq.${auth.account_id}`,
      `assign_to_all.eq.true`,
    ];
    if (auth.department) {
      orParts.push(`assigned_department.eq.${auth.department}`);
    }
    if (assigneeTodoIds.length > 0) {
      orParts.push(`id.in.(${assigneeTodoIds.join(",")})`);
    }
    query = query.or(orParts.join(","));

    // Privacy: hide is_private unless I'm the creator or have break-glass.
    if (!auth.can_view_private) {
      query = query.or(
        `is_private.eq.false,created_by_account_id.eq.${auth.account_id}`,
      );
    }
  }

  const { data: todos, error } = await query;
  if (error) {
    console.error("[api/todos]", error.message);
    return NextResponse.json(
      { error: "Failed to load todos" },
      { status: 500 },
    );
  }
  if (!todos || todos.length === 0) {
    return NextResponse.json({ todos: [] });
  }

  // Audit break-glass private reads.
  if (auth.can_view_private) {
    const privateIds = (
      todos as Array<{
        id: string;
        is_private?: boolean;
        created_by_account_id?: string | null;
      }>
    )
      .filter(
        (t) => t.is_private && t.created_by_account_id !== auth.account_id,
      )
      .map((t) => t.id);
    if (privateIds.length > 0) {
      void supabaseServer.from("koleex_private_access_log").insert(
        privateIds.map((id) => ({
          account_id: auth.account_id,
          role_id: auth.role_id,
          module_name: "To-do",
          record_type: "koleex_todos",
          record_id: id,
          access_reason: null,
        })),
      );
    }
  }

  const todoIds = (todos as Array<{ id: string }>).map((t) => t.id);

  // Step 3: enrichment — assignees, notes, account info resolution.
  const [{ data: assigneeRows }, { data: noteRows }] = await Promise.all([
    supabaseServer
      .from("koleex_todo_assignees")
      .select("*")
      .in("todo_id", todoIds),
    supabaseServer
      .from("koleex_todo_notes")
      .select("*")
      .in("todo_id", todoIds)
      .order("created_at", { ascending: true }),
  ]);

  const allAccountIds = new Set<string>();
  (todos as Array<Record<string, unknown>>).forEach((t) => {
    const c = t.created_by_account_id as string | null;
    const a = t.assigned_by_account_id as string | null;
    if (c) allAccountIds.add(c);
    if (a) allAccountIds.add(a);
  });
  (assigneeRows ?? []).forEach((a) =>
    allAccountIds.add((a as { account_id: string }).account_id),
  );
  (noteRows ?? []).forEach((n) =>
    allAccountIds.add((n as { author_account_id: string }).author_account_id),
  );

  const infos = await resolveAssigneeInfos(Array.from(allAccountIds));
  const infoMap = new Map(infos.map((i) => [i.account_id, i]));

  const enriched = (todos as Array<Record<string, unknown>>).map((t) => {
    const tAssignees = (assigneeRows ?? [])
      .filter((a) => (a as { todo_id: string }).todo_id === (t.id as string))
      .map((a) => infoMap.get((a as { account_id: string }).account_id))
      .filter(Boolean) as AssigneeInfo[];

    const assignedBy = t.assigned_by_account_id as string | null;
    const assigner = assignedBy
      ? (() => {
          const info = infoMap.get(assignedBy);
          return info
            ? {
                account_id: info.account_id,
                username: info.username,
                full_name: info.full_name,
                avatar_url: info.avatar_url,
              }
            : null;
        })()
      : null;

    const tNotes = (noteRows ?? [])
      .filter((n) => (n as { todo_id: string }).todo_id === (t.id as string))
      .map((n) => {
        const row = n as {
          author_account_id: string;
          [k: string]: unknown;
        };
        const auth2 = infoMap.get(row.author_account_id);
        return {
          ...row,
          author_username: auth2?.username ?? "unknown",
          author_full_name: auth2?.full_name ?? null,
          author_avatar_url: auth2?.avatar_url ?? null,
        };
      });

    return { ...t, assignees: tAssignees, assigner, notes: tNotes };
  });

  return NextResponse.json({ todos: enriched });
}

/* Resolve assignee info (username, full_name, avatar, dept, position) for
   a batch of account_ids. Mirrors resolveAssignees in todo-admin.ts. */
async function resolveAssigneeInfos(
  accountIds: string[],
): Promise<AssigneeInfo[]> {
  if (accountIds.length === 0) return [];

  const { data: accounts } = await supabaseServer
    .from("accounts")
    .select("id, username, avatar_url, person_id")
    .in("id", accountIds);

  if (!accounts || accounts.length === 0) return [];

  const personIds = (accounts as Array<{ person_id: string | null }>)
    .map((a) => a.person_id)
    .filter(Boolean) as string[];

  const [peopleRes, empRes] = await Promise.all([
    personIds.length > 0
      ? supabaseServer
          .from("people")
          .select("id, full_name")
          .in("id", personIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    supabaseServer
      .from("koleex_employees")
      .select("account_id, department, position")
      .in("account_id", accountIds),
  ]);

  const personMap = new Map(
    ((peopleRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const empMap = new Map(
    ((empRes.data ?? []) as Array<{
      account_id: string;
      department: string | null;
      position: string | null;
    }>).map((e) => [e.account_id, e]),
  );

  return (
    accounts as Array<{
      id: string;
      username: string;
      avatar_url: string | null;
      person_id: string | null;
    }>
  ).map((a) => {
    const person = a.person_id ? personMap.get(a.person_id) : null;
    const emp = empMap.get(a.id);
    return {
      account_id: a.id,
      username: a.username,
      full_name: person?.full_name ?? null,
      avatar_url: a.avatar_url,
      department: emp?.department ?? null,
      position: emp?.position ?? null,
    };
  });
}
