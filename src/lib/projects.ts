"use client";

/* ---------------------------------------------------------------------------
   projects — client-side fetchers + shared types for the Projects app.
   Every call hits the authenticated /api/projects/* routes; no direct
   supabase anon calls.
   --------------------------------------------------------------------------- */

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "open" | "done" | "cancelled";

export interface ProjectRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: ProjectStatus;
  is_billable: boolean;
  is_template: boolean;
  is_favorite: boolean;
  customer_id: string | null;
  manager_account_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  budget_hours: number | null;
  progress_pct: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  customer?: { id: string; display_name: string | null; company_name: string | null } | null;
  manager?: { id: string; username: string } | null;
}

export interface ProjectStage {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_closed: boolean;
  is_default_new: boolean;
}

export interface ProjectTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface TaskRow {
  id: string;
  tenant_id: string;
  project_id: string;
  stage_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assignee_account_id: string | null;
  followers_account_ids: string[];
  tag_ids: string[];
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  logged_hours: number;
  progress_pct: number;
  status: TaskStatus;
  linked_planning_item_id: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  linked_entity_label: string | null;
  sort_order: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  project?: Pick<ProjectRow, "id" | "name" | "color"> | null;
  stage?: Pick<ProjectStage, "id" | "name" | "color" | "is_closed" | "is_default_new" | "sort_order"> | null;
  assignee?: { id: string; username: string } | null;
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "#94a3b8",
  normal: "#60a5fa",
  high: "#fbbf24",
  urgent: "#f87171",
};

/* ── Projects ─────────────────────────────────────── */

export async function fetchProjects(params: {
  status?: ProjectStatus | "all";
  customer_id?: string;
  search?: string;
} = {}): Promise<ProjectRow[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.customer_id) q.set("customer_id", params.customer_id);
  if (params.search) q.set("search", params.search);
  const res = await fetch(`/api/projects?${q.toString()}`, { credentials: "include" });
  if (!res.ok) return [];
  const { projects } = (await res.json()) as { projects: ProjectRow[] };
  return projects ?? [];
}

export async function fetchProject(id: string): Promise<ProjectRow | null> {
  const res = await fetch(`/api/projects/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const { project } = (await res.json()) as { project: ProjectRow };
  return project ?? null;
}

export async function createProject(body: Partial<ProjectRow> & { name: string }): Promise<ProjectRow | null> {
  const res = await fetch("/api/projects", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { project } = (await res.json()) as { project: ProjectRow };
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<ProjectRow>,
): Promise<ProjectRow | null> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { project } = (await res.json()) as { project: ProjectRow };
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

/* ── Stages ───────────────────────────────────────── */

export async function fetchStages(projectId: string): Promise<ProjectStage[]> {
  const res = await fetch(`/api/projects/${projectId}/stages`, { credentials: "include" });
  if (!res.ok) return [];
  const { stages } = (await res.json()) as { stages: ProjectStage[] };
  return stages ?? [];
}

export async function createStage(projectId: string, body: { name: string; color?: string | null; sort_order?: number; is_closed?: boolean; is_default_new?: boolean }): Promise<ProjectStage | null> {
  const res = await fetch(`/api/projects/${projectId}/stages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { stage } = (await res.json()) as { stage: ProjectStage };
  return stage;
}

export async function updateStage(id: string, patch: Partial<ProjectStage>): Promise<ProjectStage | null> {
  const res = await fetch(`/api/projects/stages/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { stage } = (await res.json()) as { stage: ProjectStage };
  return stage;
}

export async function deleteStage(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/stages/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

/* ── Tasks ────────────────────────────────────────── */

export async function fetchTasks(params: {
  project_id?: string;
  mine?: boolean;
  status?: TaskStatus | "all";
  priority?: TaskPriority;
  stage_id?: string;
  search?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
} = {}): Promise<TaskRow[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") {
      if (v) q.set(k, "1");
    } else q.set(k, String(v));
  });
  const res = await fetch(`/api/projects/tasks?${q.toString()}`, { credentials: "include" });
  if (!res.ok) return [];
  const { tasks } = (await res.json()) as { tasks: TaskRow[] };
  return tasks ?? [];
}

export async function createTask(body: Partial<TaskRow> & { project_id: string; title: string }): Promise<TaskRow | null> {
  const res = await fetch("/api/projects/tasks", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { task } = (await res.json()) as { task: TaskRow };
  return task;
}

export async function updateTask(id: string, patch: Partial<TaskRow>): Promise<TaskRow | null> {
  const res = await fetch(`/api/projects/tasks/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { task } = (await res.json()) as { task: TaskRow };
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/tasks/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

/* ── Tags ─────────────────────────────────────────── */

export async function fetchTags(): Promise<ProjectTag[]> {
  const res = await fetch("/api/projects/tags", { credentials: "include" });
  if (!res.ok) return [];
  const { tags } = (await res.json()) as { tags: ProjectTag[] };
  return tags ?? [];
}

export async function createTag(body: { name: string; color?: string | null }): Promise<ProjectTag | null> {
  const res = await fetch("/api/projects/tags", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { tag } = (await res.json()) as { tag: ProjectTag };
  return tag;
}

export async function updateTag(id: string, patch: Partial<ProjectTag>): Promise<ProjectTag | null> {
  const res = await fetch(`/api/projects/tags/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { tag } = (await res.json()) as { tag: ProjectTag };
  return tag;
}

export async function deleteTag(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/tags/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

/* ── Helpers ──────────────────────────────────────── */

export function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 6) return d.toLocaleDateString("en", { weekday: "long" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}
