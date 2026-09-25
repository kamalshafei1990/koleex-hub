"use client";

/* ---------------------------------------------------------------------------
   projects — client-side fetchers + shared types for the Projects app.
   Every call hits the authenticated /api/projects/* routes; no direct
   supabase anon calls — EXCEPT the realtime Broadcast channel below, which
   is a pub/sub message bus carrying NO database rows (just a "changed" ping),
   so it needs no table RLS exposure.
   --------------------------------------------------------------------------- */

/* List reads go through cachedGet with TTL 0 — coalescing, not caching.
   cachedGet hands back an in-flight promise before it consults the TTL, so a
   duplicate read fired in the same tick joins the first instead of opening its
   own connection, and nothing is ever served stale. Measured on a prod build:
   /projects issued /api/projects/tags TWICE, 1ms apart, at 429ms and 596ms.
   Writes are untouched. */
import { cachedGet } from "./client-cache";

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
  created_by_account_id?: string | null;
  planned_start: string | null;
  planned_end: string | null;
  budget_hours: number | null;
  budget_amount: number | null;
  billing_rate: number | null;
  progress_pct: number | null;
  /** ISO currency code for budget_amount / billing_rate (null = none set).
   *  Absent until 20260926_projects_additions.sql is applied. */
  currency?: string | null;
  /** When the project was archived (status "archived"); null otherwise. */
  archived_at?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  customer?: { id: string; display_name: string | null; company_name: string | null } | null;
  manager?: { id: string; username: string } | null;
  /** Only on list rows (GET /api/projects): open/overdue count every open
   *  task; done/total are top-level non-cancelled (progress rule). */
  task_counts?: ProjectTaskCounts;
  /** Only on list rows: the caller manages / created / holds a task. */
  involved?: boolean;
  /** project_members rows (list + detail payloads) — the Members button
   *  count without fetching the member list. */
  member_count?: number;
  /** The caller's effective permission (list + detail payloads). "view" =
   *  read-only: every write route answers 403, so the UI hides writes. */
  my_access?: ProjectAccess;
}

export type ProjectAccess = "manage" | "edit" | "view";

export interface ProjectTaskCounts {
  open: number;
  overdue: number;
  done: number;
  total: number;
}

export type ProjectStatusCounts = Record<ProjectStatus | "all", number>;

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
  tenant_id?: string;
  project_id: string;
  stage_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assignee_account_id: string | null;
  followers_account_ids?: string[];
  tag_ids: string[];
  blocked_by_task_ids: string[];
  due_date: string | null;
  start_date?: string | null;
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
  updated_at?: string;
  project?: Pick<ProjectRow, "id" | "name" | "color"> | null;
  stage?: Pick<ProjectStage, "id" | "name" | "color" | "is_closed" | "is_default_new" | "sort_order"> | null;
  assignee?: { id: string; username: string } | null;
  created_by_account_id?: string | null;
  /** Server-computed (task list / detail / create / update payloads): the
   *  caller may write THIS task — project access manage/edit, or they are
   *  its assignee / creator (a view-only member keeps edit rights on the
   *  tasks they created). Absent on older payloads = follow the project. */
  can_edit?: boolean;
  /** The caller's project-level access for the task's project — creating
   *  a subtask is a project write, so the subtasks panel follows this. */
  project_access?: ProjectAccess;
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "#94a3b8",
  normal: "#60a5fa",
  high: "#fbbf24",
  urgent: "#f87171",
};

/* ── Transport ────────────────────────────────────── */

/** A failed Projects API call. `message` is the server's (generic,
 *  user-safe) error text, ready for a toast. */
export class ProjectsApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
      : init.headers,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ProjectsApiError(j?.error ?? `HTTP ${res.status}`, res.status, j?.code);
  }
  return (await res.json()) as T;
}
const send = <T>(url: string, method: string, body?: unknown) =>
  api<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/* ── Projects ─────────────────────────────────────── */

/** Lenient list read (Todo's project picker, the template gallery):
 *  never throws, an error reads as an empty list. */
export async function fetchProjects(params: {
  status?: ProjectStatus | "all";
  customer_id?: string;
  search?: string;
  templates?: boolean;
} = {}): Promise<ProjectRow[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.customer_id) q.set("customer_id", params.customer_id);
  if (params.search) q.set("search", params.search);
  if (params.templates) q.set("templates", "1");
  const { projects } = await cachedGet<{ projects: ProjectRow[] }>(
    `/api/projects?${q.toString()}`, 0,
  ).catch(() => ({ projects: [] as ProjectRow[] }));
  return projects ?? [];
}

/* Home warms `/api/projects` (bare) into the browser HTTP cache on hover
   (src/app/page.tsx). The FIRST list read of the session asks for that
   exact URL in the default cache mode so it can reuse the warm entry;
   every later read uses "reload" — always the network, and it refreshes
   the HTTP cache so a later default-mode read can never see stale rows. */
let firstListRead = true;

/** The Projects list screen's read: rows + per-status counts. Throws. */
export async function fetchProjectList(params: {
  status: ProjectStatus | "all";
  search?: string;
  involves?: string;
}): Promise<{ projects: ProjectRow[]; counts: ProjectStatusCounts }> {
  const q = new URLSearchParams();
  if (params.status !== "active") q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.involves) q.set("involves", params.involves);
  const qs = q.toString();
  const url = qs ? `/api/projects?${qs}` : "/api/projects";
  const cache: RequestCache = firstListRead && !qs ? "default" : "reload";
  firstListRead = false;
  const j = await api<{ projects: ProjectRow[]; counts: Partial<ProjectStatusCounts> }>(url, { cache });
  return {
    projects: j.projects ?? [],
    counts: { active: 0, on_hold: 0, completed: 0, archived: 0, all: 0, ...(j.counts ?? {}) },
  };
}

export async function fetchProjectById(id: string): Promise<ProjectRow> {
  return (await api<{ project: ProjectRow }>(`/api/projects/${id}`)).project;
}

export async function createProject(
  body: Partial<ProjectRow> & { name: string; template_id?: string | null; copy_tasks?: boolean },
): Promise<ProjectRow> {
  return (await send<{ project: ProjectRow }>("/api/projects", "POST", body)).project;
}

export async function updateProject(id: string, patch: Partial<ProjectRow>): Promise<ProjectRow> {
  return (await send<{ project: ProjectRow }>(`/api/projects/${id}`, "PATCH", patch)).project;
}

/** Permanent delete — super admins only (the server refuses everyone else;
 *  they archive instead). */
export async function deleteProject(id: string): Promise<void> {
  await send(`/api/projects/${id}`, "DELETE");
}

/** Archive (restorable): status "archived", the server stamps archived_at. */
export async function archiveProject(id: string): Promise<ProjectRow> {
  return updateProject(id, { status: "archived" });
}

/** Restore an archived project to Active. */
export async function restoreProject(id: string): Promise<ProjectRow> {
  return updateProject(id, { status: "active" });
}

/* ── Project members ──────────────────────────────── */

export type ProjectMemberRole = "manager" | "member" | "viewer";

export interface ProjectMember {
  account_id: string;
  role: ProjectMemberRole;
  added_by: string | null;
  created_at: string;
  account?: { id: string; username: string } | null;
}

export interface ProjectMembersResponse {
  /** false until the members migration is applied. */
  available: boolean;
  members: ProjectMember[];
  can_manage: boolean;
  manager_account_id: string | null;
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMembersResponse> {
  return api<ProjectMembersResponse>(`/api/projects/${projectId}/members`);
}

export async function addProjectMembers(projectId: string, accountIds: string[], role: ProjectMemberRole = "member"): Promise<void> {
  await send(`/api/projects/${projectId}/members`, "POST", { account_ids: accountIds, role });
}

export async function updateProjectMemberRole(projectId: string, accountId: string, role: ProjectMemberRole): Promise<void> {
  await send(`/api/projects/${projectId}/members`, "PATCH", { account_id: accountId, role });
}

export async function removeProjectMember(projectId: string, accountId: string): Promise<void> {
  await send(`/api/projects/${projectId}/members?account_id=${encodeURIComponent(accountId)}`, "DELETE");
}

/** Find-or-create the project's Discuss chat; returns the channel id. */
export async function openProjectChat(projectId: string): Promise<string> {
  return (await send<{ channel_id: string }>(`/api/projects/${projectId}/chat`, "POST")).channel_id;
}

/** Duplicate a project as a fresh starter — core fields + its stage
 *  pipeline (not the tasks), through the same server-side copy path that
 *  templates use (one request, bulk inserts). The code is NOT copied:
 *  codes identify a project. */
export async function duplicateProject(source: ProjectRow): Promise<ProjectRow> {
  return createProject({
    name: `${source.name} (copy)`,
    code: null,
    description: source.description,
    color: source.color,
    is_billable: source.is_billable,
    customer_id: source.customer_id,
    manager_account_id: source.manager_account_id,
    budget_hours: source.budget_hours,
    budget_amount: source.budget_amount,
    billing_rate: source.billing_rate,
    status: "active",
    template_id: source.id,
    copy_tasks: false,
  });
}

/* ── Stages ───────────────────────────────────────── */

export async function fetchStages(projectId: string): Promise<ProjectStage[]> {
  return (await api<{ stages: ProjectStage[] }>(`/api/projects/${projectId}/stages`)).stages ?? [];
}

export async function createStage(projectId: string, body: { name: string; color?: string | null; sort_order?: number; is_closed?: boolean; is_default_new?: boolean }): Promise<ProjectStage> {
  return (await send<{ stage: ProjectStage }>(`/api/projects/${projectId}/stages`, "POST", body)).stage;
}

export async function updateStage(id: string, patch: Partial<ProjectStage>): Promise<ProjectStage> {
  return (await send<{ stage: ProjectStage }>(`/api/projects/stages/${id}`, "PATCH", patch)).stage;
}

export async function deleteStage(id: string): Promise<void> {
  await send(`/api/projects/stages/${id}`, "DELETE");
}

/* ── Tasks ────────────────────────────────────────── */

export async function fetchTasks(params: {
  project_id?: string;
  parent_task_id?: string;
  mine?: boolean;
  status?: TaskStatus | "all";
  priority?: TaskPriority;
  stage_id?: string;
  search?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  assignee?: string;
  tag?: string;
  due_lte?: string;
  limit?: number;
} = {}): Promise<TaskRow[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") {
      if (v) q.set(k, "1");
    } else q.set(k, String(v));
  });
  /* Throws on failure so screens can tell an error from an empty list. */
  const { tasks } = await cachedGet<{ tasks: TaskRow[] }>(`/api/projects/tasks?${q.toString()}`, 0);
  return tasks ?? [];
}

export async function createTask(body: Partial<TaskRow> & { project_id: string; title: string }): Promise<TaskRow> {
  return (await send<{ task: TaskRow }>("/api/projects/tasks", "POST", body)).task;
}

export async function updateTask(id: string, patch: Partial<TaskRow>): Promise<TaskRow> {
  return (await send<{ task: TaskRow }>(`/api/projects/tasks/${id}`, "PATCH", patch)).task;
}

export async function deleteTask(id: string): Promise<void> {
  await send(`/api/projects/tasks/${id}`, "DELETE");
}

export type BulkTaskAction =
  | { action: "stage"; value: string | null }
  | { action: "status"; value: TaskStatus }
  | { action: "assign"; value: string | null }
  | { action: "due"; value: string | null }
  | { action: "priority"; value: TaskPriority }
  | { action: "delete"; value?: undefined };

/** One request for a multi-select action (server applies access + the
 *  stage⇄status rules per task; all-or-nothing). */
export async function bulkTasks(taskIds: string[], op: BulkTaskAction): Promise<void> {
  await send("/api/projects/tasks/bulk", "POST", { task_ids: taskIds, ...op });
}

/* ── Saved filters (per user, accounts.preferences) ── */

export interface SavedTaskFilter {
  id: string;
  name: string;
  /** Where it was saved: My Tasks, All Tasks, or a project board. */
  scope: "mine" | "all" | "project";
  assignee: string | null;
  tag: string | null;
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  search: string;
  overdue: boolean;
}

export async function fetchSavedFilters(): Promise<SavedTaskFilter[]> {
  return (await api<{ filters: SavedTaskFilter[] }>("/api/projects/saved-filters")).filters ?? [];
}

export async function saveSavedFilters(filters: SavedTaskFilter[]): Promise<SavedTaskFilter[]> {
  return (await send<{ filters: SavedTaskFilter[] }>("/api/projects/saved-filters", "PUT", { filters })).filters ?? [];
}

/** One board drop → one request. `orderedIds` is the whole target column
 *  after the drop (including the moved card). */
export async function reorderTasks(body: {
  project_id: string;
  stage_id: string | null;
  ordered_ids: string[];
  moved_id: string;
}): Promise<{ moved: { id: string; stage_id: string | null; status: TaskStatus } }> {
  return send("/api/projects/tasks/reorder", "POST", body);
}

/* ── Tags ─────────────────────────────────────────── */

export async function fetchTags(): Promise<ProjectTag[]> {
  const { tags } = await cachedGet<{ tags: ProjectTag[] }>(
    "/api/projects/tags", 0,
  ).catch(() => ({ tags: [] as ProjectTag[] }));
  return tags ?? [];
}

/** Tags for the editors — throws, unlike the lenient fetchTags. */
export async function fetchTagsStrict(): Promise<ProjectTag[]> {
  return (await api<{ tags: ProjectTag[] }>("/api/projects/tags")).tags ?? [];
}

export async function createTag(body: { name: string; color?: string | null }): Promise<ProjectTag> {
  return (await send<{ tag: ProjectTag }>("/api/projects/tags", "POST", body)).tag;
}

export async function updateTag(id: string, patch: Partial<ProjectTag>): Promise<ProjectTag> {
  return (await send<{ tag: ProjectTag }>(`/api/projects/tags/${id}`, "PATCH", patch)).tag;
}

export async function deleteTag(id: string): Promise<void> {
  await send(`/api/projects/tags/${id}`, "DELETE");
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
  invoiced_invoice_id?: string | null;
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

/* Comments */
export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  return (await api<{ comments: TaskComment[] }>(`/api/projects/tasks/${taskId}/comments`)).comments ?? [];
}
export async function createComment(taskId: string, body: string): Promise<TaskComment> {
  return (await send<{ comment: TaskComment }>(`/api/projects/tasks/${taskId}/comments`, "POST", { body })).comment;
}
export async function deleteComment(taskId: string, id: string): Promise<void> {
  await send(`/api/projects/tasks/${taskId}/comments/${id}`, "DELETE");
}

/* Checklist */
export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  return (await api<{ items: ChecklistItem[] }>(`/api/projects/tasks/${taskId}/checklist`)).items ?? [];
}
export async function createChecklistItem(taskId: string, title: string): Promise<ChecklistItem> {
  return (await send<{ item: ChecklistItem }>(`/api/projects/tasks/${taskId}/checklist`, "POST", { title })).item;
}
export async function updateChecklistItem(taskId: string, id: string, patch: Partial<ChecklistItem>): Promise<void> {
  await send(`/api/projects/tasks/${taskId}/checklist/${id}`, "PATCH", patch);
}
export async function deleteChecklistItem(taskId: string, id: string): Promise<void> {
  await send(`/api/projects/tasks/${taskId}/checklist/${id}`, "DELETE");
}

/* Milestones */
export async function fetchMilestones(projectId: string): Promise<Milestone[]> {
  return (await api<{ milestones: Milestone[] }>(`/api/projects/${projectId}/milestones`)).milestones ?? [];
}
export async function createMilestone(projectId: string, body: Partial<Milestone> & { name: string }): Promise<Milestone> {
  return (await send<{ milestone: Milestone }>(`/api/projects/${projectId}/milestones`, "POST", body)).milestone;
}
export async function updateMilestone(projectId: string, id: string, patch: Partial<Milestone>): Promise<void> {
  await send(`/api/projects/${projectId}/milestones/${id}`, "PATCH", patch);
}
export async function deleteMilestone(projectId: string, id: string): Promise<void> {
  await send(`/api/projects/${projectId}/milestones/${id}`, "DELETE");
}

/* Time entries — each write returns the task's recomputed logged_hours. */
export async function fetchTimeEntries(taskId: string): Promise<TimeEntry[]> {
  return (await api<{ entries: TimeEntry[] }>(`/api/projects/tasks/${taskId}/time`)).entries ?? [];
}
export async function createTimeEntry(taskId: string, body: { minutes: number; entry_date?: string; note?: string }): Promise<TimeEntry> {
  return (await send<{ entry: TimeEntry }>(`/api/projects/tasks/${taskId}/time`, "POST", body)).entry;
}
export async function deleteTimeEntry(taskId: string, id: string): Promise<void> {
  await send(`/api/projects/tasks/${taskId}/time/${id}`, "DELETE");
}

/* Attachments */
export async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  return (await api<{ attachments: TaskAttachment[] }>(`/api/projects/tasks/${taskId}/attachments`)).attachments ?? [];
}
export async function uploadAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  return (await api<{ attachment: TaskAttachment }>(`/api/projects/tasks/${taskId}/attachments`, { method: "POST", body: fd })).attachment;
}
export async function deleteAttachment(taskId: string, id: string): Promise<void> {
  await send(`/api/projects/tasks/${taskId}/attachments/${id}`, "DELETE");
}

/* ── Accounts (assignee / manager pickers) ────────── */

export interface AccountLite {
  id: string;
  username: string;
  full_name: string | null;
  name_alt: string | null;
}

/** Display label for a picker option: real name first, native name beside it. */
export function accountLabel(a: AccountLite): string {
  const name = a.full_name || a.username;
  return a.name_alt ? `${name} · ${a.name_alt}` : name;
}

let _accountsCache: AccountLite[] | null = null;
export async function fetchAccounts(): Promise<AccountLite[]> {
  if (_accountsCache) return _accountsCache;
  const res = await fetch("/api/projects/members", { credentials: "include" });
  if (!res.ok) return [];
  const { members } = (await res.json()) as {
    members: { account_id: string; username: string; full_name: string | null; name_alt: string | null }[];
  };
  const list = (members ?? []).map((m) => ({
    id: m.account_id,
    username: m.username,
    full_name: m.full_name,
    name_alt: m.name_alt,
  }));
  _accountsCache = list;
  return list;
}

/* ── Dates ────────────────────────────────────────────
   Task and milestone dates are calendar DAYS ("2026-09-25"), not instants.
   `new Date("2026-09-25")` parses that as UTC midnight, which west of UTC
   is the PREVIOUS local day — a task due today showed as "Yesterday" and
   overdue. Parse the parts as a LOCAL date instead. Display is D/M/Y
   (owner standing rule). */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-09-25" (or an ISO timestamp) → local-midnight Date, or null. */
export function parseLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local Date → "YYYY-MM-DD". */
export function toISODay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "YYYY-MM-DD" shifted by `n` calendar days (DST-safe: local noon math). */
export function addDaysISO(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  if (!d) return iso;
  d.setHours(12);
  d.setDate(d.getDate() + n);
  return toISODay(d);
}

/** Whole calendar days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da || !db) return 0;
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}

/** Today's LOCAL calendar day as "YYYY-MM-DD". */
export function todayLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "25/09/2026" — the one D/M/Y formatter for the Projects app. Accepts a
 *  day key or a full timestamp (timestamps render in local time). */
export function formatDMY(iso: string | null | undefined, opts: { short?: boolean } = {}): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseLocalDate(iso) : new Date(iso);
  if (!d || Number.isNaN(d.getTime())) return "";
  const dm = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  if (opts.short && d.getFullYear() === new Date().getFullYear()) return dm;
  return `${dm}/${d.getFullYear()}`;
}

export function formatDueDate(
  iso: string | null,
  lang: string = "en",
  labels?: { today: string; tomorrow: string; yesterday: string },
): string {
  const target = parseLocalDate(iso);
  if (!target) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return labels?.today ?? "Today";
  if (diff === 1) return labels?.tomorrow ?? "Tomorrow";
  if (diff === -1) return labels?.yesterday ?? "Yesterday";
  if (diff > 1 && diff <= 6) {
    const loc = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB";
    return target.toLocaleDateString(loc, { weekday: "long" });
  }
  return formatDMY(iso, { short: true });
}

export function isOverdue(iso: string | null): boolean {
  const d = parseLocalDate(iso);
  if (!d) return false;
  const now = new Date();
  return d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Deep link that opens a project board, optionally with a task open. */
export function projectLink(projectId: string, taskId?: string | null): string {
  return taskId ? `/projects?project=${projectId}&task=${taskId}` : `/projects?project=${projectId}`;
}
