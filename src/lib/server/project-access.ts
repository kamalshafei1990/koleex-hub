import "server-only";

/* ---------------------------------------------------------------------------
   project-access — row-level membership for the Projects app.

   The list routes have always scoped non-super-admins to projects they are
   INVOLVED in; the per-id routes only checked tenant + module, so anyone with
   the Projects module could read or edit any project by guessing its UUID.
   Every [id] / sub-route now goes through one of the gates below, and they
   apply EXACTLY the rules the list routes apply:

   · Project (GET /api/projects):   super admin, manager, creator, a
     project member (project_members), or the assignee of at least one
     task in it.
   · Task (GET /api/projects/tasks): super admin, the task's assignee or
     creator, or any task in a project the caller manages or created.
     A task in a project the caller can see via the project rule above is
     also reachable — opening the board must never 403 on one of its cards.

   Both gates return the loaded row on success or a ready NextResponse
   (404 outside the tenant, 403 when not involved) on failure.

   Members (2026-09-26): a project_members row grants access. Role
   'viewer' is READ-ONLY — when viewer membership is the caller's ONLY way
   in, a gate called with { write: true } answers 403 — except that a
   task's own assignee or creator keeps write access to THAT task whatever
   their project role (ownsTask / assertTaskWrite; task payloads carry the
   matching per-task `can_edit` so the UI agrees). Until the
   20260926_projects_additions migration is applied the table is missing;
   every lookup here treats that as "no memberships" (never an error).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";

export interface AccessAuth {
  account_id: string;
  tenant_id: string;
  is_super_admin: boolean;
}

export interface ProjectAccessRow {
  id: string;
  manager_account_id: string | null;
  created_by_account_id: string | null;
}

export interface TaskAccessRow {
  id: string;
  project_id: string;
  stage_id: string | null;
  parent_task_id: string | null;
  status: string;
  title: string;
  due_date: string | null;
  start_date: string | null;
  assignee_account_id: string | null;
  created_by_account_id: string | null;
}

const TASK_ACCESS_COLS =
  "id, project_id, stage_id, parent_task_id, status, title, due_date, start_date, assignee_account_id, created_by_account_id";

export type MemberRole = "manager" | "member" | "viewer";
export interface GateOpts { write?: boolean }

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

async function hasAssignedTask(auth: AccessAuth, projectId: string): Promise<boolean> {
  const { count } = await supabaseServer
    .from("project_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .eq("assignee_account_id", auth.account_id);
  return (count ?? 0) > 0;
}

function managesOrCreated(auth: AccessAuth, p: ProjectAccessRow): boolean {
  return p.manager_account_id === auth.account_id || p.created_by_account_id === auth.account_id;
}

/** The caller's project_members role, or null (also when the table is not
 *  migrated yet — the error is swallowed on purpose). */
export async function memberRole(auth: AccessAuth, projectId: string): Promise<MemberRole | null> {
  const { data, error } = await supabaseServer
    .from("project_members")
    .select("role")
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", projectId)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { role: MemberRole }).role;
}

/** Project ids <accountId> is a member of (any role). [] before migration. */
export async function memberProjectIds(tenantId: string, accountId: string): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("project_members")
    .select("project_id")
    .eq("tenant_id", tenantId)
    .eq("account_id", accountId);
  if (error) return [];
  return [...new Set((data ?? []).map((r) => (r as { project_id: string }).project_id))];
}

/** Non-owner path into a project: member role and/or an assigned task.
 *  Resolves the write verdict too (viewer-only ⇒ read-only). */
async function memberOrAssignee(
  auth: AccessAuth,
  projectId: string,
  opts: GateOpts | undefined,
): Promise<"ok" | "read_only" | "none"> {
  const [role, assigned] = await Promise.all([memberRole(auth, projectId), hasAssignedTask(auth, projectId)]);
  if (assigned || role === "manager" || role === "member") return "ok";
  if (role === "viewer") return opts?.write ? "read_only" : "ok";
  return "none";
}

/** Load a project the caller may see (list-route rule), or a 404/403. */
export async function assertProjectAccess(
  auth: AccessAuth,
  projectId: string,
  opts?: GateOpts,
): Promise<ProjectAccessRow | NextResponse> {
  if (!projectId) return notFound();
  const { data } = await supabaseServer
    .from("projects")
    .select("id, manager_account_id, created_by_account_id")
    .eq("id", projectId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const p = (data as ProjectAccessRow | null) ?? null;
  if (!p) return notFound();
  if (auth.is_super_admin || managesOrCreated(auth, p)) return p;
  if ((await memberOrAssignee(auth, p.id, opts)) === "ok") return p;
  return forbidden();
}

/** THE per-task write rule, shared by every task write route (the
 *  [id] / checklist / comments / time / attachments routes through
 *  assertTaskWrite, bulk and reorder directly) and by taskEditFlags for the
 *  UI: a task's own assignee or creator keeps edit rights on THAT task even
 *  when their project access is view-only (viewer membership, or no
 *  membership at all). Everything else in the project follows the project
 *  gate. The Projects module's edit action is checked separately by each
 *  route (requireModuleAction) — without it nothing is writable. */
export function ownsTask(
  auth: Pick<AccessAuth, "account_id">,
  task: { assignee_account_id: string | null; created_by_account_id: string | null },
): boolean {
  return task.assignee_account_id === auth.account_id || task.created_by_account_id === auth.account_id;
}

/** Load a task the caller may see (tasks-list rule, plus project rule). */
export async function assertTaskAccess(
  auth: AccessAuth,
  taskId: string,
  opts?: GateOpts,
): Promise<{ task: TaskAccessRow; project: ProjectAccessRow } | NextResponse> {
  if (!taskId) return notFound();
  const { data } = await supabaseServer
    .from("project_tasks")
    .select(TASK_ACCESS_COLS)
    .eq("id", taskId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const task = (data as TaskAccessRow | null) ?? null;
  if (!task) return notFound();

  const { data: pData } = await supabaseServer
    .from("projects")
    .select("id, manager_account_id, created_by_account_id")
    .eq("id", task.project_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const project = (pData as ProjectAccessRow | null) ?? null;
  if (!project) return notFound();

  if (auth.is_super_admin || ownsTask(auth, task) || managesOrCreated(auth, project)) {
    return { task, project };
  }
  if ((await memberOrAssignee(auth, project.id, opts)) === "ok") return { task, project };
  return forbidden();
}

/** The write gate for one task: the project gate with { write: true }, or
 *  ownsTask. Every task sub-route that mutates goes through this. */
export function assertTaskWrite(
  auth: AccessAuth,
  taskId: string,
): Promise<{ task: TaskAccessRow; project: ProjectAccessRow } | NextResponse> {
  return assertTaskAccess(auth, taskId, { write: true });
}

/** Resolve a stage to its project and apply the project gate. */
export async function assertStageAccess(
  auth: AccessAuth,
  stageId: string,
  opts?: GateOpts,
): Promise<{ stage: { id: string; project_id: string; is_closed: boolean }; project: ProjectAccessRow } | NextResponse> {
  const { data } = await supabaseServer
    .from("project_stages")
    .select("id, project_id, is_closed")
    .eq("id", stageId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const stage = (data as { id: string; project_id: string; is_closed: boolean } | null) ?? null;
  if (!stage) return notFound();
  const gate = await assertProjectAccess(auth, stage.project_id, opts);
  if (gate instanceof NextResponse) return gate;
  return { stage, project: gate };
}

/** Super admin or the project's manager — the moderators of a project. */
export function canModerate(auth: AccessAuth, project: ProjectAccessRow): boolean {
  return auth.is_super_admin || project.manager_account_id === auth.account_id;
}

/** The caller's effective permission on a project, returned with the
 *  project payload as `my_access` so the UI can match the server:
 *    manage — super admin, manager, creator, or member role manager
 *             (members, archive, plus everything below);
 *    edit   — member role member, or the assignee of a task in it;
 *    view   — viewer membership is the only way in (every { write: true }
 *             gate answers 403), or the caller lacks the Projects module's
 *             edit action (`canEditModule` false; also view-as).
 *  Two batched queries for any number of projects — never per project. */
export type ProjectAccessLevel = "manage" | "edit" | "view";

export async function projectAccessLevels(
  auth: AccessAuth,
  projects: ProjectAccessRow[],
  canEditModule: boolean,
): Promise<Map<string, ProjectAccessLevel>> {
  const out = new Map<string, ProjectAccessLevel>();
  if (!canEditModule) {
    for (const p of projects) out.set(p.id, "view");
    return out;
  }
  const rest: string[] = [];
  for (const p of projects) {
    if (auth.is_super_admin || managesOrCreated(auth, p)) out.set(p.id, "manage");
    else rest.push(p.id);
  }
  if (rest.length === 0) return out;
  const [roles, assigned] = await Promise.all([
    supabaseServer
      .from("project_members")
      .select("project_id, role")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .in("project_id", rest),
    supabaseServer
      .from("project_tasks")
      .select("project_id")
      .eq("tenant_id", auth.tenant_id)
      .eq("assignee_account_id", auth.account_id)
      .in("project_id", rest),
  ]);
  /* A missing project_members table (migration pending) reads as "no roles". */
  const roleOf = new Map(
    (roles.error ? [] : ((roles.data ?? []) as { project_id: string; role: MemberRole }[])).map((r) => [r.project_id, r.role]),
  );
  const hasTask = new Set(((assigned.data ?? []) as { project_id: string }[]).map((r) => r.project_id));
  for (const id of rest) {
    const role = roleOf.get(id);
    out.set(id, role === "manager" ? "manage" : role === "member" || hasTask.has(id) ? "edit" : "view");
  }
  return out;
}

/** WHY a project reads as "view" — returned with the project payload as
 *  `my_access_reason` so the "View only" badge can say what to fix:
 *    module — the caller lacks the Projects module's edit action (also
 *             view-as); membership would not help;
 *    viewer — the module allows editing, but the caller's only way into
 *             this project is a viewer membership.
 *  null for manage / edit. */
export type ViewReason = "viewer" | "module";

export function viewReason(level: ProjectAccessLevel | undefined, canEditModule: boolean): ViewReason | null {
  if (level !== "view") return null;
  return canEditModule ? "viewer" : "module";
}

/** Per-task `can_edit` for task payloads, so the UI enables exactly what
 *  assertTaskWrite allows: project access manage/edit, or ownsTask. Also
 *  returns the project-level access per task (`project_access`, e.g. for
 *  the "you edit this because it is yours" note). Creating a SUBTASK
 *  follows the parent's can_edit (POST /api/projects/tasks gates it with
 *  assertTaskWrite on parent_task_id), not the project level.
 *  Batched: one projects read + projectAccessLevels' two queries. */
export interface TaskEditFlags { can_edit: boolean; project_access: ProjectAccessLevel }

export async function taskEditFlags(
  auth: AccessAuth,
  tasks: { id: string; project_id: string; assignee_account_id: string | null; created_by_account_id?: string | null }[],
  canEditModule: boolean,
): Promise<Map<string, TaskEditFlags>> {
  const out = new Map<string, TaskEditFlags>();
  if (tasks.length === 0) return out;
  const pids = [...new Set(tasks.map((t) => t.project_id))];
  let levels = new Map<string, ProjectAccessLevel>();
  if (canEditModule) {
    const { data } = await supabaseServer
      .from("projects")
      .select("id, manager_account_id, created_by_account_id")
      .eq("tenant_id", auth.tenant_id)
      .in("id", pids);
    levels = await projectAccessLevels(auth, (data ?? []) as ProjectAccessRow[], true);
  }
  for (const t of tasks) {
    const level = canEditModule ? levels.get(t.project_id) ?? "view" : "view";
    const can_edit =
      canEditModule &&
      (auth.is_super_admin || level !== "view" ||
        ownsTask(auth, { assignee_account_id: t.assignee_account_id, created_by_account_id: t.created_by_account_id ?? null }));
    out.set(t.id, { can_edit, project_access: level });
  }
  return out;
}

/** Who may add/remove members, archive, and open the project chat for
 *  others: super admin, manager, creator, or a member with role manager. */
export async function canManageProject(auth: AccessAuth, project: ProjectAccessRow): Promise<boolean> {
  if (auth.is_super_admin || managesOrCreated(auth, project)) return true;
  return (await memberRole(auth, project.id)) === "manager";
}

/** PostgREST `.or()` filter for "projects <accountId> is involved in":
 *  manager, creator, member, or assignee of any task. Mirrors
 *  GET /api/projects. */
export async function involvedProjectsOr(tenantId: string, accountId: string): Promise<string> {
  const [{ data }, members] = await Promise.all([
    supabaseServer
      .from("project_tasks")
      .select("project_id")
      .eq("tenant_id", tenantId)
      .eq("assignee_account_id", accountId),
    memberProjectIds(tenantId, accountId),
  ]);
  const ids = [...new Set([...(data ?? []).map((r) => (r as { project_id: string }).project_id), ...members])];
  const parts = [`manager_account_id.eq.${accountId}`, `created_by_account_id.eq.${accountId}`];
  if (ids.length > 0) parts.push(`id.in.(${ids.join(",")})`);
  return parts.join(",");
}

/** A user search term made safe for an ILIKE inside a PostgREST `.or()`.
 *  `%`, `_` and `\` are escaped so they match literally (same as the AI
 *  tool's ilike), and `,` `(` `)` `"` — which would split or re-shape the
 *  `.or()` expression — become the single-char wildcard `_`. */
export function orLikeTerm(raw: string): string {
  const escaped = raw.replace(/[%_\\]/g, "\\$&").replace(/[,()"]/g, "_");
  return `%${escaped}%`;
}

/** Plain ILIKE (not inside `.or()`): only the LIKE metacharacters. */
export function likeTerm(raw: string): string {
  return `%${raw.replace(/[%_\\]/g, "\\$&")}%`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
