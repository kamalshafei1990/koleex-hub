import "server-only";

/* ---------------------------------------------------------------------------
   project-access — row-level membership for the Projects app.

   The list routes have always scoped non-super-admins to projects they are
   INVOLVED in; the per-id routes only checked tenant + module, so anyone with
   the Projects module could read or edit any project by guessing its UUID.
   Every [id] / sub-route now goes through one of the gates below, and they
   apply EXACTLY the rules the list routes apply:

   · Project (GET /api/projects):   super admin, manager, creator, or the
     assignee of at least one task in it.
   · Task (GET /api/projects/tasks): super admin, the task's assignee or
     creator, or any task in a project the caller manages or created.
     A task in a project the caller can see via the project rule above is
     also reachable — opening the board must never 403 on one of its cards.

   Both gates return the loaded row on success or a ready NextResponse
   (404 outside the tenant, 403 when not involved) on failure.
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
  assignee_account_id: string | null;
  created_by_account_id: string | null;
}

const TASK_ACCESS_COLS =
  "id, project_id, stage_id, parent_task_id, status, title, due_date, assignee_account_id, created_by_account_id";

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

/** Load a project the caller may see (list-route rule), or a 404/403. */
export async function assertProjectAccess(
  auth: AccessAuth,
  projectId: string,
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
  if (await hasAssignedTask(auth, p.id)) return p;
  return forbidden();
}

/** Load a task the caller may see (tasks-list rule, plus project rule). */
export async function assertTaskAccess(
  auth: AccessAuth,
  taskId: string,
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

  if (
    auth.is_super_admin ||
    task.assignee_account_id === auth.account_id ||
    task.created_by_account_id === auth.account_id ||
    managesOrCreated(auth, project)
  ) {
    return { task, project };
  }
  if (await hasAssignedTask(auth, project.id)) return { task, project };
  return forbidden();
}

/** Resolve a stage to its project and apply the project gate. */
export async function assertStageAccess(
  auth: AccessAuth,
  stageId: string,
): Promise<{ stage: { id: string; project_id: string; is_closed: boolean }; project: ProjectAccessRow } | NextResponse> {
  const { data } = await supabaseServer
    .from("project_stages")
    .select("id, project_id, is_closed")
    .eq("id", stageId)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  const stage = (data as { id: string; project_id: string; is_closed: boolean } | null) ?? null;
  if (!stage) return notFound();
  const gate = await assertProjectAccess(auth, stage.project_id);
  if (gate instanceof NextResponse) return gate;
  return { stage, project: gate };
}

/** Super admin or the project's manager — the moderators of a project. */
export function canModerate(auth: AccessAuth, project: ProjectAccessRow): boolean {
  return auth.is_super_admin || project.manager_account_id === auth.account_id;
}

/** PostgREST `.or()` filter for "projects <accountId> is involved in":
 *  manager, creator, or assignee of any task. Mirrors GET /api/projects. */
export async function involvedProjectsOr(tenantId: string, accountId: string): Promise<string> {
  const { data } = await supabaseServer
    .from("project_tasks")
    .select("project_id")
    .eq("tenant_id", tenantId)
    .eq("assignee_account_id", accountId);
  const ids = [...new Set((data ?? []).map((r) => (r as { project_id: string }).project_id))];
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
