"use client";

/* ---------------------------------------------------------------------------
   projects — client-side fetchers + shared types for the Projects app.
   Every call hits the authenticated /api/projects/* routes; no direct
   supabase anon calls — EXCEPT the realtime Broadcast channel below, which
   is a pub/sub message bus carrying NO database rows (just a "changed" ping),
   so it needs no table RLS exposure.
   --------------------------------------------------------------------------- */

import { supabaseAdmin } from "./supabase-admin";

/* ── Realtime: collaborative board sync via Broadcast ──────────────────────
   We deliberately do NOT use postgres_changes here: project_tasks/stages are
   RLS-locked to service_role and the browser uses the anon key with no tenant
   JWT, so a readable policy would leak across tenants. Broadcast sidesteps
   that — the editing client emits an empty ping on a per-project channel and
   other open boards silently refetch through the tenant-scoped API. Channel
   names use the project UUID (not enumerable); payloads carry no data. */
export function openProjectBoardChannel(
  projectId: string,
  onRemoteChange: () => void,
): { signal: () => void; close: () => void } {
  const ch = supabaseAdmin
    .channel(`project-board:${projectId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "changed" }, () => onRemoteChange())
    .subscribe();
  return {
    signal: () => { void ch.send({ type: "broadcast", event: "changed", payload: {} }); },
    close: () => { void ch.unsubscribe(); },
  };
}

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
  budget_amount: number | null;
  billing_rate: number | null;
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
  blocked_by_task_ids: string[];
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

/** Duplicate a project as a fresh starter — copies core fields + its stage
 *  pipeline (not the tasks). Returns the new project. */
export async function duplicateProject(source: ProjectRow): Promise<ProjectRow | null> {
  const created = await createProject({
    name: `${source.name} (copy)`,
    code: source.code,
    description: source.description,
    color: source.color,
    is_billable: source.is_billable,
    customer_id: source.customer_id,
    manager_account_id: source.manager_account_id,
    budget_hours: source.budget_hours,
    status: "active",
  });
  if (!created) return null;
  const stages = await fetchStages(source.id);
  for (const s of stages.sort((a, b) => a.sort_order - b.sort_order)) {
    await createStage(created.id, {
      name: s.name,
      color: s.color,
      sort_order: s.sort_order,
      is_closed: s.is_closed,
      is_default_new: s.is_default_new,
    });
  }
  return created;
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

/* ── Phase 2: comments / checklist / milestones / time / files ───── */

export interface TaskComment {
  id: string;
  task_id: string;
  author_account_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author?: { id: string; username: string } | null;
}
export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
}
export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_reached: boolean;
  color: string | null;
  sort_order: number;
}
export interface TimeEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  account_id: string | null;
  minutes: number;
  entry_date: string;
  note: string | null;
  created_at: string;
  account?: { id: string; username: string } | null;
}
export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  url?: string | null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}
async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

/* Comments */
export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  return (await getJson<{ comments: TaskComment[] }>(`/api/projects/tasks/${taskId}/comments`))?.comments ?? [];
}
export async function createComment(taskId: string, body: string): Promise<TaskComment | null> {
  return (await sendJson<{ comment: TaskComment }>(`/api/projects/tasks/${taskId}/comments`, "POST", { body }))?.comment ?? null;
}
export async function deleteComment(taskId: string, id: string): Promise<boolean> {
  return !!(await sendJson(`/api/projects/tasks/${taskId}/comments/${id}`, "DELETE"));
}

/* Checklist */
export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  return (await getJson<{ items: ChecklistItem[] }>(`/api/projects/tasks/${taskId}/checklist`))?.items ?? [];
}
export async function createChecklistItem(taskId: string, title: string): Promise<ChecklistItem | null> {
  return (await sendJson<{ item: ChecklistItem }>(`/api/projects/tasks/${taskId}/checklist`, "POST", { title }))?.item ?? null;
}
export async function updateChecklistItem(taskId: string, id: string, patch: Partial<ChecklistItem>): Promise<boolean> {
  return !!(await sendJson(`/api/projects/tasks/${taskId}/checklist/${id}`, "PATCH", patch));
}
export async function deleteChecklistItem(taskId: string, id: string): Promise<boolean> {
  return !!(await sendJson(`/api/projects/tasks/${taskId}/checklist/${id}`, "DELETE"));
}

/* Milestones */
export async function fetchMilestones(projectId: string): Promise<Milestone[]> {
  return (await getJson<{ milestones: Milestone[] }>(`/api/projects/${projectId}/milestones`))?.milestones ?? [];
}
export async function createMilestone(projectId: string, body: Partial<Milestone> & { name: string }): Promise<Milestone | null> {
  return (await sendJson<{ milestone: Milestone }>(`/api/projects/${projectId}/milestones`, "POST", body))?.milestone ?? null;
}
export async function updateMilestone(projectId: string, id: string, patch: Partial<Milestone>): Promise<boolean> {
  return !!(await sendJson(`/api/projects/${projectId}/milestones/${id}`, "PATCH", patch));
}
export async function deleteMilestone(projectId: string, id: string): Promise<boolean> {
  return !!(await sendJson(`/api/projects/${projectId}/milestones/${id}`, "DELETE"));
}

/* Time entries */
export async function fetchTimeEntries(taskId: string): Promise<TimeEntry[]> {
  return (await getJson<{ entries: TimeEntry[] }>(`/api/projects/tasks/${taskId}/time`))?.entries ?? [];
}
export async function createTimeEntry(taskId: string, body: { minutes: number; entry_date?: string; note?: string }): Promise<TimeEntry | null> {
  return (await sendJson<{ entry: TimeEntry }>(`/api/projects/tasks/${taskId}/time`, "POST", body))?.entry ?? null;
}
export async function deleteTimeEntry(taskId: string, id: string): Promise<boolean> {
  return !!(await sendJson(`/api/projects/tasks/${taskId}/time/${id}`, "DELETE"));
}

/* Attachments */
export async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  return (await getJson<{ attachments: TaskAttachment[] }>(`/api/projects/tasks/${taskId}/attachments`))?.attachments ?? [];
}
export async function uploadAttachment(taskId: string, file: File): Promise<TaskAttachment | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/projects/tasks/${taskId}/attachments`, { method: "POST", credentials: "include", body: fd });
  if (!res.ok) return null;
  return ((await res.json()) as { attachment: TaskAttachment }).attachment ?? null;
}
export async function deleteAttachment(taskId: string, id: string): Promise<boolean> {
  return !!(await sendJson(`/api/projects/tasks/${taskId}/attachments/${id}`, "DELETE"));
}

/* ── Accounts (assignee / manager pickers) ────────── */

export interface AccountLite {
  id: string;
  username: string;
}

let _accountsCache: AccountLite[] | null = null;
export async function fetchAccounts(): Promise<AccountLite[]> {
  if (_accountsCache) return _accountsCache;
  const res = await fetch("/api/accounts", { credentials: "include" });
  if (!res.ok) return [];
  const { accounts } = (await res.json()) as {
    accounts: { id: string; username: string; status?: string }[];
  };
  const list = (accounts ?? [])
    .filter((a) => a.status !== "inactive" && a.status !== "disabled")
    .map((a) => ({ id: a.id, username: a.username }))
    .sort((a, b) => a.username.localeCompare(b.username));
  _accountsCache = list;
  return list;
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
