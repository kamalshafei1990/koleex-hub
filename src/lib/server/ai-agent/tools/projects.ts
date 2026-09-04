import "server-only";

/* ---------------------------------------------------------------------------
   Projects tools — agent-facing READ operations on projects + project_tasks.

   Security: ports the EXACT non-super-admin scope from
   src/app/api/projects/route.ts GET and
   src/app/api/projects/tasks/route.ts GET, so the AI only ever returns
   projects the caller manages/created/has a task in, and tasks the caller
   is assigned to / created / that live in a project they manage or created.

   Phase 1 is read-only. Money fields (budget_amount, billing_rate) are
   intentionally NOT selected — the AI answering "what are my projects/tasks"
   never needs rates, and the safest way not to leak a field is to not fetch it.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { recomputeProjectProgress } from "../../project-progress";
import type { ToolDef, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";

const PROJECTS_MODULE = "Projects";

/* Loads a task the CALLER CAN SEE, or null. The app's PATCH/DELETE routes
   gate on the module action + tenant only (projects are collaborative),
   but the agent holds itself to the stricter read scope: a task is
   mutable via AI only if listProjectTasks would have shown it (assignee /
   creator / in a project the caller manages or created; SA skips). */
interface TaskRow {
  id: string;
  project_id: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  assignee_account_id: string | null;
  created_by_account_id: string | null;
}

async function loadVisibleTask(
  ctx: { auth: { account_id: string; tenant_id: string }; isSuperAdmin: boolean },
  id: string,
): Promise<TaskRow | null> {
  const { data } = await supabaseServer
    .from("project_tasks")
    .select("id, project_id, title, description, priority, status, due_date, assignee_account_id, created_by_account_id")
    .eq("id", id)
    .eq("tenant_id", ctx.auth.tenant_id)
    .maybeSingle();
  const t = (data as TaskRow | null) ?? null;
  if (!t) return null;
  if (ctx.isSuperAdmin) return t;
  if (t.assignee_account_id === ctx.auth.account_id) return t;
  if (t.created_by_account_id === ctx.auth.account_id) return t;
  if (t.project_id) {
    const { data: proj } = await supabaseServer
      .from("projects")
      .select("id")
      .eq("tenant_id", ctx.auth.tenant_id)
      .eq("id", t.project_id)
      .or(`manager_account_id.eq.${ctx.auth.account_id},created_by_account_id.eq.${ctx.auth.account_id}`)
      .maybeSingle();
    if (proj) return t;
  }
  return null;
}

const PROJECT_COLS = `id, name, code, description, status, is_template,
  is_favorite, planned_start, planned_end, progress_pct, created_at, updated_at`;

const TASK_COLS = `id, project_id, title, description, priority,
  assignee_account_id, due_date, start_date, progress_pct, status,
  closed_at, created_at, updated_at`;

const listMyProjects: ToolDef<
  { status?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyProjects",
  description:
    "List the projects the current user is involved in (manages, created, or has an assigned task in), scoped to what they're allowed to see. Use for 'my projects', 'what projects am I on', 'active projects'. Not for tasks — use listProjectTasks for those.",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional project status filter (e.g. 'active', 'on_hold', 'completed')." },
      limit: { type: "integer", description: "Max rows. Default 20, cap 50." },
    },
    required: [],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);

    let q = supabaseServer
      .from("projects")
      .select(PROJECT_COLS)
      .eq("tenant_id", tenantId)
      .eq("is_template", false);

    if (!ctx.isSuperAdmin) {
      const { data: myTaskProjects } = await supabaseServer
        .from("project_tasks")
        .select("project_id")
        .eq("tenant_id", tenantId)
        .eq("assignee_account_id", accountId);
      const ids = [...new Set((myTaskProjects ?? []).map((r) => (r as { project_id: string }).project_id))];
      const orParts = [
        `manager_account_id.eq.${accountId}`,
        `created_by_account_id.eq.${accountId}`,
      ];
      if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
      q = q.or(orParts.join(","));
    }

    if (args.status) q = q.eq("status", String(args.status));

    const { data, error } = await q.order("updated_at", { ascending: false }).limit(limit);
    if (error) {
      console.error("[tool.listMyProjects]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load your projects right now." };
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length ? `You're involved in ${rows.length} project(s).` : "No matching projects.",
      sources: [`projects(scope=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

const listProjectTasks: ToolDef<
  { mine?: boolean; status?: string; q?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listProjectTasks",
  description:
    "List project tasks visible to the current user (tasks they're assigned to, created, or that live in a project they manage/created). Use for 'my project tasks', 'what's assigned to me on projects', 'open tasks in my projects'. Set mine=true to restrict to tasks assigned to the user only. When resolving a SPECIFIC task by name, pass q with words from its title — the plain list is capped.",
  parameters: {
    type: "object",
    properties: {
      mine: { type: "boolean", description: "If true, only tasks assigned to the current user. Default false (all visible)." },
      status: { type: "string", description: "Optional task status filter — one of 'open', 'done', 'cancelled'." },
      q: { type: "string", description: "Title search (case-insensitive contains). Use when looking for a specific task by name." },
      limit: { type: "integer", description: "Max rows. Default 20, cap 50." },
    },
    required: [],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);

    let q = supabaseServer.from("project_tasks").select(TASK_COLS).eq("tenant_id", tenantId);

    if (args.mine === true) {
      // Explicit narrow — only tasks assigned to me (still within scope).
      q = q.eq("assignee_account_id", accountId);
    } else if (!ctx.isSuperAdmin) {
      const { data: myProjects } = await supabaseServer
        .from("projects")
        .select("id")
        .eq("tenant_id", tenantId)
        .or(`manager_account_id.eq.${accountId},created_by_account_id.eq.${accountId}`);
      const pids = (myProjects ?? []).map((r) => (r as { id: string }).id);
      const orParts = [
        `assignee_account_id.eq.${accountId}`,
        `created_by_account_id.eq.${accountId}`,
      ];
      if (pids.length > 0) orParts.push(`project_id.in.(${pids.join(",")})`);
      q = q.or(orParts.join(","));
    }

    if (args.status) q = q.eq("status", String(args.status));
    const titleQuery = typeof args.q === "string" ? args.q.trim() : "";
    if (titleQuery) {
      q = q.ilike("title", `%${titleQuery.replace(/[%_\\]/g, "\\$&")}%`);
    }

    const { data, error } = await q
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.error("[tool.listProjectTasks]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load project tasks right now." };
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length ? `Found ${rows.length} project task(s).` : "No matching project tasks.",
      sources: [`project_tasks(scope=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

/* ── Create project task (with confirm) ── */
const createProjectTask: ToolDef<
  {
    project_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createProjectTask",
  description:
    "Create a NEW task inside a project, assigned to the current user. You MUST have a real project_id first — call listMyProjects to find it if the user names a project. ALWAYS call this WITHOUT confirm to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "The id of the project to add the task to (required — resolve via listMyProjects)." },
      title: { type: "string", description: "The task title (required)." },
      description: { type: "string", description: "Optional description." },
      priority: { type: "string", description: "low | normal | high. Default normal.", enum: ["low", "normal", "high"] },
      due_date: { type: "string", description: "Optional ISO due date." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["project_id", "title"],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const projectId = String(args.project_id ?? "").trim();
    const title = String(args.title ?? "").trim();
    if (!projectId) return { ok: false, permissionStatus: "allowed", data: null, message: "Which project should the task go in? I can list your projects." };
    if (!title) return { ok: false, permissionStatus: "allowed", data: null, message: "What should the task be called?" };
    const priority = ["low", "normal", "high"].includes(String(args.priority)) ? String(args.priority) : "normal";

    // Verify the project is visible to this user (same scope as listMyProjects
    // read), so the AI can't drop a task into a project they can't see.
    let projQ = supabaseServer.from("projects").select("id, name").eq("tenant_id", ctx.auth.tenant_id).eq("id", projectId);
    if (!ctx.isSuperAdmin) {
      const { data: myTaskProjects } = await supabaseServer
        .from("project_tasks").select("project_id").eq("tenant_id", ctx.auth.tenant_id).eq("assignee_account_id", ctx.auth.account_id);
      const ids = [...new Set((myTaskProjects ?? []).map((r) => (r as { project_id: string }).project_id))];
      const orParts = [`manager_account_id.eq.${ctx.auth.account_id}`, `created_by_account_id.eq.${ctx.auth.account_id}`];
      if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
      projQ = projQ.or(orParts.join(","));
    }
    const { data: proj } = await projQ.maybeSingle();
    if (!proj) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that project among the ones you can access." };
    const projectName = (proj as { name: string }).name;

    const normalized = {
      project_id: projectId,
      title,
      description: args.description ? String(args.description) : null,
      priority,
      due_date: args.due_date ? String(args.due_date) : null,
    };

    if (args.confirm !== true) {
      const due = normalized.due_date ? ` · due ${normalized.due_date}` : "";
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { ...normalized, project: projectName } },
        message: `Ready to add this task to "${projectName}": "${title}" (priority ${priority}${due}), assigned to you. Confirm and I'll create it.`,
        pendingAction: { tool: "createProjectTask", args: { ...normalized, confirm: true } },
      };
    }

    // Default stage = the project's is_default_new stage (as the route does).
    const { data: stage } = await supabaseServer
      .from("project_stages").select("id")
      .eq("tenant_id", ctx.auth.tenant_id).eq("project_id", projectId).eq("is_default_new", true).maybeSingle();

    const { data, error } = await supabaseServer
      .from("project_tasks")
      .insert({
        tenant_id: ctx.auth.tenant_id,
        project_id: projectId,
        stage_id: (stage as { id: string } | null)?.id ?? null,
        parent_task_id: null,
        title: normalized.title,
        description: normalized.description,
        priority: normalized.priority,
        assignee_account_id: ctx.auth.account_id,
        followers_account_ids: [],
        tag_ids: [],
        blocked_by_task_ids: [],
        due_date: normalized.due_date,
        start_date: null,
        estimated_hours: null,
        linked_planning_item_id: null,
        linked_entity_type: null,
        linked_entity_id: null,
        linked_entity_label: null,
        created_by_account_id: ctx.auth.account_id,
      })
      .select("id, project_id, title, status, priority, due_date, created_at")
      .single();

    if (error) {
      console.error("[tool.createProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the project task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: data as Record<string, unknown>,
      message: `Added "${title}" to project "${projectName}", assigned to you.`,
      sources: ["project_tasks(insert)"],
    };
  },
};

/* ── Complete / reopen a project task (with confirm) ──
   Ports the PATCH route's done-transition side effects verbatim:
   status→done stamps closed_at + progress 100; leaving done clears
   closed_at; project progress is recomputed after the write. */
const completeProjectTask: ToolDef<
  { task_id?: string; done?: boolean; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "completeProjectTask",
  description:
    "Mark a project task as done — or reopen it (done:false). Resolve the task id via listProjectTasks FIRST (match by title; if several match, ask which one) — never invent an id. ALWAYS call first WITHOUT confirm to preview which task will change; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listProjectTasks result." },
      done: { type: "boolean", description: "true = mark done (default); false = reopen." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listProjectTasks first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };
    const done = args.done !== false;

    const t = await loadVisibleTask(ctx, id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task among the ones you can access — pick it again from listProjectTasks." };

    const title = t.title ?? "Task";
    if (done && t.status === "done") {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, status: "done" }, message: `"${title}" is already done.` };
    }
    if (!done && t.status !== "done") {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, status: t.status }, message: `"${title}" is already open (status: ${t.status ?? "todo"}).` };
    }

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, action: done ? "mark_done" : "reopen" } },
        message: done ? `Ready to mark the project task "${title}" as done. Confirm?` : `Ready to reopen the project task "${title}". Confirm?`,
        pendingAction: { tool: "completeProjectTask", args: { task_id: t.id, done, confirm: true } },
      };
    }

    /* project_tasks_status_check allows open|done|cancelled — reopen
       means "open" (there is no todo/in_progress at the DB level). */
    const patch: Record<string, unknown> = done
      ? { status: "done", closed_at: new Date().toISOString(), progress_pct: 100 }
      : { status: "open", closed_at: null };
    const { error } = await supabaseServer
      .from("project_tasks")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.completeProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
    }
    void recomputeProjectProgress(ctx.auth.tenant_id, t.project_id);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, title, status: done ? "done" : "open" },
      message: done ? `Done — project task "${title}" is marked complete.` : `Reopened "${title}" (status: open).`,
      sources: ["project_tasks(update)"],
    };
  },
};

/* ── Edit a project task's details (with confirm) ── */
const updateProjectTask: ToolDef<
  {
    task_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "updateProjectTask",
  description:
    "Update details of a project task: title, description, priority, or due date. Resolve the task id via listProjectTasks FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview the change; only call again with confirm:true after the user explicitly agrees. Pass ONLY the fields being changed. To clear the due date, pass \"none\". For marking done/reopening use completeProjectTask instead.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listProjectTasks result." },
      title: { type: "string", description: "New title." },
      description: { type: "string", description: "New description." },
      priority: { type: "string", description: "New priority.", enum: ["low", "normal", "high"] },
      due_date: { type: "string", description: "New ISO due date, or \"none\" to clear it." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listProjectTasks first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const t = await loadVisibleTask(ctx, id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task among the ones you can access — pick it again from listProjectTasks." };

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.description === "string") changes.description = args.description;
    if (["low", "normal", "high"].includes(String(args.priority))) changes.priority = String(args.priority);
    if (typeof args.due_date === "string" && args.due_date.trim()) {
      changes.due_date = args.due_date.trim().toLowerCase() === "none" ? null : args.due_date.trim();
    }
    if (Object.keys(changes).length === 0) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Nothing to change — tell me what to update (title, description, priority, or due date)." };
    }

    const title = t.title ?? "Task";
    if (args.confirm !== true) {
      const parts = Object.entries(changes).map(([k, v]) => `${k.replace("_", " ")} → ${v === null ? "(cleared)" : String(v)}`);
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, changes } },
        message: `Ready to update the project task "${title}": ${parts.join(", ")}. Confirm?`,
        pendingAction: { tool: "updateProjectTask", args: { ...args, task_id: t.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer
      .from("project_tasks")
      .update(changes)
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.updateProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, updated: Object.keys(changes) },
      message: `Updated "${typeof changes.title === "string" ? changes.title : title}".`,
      sources: ["project_tasks(update)"],
    };
  },
};

/* ── Delete a project task (with confirm) ── */
const deleteProjectTask: ToolDef<
  { task_id?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "deleteProjectTask",
  description:
    "PERMANENTLY delete a project task. Resolve the task id via listProjectTasks FIRST — never invent an id. ALWAYS call first WITHOUT confirm to preview exactly which task will be deleted; only call again with confirm:true after the user explicitly agrees. This cannot be undone.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listProjectTasks result." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed deleting the previewed task." },
    },
    required: ["task_id"],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "delete",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listProjectTasks first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const t = await loadVisibleTask(ctx, id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task among the ones you can access — pick it again from listProjectTasks." };

    const title = t.title ?? "Task";
    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, action: "delete" } },
        message: `This will PERMANENTLY delete the project task "${title}" — it cannot be undone. Confirm?`,
        pendingAction: { tool: "deleteProjectTask", args: { task_id: t.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer
      .from("project_tasks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.deleteProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't delete the task — please try again." };
    }
    void recomputeProjectProgress(ctx.auth.tenant_id, t.project_id);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, title, deleted: true },
      message: `Deleted the project task "${title}".`,
      sources: ["project_tasks(delete)"],
    };
  },
};

export const projectTools: ToolDef[] = [
  listMyProjects as ToolDef,
  listProjectTasks as ToolDef,
  createProjectTask as ToolDef,
  completeProjectTask as ToolDef,
  updateProjectTask as ToolDef,
  deleteProjectTask as ToolDef,
];
