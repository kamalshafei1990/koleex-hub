import "server-only";

/* ---------------------------------------------------------------------------
   project-task-rules — the server's single opinion on what a task write may
   contain and what it implies.

   1. validateTaskWrite — enums, dates, numbers, and that every referenced id
      (stage, parent, blockers, assignee, followers, tags) belongs to the SAME
      project / tenant. The old PATCH copied any whitelisted key straight
      into the row, so a stage from another project or a free-text priority
      landed unchecked.

   2. reconcileStageStatus — stage and status used to be two independent
      facts that disagreed constantly (a "done" task in "To Do", an "open"
      task in "Done"). Now they are kept in step on EVERY write path (form
      PATCH, board drag/reorder, AI completeProjectTask, create):
        · moved into a closed stage       ⇒ status done
        · moved out to an open stage while done ⇒ status open
        · status set to done              ⇒ first closed stage (if any)
        · reopened from done in a closed stage ⇒ first open stage
      When BOTH changed in one write, the explicit status wins and the stage
      follows it only if they would otherwise disagree.
      closed_at / progress_pct are stamped as before.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { UUID_RE } from "@/lib/server/project-access";

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TASK_STATUSES = ["open", "done", "cancelled"] as const;

export interface StageLite {
  id: string;
  sort_order: number;
  is_closed: boolean;
  is_default_new: boolean;
}

export async function loadStages(tenantId: string, projectId: string): Promise<StageLite[]> {
  const { data } = await supabaseServer
    .from("project_stages")
    .select("id, sort_order, is_closed, is_default_new")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as StageLite[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
function uuidList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every(isUuid)) return null;
  return [...new Set(v as string[])];
}

type Fail = { error: string };

/** Validate + normalise a create/update body. `taskId` is null on create.
 *  Only keys present in `body` (from `allowed`) are validated and returned. */
export async function validateTaskWrite(opts: {
  tenantId: string;
  projectId: string;
  taskId: string | null;
  body: Record<string, unknown>;
  allowed: readonly string[];
  stages: StageLite[];
}): Promise<{ patch: Record<string, unknown> } | Fail> {
  const { tenantId, projectId, taskId, body, allowed, stages } = opts;
  const patch: Record<string, unknown> = {};
  const has = (k: string) => allowed.includes(k) && k in body;

  if (has("title")) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (!t) return { error: "Title required" };
    patch.title = t.slice(0, 500);
  }
  if (has("description")) {
    if (body.description !== null && typeof body.description !== "string") return { error: "Invalid description" };
    patch.description = body.description ? String(body.description).slice(0, 20000) : null;
  }
  if (has("priority")) {
    if (!TASK_PRIORITIES.includes(body.priority as (typeof TASK_PRIORITIES)[number])) return { error: "Invalid priority" };
    patch.priority = body.priority;
  }
  if (has("status")) {
    if (!TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) return { error: "Invalid status" };
    patch.status = body.status;
  }
  for (const k of ["due_date", "start_date"] as const) {
    if (!has(k)) continue;
    const v = body[k];
    if (v === null || v === "") patch[k] = null;
    else if (isDate(v)) patch[k] = v;
    else return { error: `Invalid ${k}` };
  }
  if (has("estimated_hours")) {
    const v = body.estimated_hours;
    if (v === null || v === "") patch.estimated_hours = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: "Invalid estimated_hours" };
      patch.estimated_hours = n;
    }
  }
  if (has("progress_pct")) {
    const n = Number(body.progress_pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Invalid progress_pct" };
    patch.progress_pct = Math.round(n);
  }
  if (has("sort_order")) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || Math.abs(n) > 1_000_000) return { error: "Invalid sort_order" };
    patch.sort_order = n;
  }
  if (has("stage_id")) {
    const v = body.stage_id;
    if (v === null || v === "") patch.stage_id = null;
    else if (isUuid(v) && stages.some((s) => s.id === v)) patch.stage_id = v;
    else return { error: "Invalid stage" };
  }
  if (has("linked_planning_item_id")) {
    const v = body.linked_planning_item_id;
    if (v === null || v === "") patch.linked_planning_item_id = null;
    else if (isUuid(v)) patch.linked_planning_item_id = v;
    else return { error: "Invalid planning item" };
  }
  if (has("linked_entity_type")) {
    const v = body.linked_entity_type;
    if (v === null || v === "") patch.linked_entity_type = null;
    else if (typeof v === "string" && /^[a-z_]{1,40}$/.test(v)) patch.linked_entity_type = v;
    else return { error: "Invalid linked entity type" };
  }
  if (has("linked_entity_id")) {
    const v = body.linked_entity_id;
    if (v === null || v === "") patch.linked_entity_id = null;
    else if (isUuid(v)) patch.linked_entity_id = v;
    else return { error: "Invalid linked entity" };
  }
  if (has("linked_entity_label")) {
    const v = body.linked_entity_label;
    if (v !== null && typeof v !== "string") return { error: "Invalid linked entity label" };
    patch.linked_entity_label = v ? String(v).slice(0, 200) : null;
  }

  /* ── References that must live in this project / tenant ── */
  const taskRefs: string[] = [];
  if (has("parent_task_id")) {
    const v = body.parent_task_id;
    if (v === null || v === "") patch.parent_task_id = null;
    else if (isUuid(v) && v !== taskId) { patch.parent_task_id = v; taskRefs.push(v); }
    else return { error: "Invalid parent task" };
  }
  if (has("blocked_by_task_ids")) {
    const list = uuidList(body.blocked_by_task_ids ?? []);
    if (!list) return { error: "Invalid blocked_by_task_ids" };
    const clean = list.filter((x) => x !== taskId);
    patch.blocked_by_task_ids = clean;
    taskRefs.push(...clean);
  }
  if (taskRefs.length > 0) {
    const uniq = [...new Set(taskRefs)];
    const { data } = await supabaseServer
      .from("project_tasks")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .in("id", uniq);
    if ((data ?? []).length !== uniq.length) return { error: "Referenced task is not in this project" };
  }

  const accountRefs: string[] = [];
  if (has("assignee_account_id")) {
    const v = body.assignee_account_id;
    if (v === null || v === "") patch.assignee_account_id = null;
    else if (isUuid(v)) { patch.assignee_account_id = v; accountRefs.push(v); }
    else return { error: "Invalid assignee" };
  }
  if (has("followers_account_ids")) {
    const list = uuidList(body.followers_account_ids ?? []);
    if (!list) return { error: "Invalid followers" };
    patch.followers_account_ids = list;
    accountRefs.push(...list);
  }
  if (accountRefs.length > 0) {
    const uniq = [...new Set(accountRefs)];
    const { data } = await supabaseServer
      .from("accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("id", uniq);
    if ((data ?? []).length !== uniq.length) return { error: "Assignee is not in this workspace" };
  }

  if (has("tag_ids")) {
    const list = uuidList(body.tag_ids ?? []);
    if (!list) return { error: "Invalid tags" };
    if (list.length > 0) {
      const { data } = await supabaseServer
        .from("project_tags")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("id", list);
      if ((data ?? []).length !== list.length) return { error: "Unknown tag" };
    }
    patch.tag_ids = list;
  }

  return { patch };
}

/** Bring stage_id and status into agreement (see header). Mutates + returns
 *  `patch`. `prev` is null on create. */
export function reconcileStageStatus(
  prev: { status: string; stage_id: string | null } | null,
  patch: Record<string, unknown>,
  stages: StageLite[],
): Record<string, unknown> {
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const byId = new Map(sorted.map((s) => [s.id, s]));
  const firstClosed = sorted.find((s) => s.is_closed) ?? null;
  const firstOpen = sorted.find((s) => !s.is_closed) ?? null;

  const prevStatus = prev?.status ?? "open";
  const prevStage = prev?.stage_id ?? null;
  let status = "status" in patch ? String(patch.status) : prevStatus;
  let stageId = "stage_id" in patch ? (patch.stage_id as string | null) : prevStage;

  const stageChanged = "stage_id" in patch && stageId !== prevStage;
  const statusChanged = "status" in patch && status !== prevStatus;

  if (statusChanged) {
    /* Explicit status wins; the stage follows only if they would disagree. */
    const cur = stageId ? byId.get(stageId) : undefined;
    if (status === "done" && !cur?.is_closed && firstClosed) stageId = firstClosed.id;
    if (status === "open" && prevStatus === "done" && cur?.is_closed && firstOpen) stageId = firstOpen.id;
  } else if (stageChanged) {
    const st = stageId ? byId.get(stageId) : undefined;
    if (st?.is_closed && status !== "cancelled") status = "done";
    else if (st && !st.is_closed && status === "done") status = "open";
  } else if (!prev) {
    /* Create with neither changed relative to defaults — still honour a
       closed initial stage. */
    const st = stageId ? byId.get(stageId) : undefined;
    if (st?.is_closed && status === "open") status = "done";
  }

  if (stageId !== prevStage || "stage_id" in patch) patch.stage_id = stageId;
  if (status !== prevStatus || "status" in patch) patch.status = status;

  if (status === "done" && prevStatus !== "done") {
    patch.closed_at = new Date().toISOString();
    patch.progress_pct = 100;
  } else if (status !== "done" && "status" in patch) {
    patch.closed_at = null;
  }
  return patch;
}

/** A task may not start after it is due. `prev` supplies the stored values
 *  for a partial PATCH (null on create). Returns an error message or null. */
export function checkDateOrder(
  prev: { start_date: string | null; due_date: string | null } | null,
  patch: Record<string, unknown>,
): string | null {
  const start = ("start_date" in patch ? patch.start_date : prev?.start_date) as string | null | undefined;
  const due = ("due_date" in patch ? patch.due_date : prev?.due_date) as string | null | undefined;
  if (start && due && start > due) return "Start date must be on or before the due date";
  return null;
}
