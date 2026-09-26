import "server-only";

/* ---------------------------------------------------------------------------
   project-members — the project_members table (20260926_projects_additions).

   A member row grants access to the project (see project-access.ts); role
   'viewer' is read-only. The manager / creator / task-assignee rule still
   applies alongside membership — members widen access, they never narrow it.
   `followers_account_ids` on tasks is a separate (task-level) concept and
   is left alone.

   Every writer here also mirrors the change into the project's Discuss
   chat (if one exists): new members join the channel (a first task
   assignment makes a member, so assignees join too), a removed member
   leaves it (soft-leave, so re-adding revives the same row) unless they
   still reach the project another way — manager, creator or task assignee
   (super admin does not count). A role change never touches the chat.
   Losing a path WITHOUT a membership change (task reassigned away or
   deleted, manager replaced) runs the same check through
   pruneProjectChatSeats — where a project_members row of any role also
   keeps the seat.

   Before the migration is applied the table is missing: reads answer
   { available: false }, writes answer a clear 409, and the automatic sync
   from assignees is a silent no-op.

   Source (20260930_projects_member_source): every row is 'manual' (added
   on purpose — Members panel, AI tool, a role change) or 'auto' (added
   because the account became the manager or a task assignee). An 'auto'
   row lives only as long as its reason: pruneProjectChatSeats deletes an
   'auto' row whose account is no longer the project's manager or creator,
   nor the assignee or creator of any task in it (and demotes an 'auto'
   manager row to member once they stop managing), then runs the chat
   check. 'manual' rows are never touched there; an automatic add never
   downgrades a 'manual' row. Until that migration is applied the column
   is missing and everything behaves as before (every row counts, like
   'manual').
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { addAccountsToProjectChannel, removeAccountFromProjectChannel } from "@/lib/server/discuss-project-channel";
import type { MemberRole } from "@/lib/server/project-access";

export const MEMBER_ROLES: readonly MemberRole[] = ["manager", "member", "viewer"];

export type MemberSource = "manual" | "auto";

export interface ProjectMemberRow {
  account_id: string;
  role: MemberRole;
  added_by: string | null;
  created_at: string;
  /** Absent before 20260930_projects_member_source. */
  source?: MemberSource;
  account?: { id: string; username: string } | null;
}

interface Auth { account_id: string; tenant_id: string }

type PgErr = { code?: string; message?: string } | null;

/** The `source` column is not there yet (20260930 pending). Checked BEFORE
 *  tableMissing, whose message test would also match "project_members.source". */
function sourceMissing(err: PgErr): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /\bsource\b/.test(err.message ?? "");
}

function tableMissing(err: PgErr): boolean {
  if (!err) return false;
  if (sourceMissing(err)) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /project_members/.test(err.message ?? "");
}

export async function listProjectMembers(
  tenantId: string,
  projectId: string,
): Promise<{ available: boolean; members: ProjectMemberRow[]; error?: string }> {
  const read = (cols: string) =>
    supabaseServer
      .from("project_members")
      .select(`${cols}, account:account_id ( id, username )`)
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
  let { data, error } = await read("account_id, role, added_by, created_at, source");
  if (sourceMissing(error)) ({ data, error } = await read("account_id, role, added_by, created_at"));
  if (error) {
    if (tableMissing(error)) return { available: false, members: [] };
    return { available: true, members: [], error: error.message };
  }
  return { available: true, members: (data ?? []) as unknown as ProjectMemberRow[] };
}

/** Account ids of every member (any role). [] before migration. */
export async function projectMemberIds(tenantId: string, projectId: string): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("project_members")
    .select("account_id")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId);
  if (error) return [];
  return (data ?? []).map((r) => (r as { account_id: string }).account_id);
}

/** Keep only ids of accounts in the caller's tenant. */
export async function tenantAccountIds(tenantId: string, ids: string[]): Promise<string[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return [];
  const { data } = await supabaseServer.from("accounts").select("id").eq("tenant_id", tenantId).in("id", uniq);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/** Insert or update members. Returns the ids that were NEW (for the chat
 *  sync + notifications), or an error.
 *
 *  source 'manual' (default — Members panel, AI tool): the rows become
 *  manual, so an explicit add or role change "pins" an auto member.
 *  source 'auto' (the project's manager): NEW rows are inserted as 'auto';
 *  existing rows only get the role, their source is left alone (a manual
 *  row is never downgraded). Before 20260930 the column is left out. */
export async function upsertProjectMembers(
  auth: Auth,
  projectId: string,
  entries: { account_id: string; role: MemberRole }[],
  opts?: { source?: MemberSource },
): Promise<{ added: string[] } | { error: string; status: number }> {
  if (entries.length === 0) return { added: [] };
  const source: MemberSource = opts?.source ?? "manual";
  const before = new Set(await projectMemberIds(auth.tenant_id, projectId));
  const rowOf = (e: { account_id: string; role: MemberRole }, withSource: boolean) => ({
    tenant_id: auth.tenant_id,
    project_id: projectId,
    account_id: e.account_id,
    role: e.role,
    added_by: auth.account_id,
    ...(withSource ? { source } : {}),
  });
  const write = async (withSource: boolean): Promise<PgErr> => {
    if (source === "manual") {
      return (await supabaseServer
        .from("project_members")
        .upsert(entries.map((e) => rowOf(e, withSource)), { onConflict: "project_id,account_id" })).error;
    }
    /* auto: role-only update for existing rows, insert (as auto) for new. */
    for (const e of entries.filter((x) => before.has(x.account_id))) {
      const { error } = await supabaseServer
        .from("project_members")
        .update({ role: e.role })
        .eq("tenant_id", auth.tenant_id)
        .eq("project_id", projectId)
        .eq("account_id", e.account_id);
      if (error) return error;
    }
    const fresh = entries.filter((x) => !before.has(x.account_id));
    if (fresh.length === 0) return null;
    return (await supabaseServer
      .from("project_members")
      .upsert(fresh.map((e) => rowOf(e, withSource)), { onConflict: "project_id,account_id", ignoreDuplicates: true })).error;
  };
  let error = await write(true);
  if (sourceMissing(error)) error = await write(false);
  if (error) {
    if (tableMissing(error)) return { error: "Project members are not available yet.", status: 409 };
    console.error("[project-members] upsert:", error.message);
    return { error: "Failed to save members", status: 500 };
  }
  const added = entries.map((e) => e.account_id).filter((id) => !before.has(id));
  if (added.length > 0) await addAccountsToProjectChannel(auth.tenant_id, projectId, added);
  return { added };
}

export async function removeProjectMember(
  auth: Auth,
  projectId: string,
  accountId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const { error } = await supabaseServer
    .from("project_members")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .eq("account_id", accountId);
  if (error) {
    if (tableMissing(error)) return { error: "Project members are not available yet.", status: 409 };
    console.error("[project-members] delete:", error.message);
    return { error: "Failed to remove member", status: 500 };
  }
  /* Leave the chat only when the membership row was their LAST way into
     the project. Someone who still reaches it as manager, creator or task
     assignee keeps their chat seat (the project stays open to them, so the
     chat should too). */
  if (!(await stillReachesProject(auth.tenant_id, projectId, accountId))) {
    await removeAccountFromProjectChannel(auth.tenant_id, projectId, accountId);
  }
  return { ok: true };
}

/** After a membership row is gone: does <accountId> still reach the project
 *  by another path — manager, creator, or assignee of any task in it (any
 *  status; the same involvement rule as project-access.ts)? Super admin is
 *  deliberately NOT a path: it is a global override, not project
 *  involvement, so it never keeps anyone in a project chat. On a read
 *  error it answers true (keep the seat) — a spurious "leave" is the worse
 *  failure. One-pair wrapper over stillReachingPairs. */
export async function stillReachesProject(tenantId: string, projectId: string, accountId: string): Promise<boolean> {
  const keep = await stillReachingPairs(tenantId, [{ project_id: projectId, account_id: accountId }], false);
  return keep.has(pairKey(projectId, accountId));
}

export interface ProjectSeat { project_id: string; account_id: string }
const pairKey = (projectId: string, accountId: string) => `${projectId}:${accountId}`;

/** Batched stillReachesProject: of the given (project, account) pairs,
 *  which still reach their project — manager, creator, assignee of a task
 *  in it, and (with `countMembership`) any project_members row. Three
 *  queries for any number of pairs. A read error keeps EVERY pair (never a
 *  spurious leave); a missing project_members table (migration pending)
 *  just means "no memberships". */
async function stillReachingPairs(tenantId: string, pairs: ProjectSeat[], countMembership: boolean): Promise<Set<string>> {
  const keep = new Set<string>();
  if (pairs.length === 0) return keep;
  const pids = [...new Set(pairs.map((p) => p.project_id))];
  const aids = [...new Set(pairs.map((p) => p.account_id))];
  const all = () => new Set(pairs.map((p) => pairKey(p.project_id, p.account_id)));
  const [projs, tasks, members] = await Promise.all([
    supabaseServer
      .from("projects")
      .select("id, manager_account_id, created_by_account_id")
      .eq("tenant_id", tenantId)
      .in("id", pids),
    supabaseServer
      .from("project_tasks")
      .select("project_id, assignee_account_id")
      .eq("tenant_id", tenantId)
      .in("project_id", pids)
      .in("assignee_account_id", aids)
      .limit(20000),
    countMembership
      ? supabaseServer
          .from("project_members")
          .select("project_id, account_id")
          .eq("tenant_id", tenantId)
          .in("project_id", pids)
          .in("account_id", aids)
      : Promise.resolve({ data: [] as { project_id: string; account_id: string }[], error: null }),
  ]);
  if (projs.error || tasks.error) return all();
  if (members.error && !tableMissing(members.error)) return all();
  for (const p of (projs.data ?? []) as { id: string; manager_account_id: string | null; created_by_account_id: string | null }[]) {
    if (p.manager_account_id) keep.add(pairKey(p.id, p.manager_account_id));
    if (p.created_by_account_id) keep.add(pairKey(p.id, p.created_by_account_id));
  }
  for (const t of (tasks.data ?? []) as { project_id: string; assignee_account_id: string | null }[]) {
    if (t.assignee_account_id) keep.add(pairKey(t.project_id, t.assignee_account_id));
  }
  for (const m of ((members.error ? [] : members.data) ?? []) as { project_id: string; account_id: string }[]) {
    keep.add(pairKey(m.project_id, m.account_id));
  }
  return keep;
}

/** 'auto' memberships among <pairs> that lost their reason: the account is
 *  no longer the project's manager or creator, nor the assignee or creator
 *  of any task in it. Those rows are deleted; an 'auto' row with role
 *  manager whose account no longer manages the project (but still has
 *  another reason) is demoted to member. 'manual' rows are never touched.
 *  Before 20260930 (no `source` column) — or on any read error — it does
 *  nothing (today's behaviour: every row counts). Never throws. */
async function pruneAutoMemberships(tenantId: string, pairs: ProjectSeat[]): Promise<void> {
  if (pairs.length === 0) return;
  const pids = [...new Set(pairs.map((p) => p.project_id))];
  const aids = [...new Set(pairs.map((p) => p.account_id))];
  const wanted = new Set(pairs.map((p) => pairKey(p.project_id, p.account_id)));
  const { data: rows, error } = await supabaseServer
    .from("project_members")
    .select("project_id, account_id, role")
    .eq("tenant_id", tenantId)
    .eq("source", "auto")
    .in("project_id", pids)
    .in("account_id", aids);
  if (error) return; /* column/table missing, or a read error: keep everything */
  const auto = ((rows ?? []) as { project_id: string; account_id: string; role: MemberRole }[])
    .filter((r) => wanted.has(pairKey(r.project_id, r.account_id)));
  if (auto.length === 0) return;

  const [projs, assigned, created] = await Promise.all([
    supabaseServer.from("projects").select("id, manager_account_id, created_by_account_id").eq("tenant_id", tenantId).in("id", pids),
    supabaseServer.from("project_tasks").select("project_id, assignee_account_id")
      .eq("tenant_id", tenantId).in("project_id", pids).in("assignee_account_id", aids).limit(20000),
    supabaseServer.from("project_tasks").select("project_id, created_by_account_id")
      .eq("tenant_id", tenantId).in("project_id", pids).in("created_by_account_id", aids).limit(20000),
  ]);
  if (projs.error || assigned.error || created.error) return; /* never a spurious removal */
  const managerOf = new Map<string, string | null>();
  const reason = new Set<string>();
  for (const p of (projs.data ?? []) as { id: string; manager_account_id: string | null; created_by_account_id: string | null }[]) {
    managerOf.set(p.id, p.manager_account_id);
    if (p.manager_account_id) reason.add(pairKey(p.id, p.manager_account_id));
    if (p.created_by_account_id) reason.add(pairKey(p.id, p.created_by_account_id));
  }
  for (const t of (assigned.data ?? []) as { project_id: string; assignee_account_id: string | null }[]) {
    if (t.assignee_account_id) reason.add(pairKey(t.project_id, t.assignee_account_id));
  }
  for (const t of (created.data ?? []) as { project_id: string; created_by_account_id: string | null }[]) {
    if (t.created_by_account_id) reason.add(pairKey(t.project_id, t.created_by_account_id));
  }

  for (const r of auto) {
    /* The `source = 'auto'` filter on every write keeps a row that was
       made manual in the meantime (Members panel) out of reach. */
    if (!reason.has(pairKey(r.project_id, r.account_id))) {
      const { error: delErr } = await supabaseServer
        .from("project_members")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("project_id", r.project_id)
        .eq("account_id", r.account_id)
        .eq("source", "auto");
      if (delErr) console.error("[project-members] prune auto:", delErr.message);
    } else if (r.role === "manager" && managerOf.has(r.project_id) && managerOf.get(r.project_id) !== r.account_id) {
      const { error: upErr } = await supabaseServer
        .from("project_members")
        .update({ role: "member" })
        .eq("tenant_id", tenantId)
        .eq("project_id", r.project_id)
        .eq("account_id", r.account_id)
        .eq("source", "auto");
      if (upErr) console.error("[project-members] demote auto manager:", upErr.message);
    }
  }
}

/** After someone LOST a path into a project without a membership change —
 *  a task reassigned away from them (PATCH, bulk assign, AI tool), a task
 *  of theirs deleted, or the project's manager changed — first drop their
 *  'auto' membership if it no longer has a reason (pruneAutoMemberships;
 *  'manual' rows stay), then take their seat in the project chat away if
 *  they no longer reach the project at all (not manager, creator, task
 *  assignee, nor a remaining project member of any role). Batched: one
 *  reachability pass (stillReachingPairs, three queries) for every pair,
 *  then one soft-leave per account that really lost access
 *  (removeAccountFromProjectChannel is per account). Call it AFTER the
 *  write has landed, from after(). Never throws. */
export async function pruneProjectChatSeats(tenantId: string, seats: ProjectSeat[]): Promise<void> {
  try {
    const uniq = new Map<string, ProjectSeat>();
    for (const s of seats) {
      if (s.project_id && s.account_id) uniq.set(pairKey(s.project_id, s.account_id), s);
    }
    if (uniq.size === 0) return;
    await pruneAutoMemberships(tenantId, [...uniq.values()]);
    const keep = await stillReachingPairs(tenantId, [...uniq.values()], true);
    for (const [k, s] of uniq) {
      if (!keep.has(k)) await removeAccountFromProjectChannel(tenantId, s.project_id, s.account_id);
    }
  } catch (e) {
    console.error("[project-members] prune chat seats:", e);
  }
}

/** Assigning a task to someone makes them a member (role member, source
 *  'auto') if they are not one yet — matching the migration's backfill.
 *  Existing rows (roles AND sources) are never changed, so a manual row is
 *  never downgraded. Fire-and-forget safe: never throws. */
export async function syncProjectMembersFromAssignees(auth: Auth, projectId: string, accountIds: string[]): Promise<void> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const before = new Set(await projectMemberIds(auth.tenant_id, projectId));
    const fresh = ids.filter((id) => !before.has(id));
    if (fresh.length === 0) return;
    const insert = (withSource: boolean) =>
      supabaseServer.from("project_members").upsert(
        fresh.map((id) => ({
          tenant_id: auth.tenant_id,
          project_id: projectId,
          account_id: id,
          role: "member",
          added_by: auth.account_id,
          ...(withSource ? { source: "auto" } : {}),
        })),
        { onConflict: "project_id,account_id", ignoreDuplicates: true },
      );
    let { error } = await insert(true);
    if (sourceMissing(error)) ({ error } = await insert(false));
    if (error && !tableMissing(error)) {
      console.error("[project-members] sync:", error.message);
      return;
    }
    /* First assignment ⇒ they join the project chat too (if one exists) —
       also before the members migration, since the assignment alone
       already grants project access. addAccountsToProjectChannel is
       idempotent and never throws. */
    await addAccountsToProjectChannel(auth.tenant_id, projectId, fresh);
  } catch (e) {
    console.error("[project-members] sync:", e);
  }
}

/** Member count per project in ONE query: the project_member_counts RPC
 *  (supabase/migrations/20260927_projects_partials.sql). Until that is
 *  applied, one narrow select aggregated here. Projects without members
 *  are absent (read as 0); before 20260926 the map is empty. */
export async function projectMemberCounts(tenantId: string, projectIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (projectIds.length === 0) return out;
  const { data, error } = await supabaseServer.rpc("project_member_counts", {
    p_tenant: tenantId,
    p_project_ids: projectIds,
  });
  if (!error && Array.isArray(data)) {
    for (const r of data as { project_id: string; member_count: number }[]) out.set(r.project_id, r.member_count);
    return out;
  }
  const { data: rows, error: selErr } = await supabaseServer
    .from("project_members")
    .select("project_id")
    .eq("tenant_id", tenantId)
    .in("project_id", projectIds)
    .limit(50000);
  if (selErr) return out;
  for (const r of (rows ?? []) as { project_id: string }[]) out.set(r.project_id, (out.get(r.project_id) ?? 0) + 1);
  return out;
}
