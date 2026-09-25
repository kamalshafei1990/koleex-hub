import "server-only";

/* ---------------------------------------------------------------------------
   project-members — the project_members table (20260926_projects_additions).

   A member row grants access to the project (see project-access.ts); role
   'viewer' is read-only. The manager / creator / task-assignee rule still
   applies alongside membership — members widen access, they never narrow it.
   `followers_account_ids` on tasks is a separate (task-level) concept and
   is left alone.

   Every writer here also mirrors the change into the project's Discuss
   chat (if one exists): new members join the channel, a removed member
   leaves it (soft-leave, so re-adding revives the same row) unless they
   are still the project manager. A role change never touches the chat.

   Before the migration is applied the table is missing: reads answer
   { available: false }, writes answer a clear 409, and the automatic sync
   from assignees is a silent no-op.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { addAccountsToProjectChannel, removeAccountFromProjectChannel } from "@/lib/server/discuss-project-channel";
import type { MemberRole } from "@/lib/server/project-access";

export const MEMBER_ROLES: readonly MemberRole[] = ["manager", "member", "viewer"];

export interface ProjectMemberRow {
  account_id: string;
  role: MemberRole;
  added_by: string | null;
  created_at: string;
  account?: { id: string; username: string } | null;
}

interface Auth { account_id: string; tenant_id: string }

function tableMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /project_members/.test(err.message ?? "");
}

export async function listProjectMembers(
  tenantId: string,
  projectId: string,
): Promise<{ available: boolean; members: ProjectMemberRow[]; error?: string }> {
  const { data, error } = await supabaseServer
    .from("project_members")
    .select("account_id, role, added_by, created_at, account:account_id ( id, username )")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
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
 *  sync + notifications), or an error. */
export async function upsertProjectMembers(
  auth: Auth,
  projectId: string,
  entries: { account_id: string; role: MemberRole }[],
): Promise<{ added: string[] } | { error: string; status: number }> {
  if (entries.length === 0) return { added: [] };
  const before = new Set(await projectMemberIds(auth.tenant_id, projectId));
  const { error } = await supabaseServer.from("project_members").upsert(
    entries.map((e) => ({
      tenant_id: auth.tenant_id,
      project_id: projectId,
      account_id: e.account_id,
      role: e.role,
      added_by: auth.account_id,
    })),
    { onConflict: "project_id,account_id" },
  );
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
  /* The project manager keeps their seat in the chat — the members route
     already refuses to remove them, this guards any other caller. */
  const { data: proj } = await supabaseServer
    .from("projects")
    .select("manager_account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", projectId)
    .maybeSingle();
  if ((proj as { manager_account_id: string | null } | null)?.manager_account_id !== accountId) {
    await removeAccountFromProjectChannel(auth.tenant_id, projectId, accountId);
  }
  return { ok: true };
}

/** Assigning a task to someone makes them a member (role member) if they
 *  are not one yet — matching the migration's backfill. Existing roles are
 *  never changed. Fire-and-forget safe: never throws. */
export async function syncProjectMembersFromAssignees(auth: Auth, projectId: string, accountIds: string[]): Promise<void> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const before = new Set(await projectMemberIds(auth.tenant_id, projectId));
    const fresh = ids.filter((id) => !before.has(id));
    if (fresh.length === 0) return;
    const { error } = await supabaseServer.from("project_members").upsert(
      fresh.map((id) => ({
        tenant_id: auth.tenant_id,
        project_id: projectId,
        account_id: id,
        role: "member",
        added_by: auth.account_id,
      })),
      { onConflict: "project_id,account_id", ignoreDuplicates: true },
    );
    if (error) {
      if (!tableMissing(error)) console.error("[project-members] sync:", error.message);
      return;
    }
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
