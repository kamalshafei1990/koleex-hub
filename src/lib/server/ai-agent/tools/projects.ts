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
import type { ToolDef, ToolResult } from "../types";

const PROJECTS_MODULE = "Projects";

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
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load your projects right now." };
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
  { mine?: boolean; status?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listProjectTasks",
  description:
    "List project tasks visible to the current user (tasks they're assigned to, created, or that live in a project they manage/created). Use for 'my project tasks', 'what's assigned to me on projects', 'open tasks in my projects'. Set mine=true to restrict to tasks assigned to the user only.",
  parameters: {
    type: "object",
    properties: {
      mine: { type: "boolean", description: "If true, only tasks assigned to the current user. Default false (all visible)." },
      status: { type: "string", description: "Optional task status filter (e.g. 'todo', 'in_progress', 'done')." },
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

    const { data, error } = await q
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.error("[tool.listProjectTasks]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load project tasks right now." };
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

export const projectTools: ToolDef[] = [
  listMyProjects as ToolDef,
  listProjectTasks as ToolDef,
];
