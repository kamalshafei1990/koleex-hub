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

import { NextResponse } from "next/server";
import { supabaseServer } from "../../supabase-server";
import { recomputeProjectProgress } from "../../project-progress";
import { checkDateOrder, loadStages, reconcileStageStatus, validateTaskWrite } from "../../project-task-rules";
import { assertProjectAccess, canManageProject, involvedProjectsOr, memberRole, ownsTask, type MemberRole } from "../../project-access";
import { pruneProjectChatSeats, syncProjectMembersFromAssignees, upsertProjectMembers } from "../../project-members";
import { notifyTaskAssigned } from "../../project-notify";
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
  stage_id: string | null;
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
    .select("id, project_id, title, description, priority, status, stage_id, due_date, assignee_account_id, created_by_account_id")
    .eq("id", id)
    .eq("tenant_id", ctx.auth.tenant_id)
    .maybeSingle();
  const t = (data as TaskRow | null) ?? null;
  if (!t) return null;
  if (ctx.isSuperAdmin) return t;
  /* Own task (assignee / creator): editable even with view-only project
     access — the shared per-task rule (project-access.ts ownsTask). */
  if (ownsTask(ctx.auth, t)) return t;
  if (t.project_id) {
    const { data: proj } = await supabaseServer
      .from("projects")
      .select("id")
      .eq("tenant_id", ctx.auth.tenant_id)
      .eq("id", t.project_id)
      .or(`manager_account_id.eq.${ctx.auth.account_id},created_by_account_id.eq.${ctx.auth.account_id}`)
      .maybeSingle();
    if (proj) return t;
    /* A project member (any role but viewer) reaches its tasks too —
       the same rule assertTaskAccess applies with { write: true }. */
    const role = await memberRole({ account_id: ctx.auth.account_id, tenant_id: ctx.auth.tenant_id, is_super_admin: false }, t.project_id);
    if (role === "manager" || role === "member") return t;
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
      /* manager / creator / project member / task assignee — the list
         route's exact scope (project-access.ts). */
      q = q.or(await involvedProjectsOr(tenantId, accountId));
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

/* ── Create project task (with confirm) ──
   Goes through the SAME validators as POST /api/projects/tasks:
   validateTaskWrite (enums, real dates, assignee in the tenant),
   checkDateOrder (start ≤ due), reconcileStageStatus (default stage), and
   the project write gate (viewers cannot add tasks). */
type AccessCtx = { auth: { account_id: string; tenant_id: string }; isSuperAdmin: boolean };
const accessAuth = (ctx: AccessCtx) => ({ account_id: ctx.auth.account_id, tenant_id: ctx.auth.tenant_id, is_super_admin: ctx.isSuperAdmin });

/** "me", an account uuid, or a username → account id in the tenant. */
async function resolveAccount(ctx: AccessCtx, raw: unknown): Promise<string | null | undefined> {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const v = String(raw).trim();
  if (v.toLowerCase() === "me") return ctx.auth.account_id;
  if (v.toLowerCase() === "none" || v.toLowerCase() === "unassigned") return null;
  if (isUuid(v)) return v;
  const { data } = await supabaseServer
    .from("accounts").select("id").eq("tenant_id", ctx.auth.tenant_id).ilike("username", v.replace(/[%_\\]/g, "\\$&")).limit(2);
  const rows = (data ?? []) as { id: string }[];
  return rows.length === 1 ? rows[0].id : "";
}

const createProjectTask: ToolDef<
  {
    project_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    start_date?: string;
    due_date?: string;
    assignee?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createProjectTask",
  description:
    "Create a NEW task inside a project. You MUST have a real project_id first — call listMyProjects to find it if the user names a project. Optional start_date / due_date (YYYY-MM-DD; start must be on or before due) and assignee ('me' — the default —, 'none', an account id, or an exact username). ALWAYS call this WITHOUT confirm to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "The id of the project to add the task to (required — resolve via listMyProjects)." },
      title: { type: "string", description: "The task title (required)." },
      description: { type: "string", description: "Optional description." },
      priority: { type: "string", description: "low | normal | high | urgent. Default normal.", enum: ["low", "normal", "high", "urgent"] },
      start_date: { type: "string", description: "Optional start day, YYYY-MM-DD." },
      due_date: { type: "string", description: "Optional due day, YYYY-MM-DD." },
      assignee: { type: "string", description: "Who does it: 'me' (default), 'none', an account id, or an exact username." },
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
    if (!isUuid(projectId)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };
    if (!title) return { ok: false, permissionStatus: "allowed", data: null, message: "What should the task be called?" };

    /* The app's own write gate: visible AND not a view-only member. */
    const gate = await assertProjectAccess(accessAuth(ctx), projectId, { write: true });
    if (gate instanceof NextResponse) {
      return { ok: false, permissionStatus: "allowed", data: null, message: gate.status === 403 ? "You can view that project but not add tasks to it." : "I can't find that project among the ones you can access." };
    }
    const { data: proj } = await supabaseServer.from("projects").select("name").eq("tenant_id", ctx.auth.tenant_id).eq("id", projectId).maybeSingle();
    const projectName = (proj as { name: string } | null)?.name ?? "project";

    const assignee = await resolveAccount(ctx, args.assignee);
    if (assignee === "") return { ok: false, permissionStatus: "allowed", data: null, message: `I couldn't match "${args.assignee}" to exactly one person — give me their exact username.` };

    const stages = await loadStages(ctx.auth.tenant_id, projectId);
    const body: Record<string, unknown> = {
      title,
      description: args.description ? String(args.description) : null,
      priority: args.priority ? String(args.priority) : "normal",
      assignee_account_id: assignee === undefined ? ctx.auth.account_id : assignee,
    };
    if (args.start_date) body.start_date = String(args.start_date).trim();
    if (args.due_date) body.due_date = String(args.due_date).trim();
    const checked = await validateTaskWrite({
      tenantId: ctx.auth.tenant_id,
      projectId,
      taskId: null,
      body,
      allowed: ["title", "description", "priority", "start_date", "due_date", "assignee_account_id"],
      stages,
    });
    if ("error" in checked) return { ok: false, permissionStatus: "allowed", data: null, message: `That task isn't valid: ${checked.error}.` };
    const dateErr = checkDateOrder(null, checked.patch);
    if (dateErr) return { ok: false, permissionStatus: "allowed", data: null, message: `${dateErr}.` };
    const fields = checked.patch;
    const who = (fields.assignee_account_id as string | null) ?? null;

    if (args.confirm !== true) {
      const parts = [`priority ${fields.priority ?? "normal"}`];
      if (fields.start_date) parts.push(`starts ${fields.start_date}`);
      if (fields.due_date) parts.push(`due ${fields.due_date}`);
      const whoText = who === ctx.auth.account_id ? "assigned to you" : who ? "assigned as requested" : "unassigned";
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { project_id: projectId, project: projectName, ...fields } },
        message: `Ready to add this task to "${projectName}": "${title}" (${parts.join(", ")}), ${whoText}. Confirm and I'll create it.`,
        pendingAction: { tool: "createProjectTask", args: { ...args, project_id: projectId, confirm: true } },
      };
    }

    const row = reconcileStageStatus(null, { ...fields, stage_id: stages.find((s) => s.is_default_new)?.id ?? null }, stages);
    const { data, error } = await supabaseServer
      .from("project_tasks")
      .insert({
        followers_account_ids: [],
        tag_ids: [],
        blocked_by_task_ids: [],
        ...row,
        tenant_id: ctx.auth.tenant_id,
        project_id: projectId,
        parent_task_id: null,
        created_by_account_id: ctx.auth.account_id,
      })
      .select("id, project_id, title, status, priority, start_date, due_date, assignee_account_id, created_at")
      .single();

    if (error) {
      console.error("[tool.createProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the project task — please try again." };
    }
    // Same side effects as the route: progress, assignment notice, membership.
    await recomputeProjectProgress(ctx.auth.tenant_id, projectId);
    const created = data as { id: string; title: string; project_id: string; due_date: string | null; assignee_account_id: string | null };
    if (who) {
      await notifyTaskAssigned(ctx.auth, created);
      await syncProjectMembersFromAssignees(ctx.auth, projectId, [who]);
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: data as Record<string, unknown>,
      message: `Added "${title}" to project "${projectName}".`,
      sources: ["project_tasks(insert)"],
    };
  },
};

/* ── Add a member to a project (with confirm) ──
   Same rules as POST /api/projects/[id]/members: the caller must manage the
   project (super admin, manager, creator, or member with role manager).
   New members also join the project's Discuss chat. */
const addProjectMember: ToolDef<
  { project_id?: string; account?: string; role?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "addProjectMember",
  description:
    "Add a person to a project's members (or change their role). Resolve project_id via listMyProjects first. account is an account id or exact username. role: manager | member (default) | viewer (read-only). ALWAYS call first WITHOUT confirm to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "The project's id (from listMyProjects)." },
      account: { type: "string", description: "Account id or exact username of the person to add." },
      role: { type: "string", description: "manager | member | viewer. Default member.", enum: ["manager", "member", "viewer"] },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: ["project_id", "account"],
  },
  requiredModule: PROJECTS_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const projectId = String(args.project_id ?? "").trim();
    if (!isUuid(projectId)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };
    const role = (["manager", "member", "viewer"].includes(String(args.role)) ? String(args.role) : "member") as MemberRole;

    const auth = accessAuth(ctx);
    const gate = await assertProjectAccess(auth, projectId, { write: true });
    if (gate instanceof NextResponse) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that project among the ones you can manage." };
    if (!(await canManageProject(auth, gate))) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Only the project's managers can add members." };
    }
    const accountId = await resolveAccount(ctx, args.account);
    if (!accountId) return { ok: false, permissionStatus: "allowed", data: null, message: `I couldn't match "${args.account ?? ""}" to exactly one person — give me their exact username.` };
    const { data: acct } = await supabaseServer.from("accounts").select("id, username").eq("tenant_id", ctx.auth.tenant_id).eq("id", accountId).maybeSingle();
    if (!acct) return { ok: false, permissionStatus: "allowed", data: null, message: "That person isn't in this workspace." };
    const username = (acct as { username: string }).username;
    const { data: proj } = await supabaseServer.from("projects").select("name").eq("tenant_id", ctx.auth.tenant_id).eq("id", projectId).maybeSingle();
    const projectName = (proj as { name: string } | null)?.name ?? "project";

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { project_id: projectId, project: projectName, account_id: accountId, username, role } },
        message: `Ready to add @${username} to "${projectName}" as ${role}. Confirm?`,
        pendingAction: { tool: "addProjectMember", args: { project_id: projectId, account: accountId, role, confirm: true } },
      };
    }
    const res = await upsertProjectMembers(ctx.auth, projectId, [{ account_id: accountId, role }]);
    if ("error" in res) return { ok: false, permissionStatus: "allowed", data: null, message: res.error };
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { project_id: projectId, account_id: accountId, role, added: res.added.length > 0 },
      message: res.added.length > 0 ? `Added @${username} to "${projectName}" as ${role}.` : `@${username} is now ${role} on "${projectName}".`,
      sources: ["project_members(upsert)"],
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
       means "open" (there is no todo/in_progress at the DB level). The
       stage follows the status exactly as in the PATCH route: done moves
       the card into the first closed stage, reopening moves it out. */
    const stages = t.project_id ? await loadStages(ctx.auth.tenant_id, t.project_id) : [];
    const patch = reconcileStageStatus(
      { status: t.status ?? "open", stage_id: t.stage_id ?? null },
      { status: done ? "done" : "open" },
      stages,
    );
    const { error } = await supabaseServer
      .from("project_tasks")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.completeProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
    }
    await recomputeProjectProgress(ctx.auth.tenant_id, t.project_id);
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

    /* Subtasks cascade with it — their assignees, like this task's, may
       lose their last way into the project (and so its chat seat). */
    const { data: subs } = await supabaseServer
      .from("project_tasks")
      .select("assignee_account_id")
      .eq("tenant_id", ctx.auth.tenant_id)
      .eq("parent_task_id", id);
    const lostAssignees = [t.assignee_account_id, ...((subs ?? []) as { assignee_account_id: string | null }[]).map((r) => r.assignee_account_id)]
      .filter((a): a is string => !!a);

    const { error } = await supabaseServer
      .from("project_tasks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ctx.auth.tenant_id);
    if (error) {
      console.error("[tool.deleteProjectTask]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't delete the task — please try again." };
    }
    await recomputeProjectProgress(ctx.auth.tenant_id, t.project_id);
    if (t.project_id) {
      const pid = t.project_id;
      await pruneProjectChatSeats(ctx.auth.tenant_id, lostAssignees.map((account_id) => ({ project_id: pid, account_id })));
    }
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
  addProjectMember as ToolDef,
  completeProjectTask as ToolDef,
  updateProjectTask as ToolDef,
  deleteProjectTask as ToolDef,
];
