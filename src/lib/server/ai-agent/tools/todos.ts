import "server-only";

/* ---------------------------------------------------------------------------
   To-do tools — agent-facing READ operations on koleex_todos.

   Security: this ports the EXACT per-user visibility scope from
   src/app/api/todos/route.ts GET so the AI can never surface a task the
   caller couldn't see in the To-do app itself. A non-super-admin sees only
   tasks they created, assigned, are assigned to, observe, that target their
   department, or that are broadcast to all — plus the private-task overlay.
   Super-admins skip the scope (tenant filter still applies).

   Phase 1 is read-only. Money/rate fields don't exist on todos, so no
   sensitive-field stripping is needed; we still select a conservative,
   operational column set.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";

const TODO_MODULE = "To-do";

/* Operational columns only — no internal blobs, no attachments payloads. */
const TODO_COLS = `id, title, description, status, completed, completed_at,
  priority, label, due_date, start_date, remind_at, recurrence,
  assigned_department, assign_to_all, is_private, created_by_account_id,
  created_at, updated_at`;

/** Day boundaries in ISO for simple due filters. Server runtime (not the
 *  workflow sandbox) so Date is available. */
function todayRangeISO(): { startOfToday: string; endOfToday: string; endOfWeek: string } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const week = new Date(now); week.setDate(week.getDate() + 7); week.setHours(23, 59, 59, 999);
  return { startOfToday: start.toISOString(), endOfToday: end.toISOString(), endOfWeek: week.toISOString() };
}

const listMyTodos: ToolDef<
  { filter?: string; due?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyTodos",
  description:
    "List the current user's to-do tasks (from the To-do app), already scoped to what THEY are allowed to see. Use for questions like 'what are my tasks', 'what's due today', 'my open to-dos', 'overdue tasks'. Returns only this user's visible tasks — never anyone else's private work.",
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: "Which tasks: 'open' (not done, default), 'done', or 'all'.",
        enum: ["open", "done", "all"],
      },
      due: {
        type: "string",
        description:
          "Optional due filter. Default 'any' — use 'any' for general questions like 'what tasks do I have', 'what's on my plate', or even 'what do I have today' (an active task with NO due date is still something the user has, so 'any' surfaces it). Only use 'today' when the user explicitly asks what is DUE today (it excludes undated tasks); 'overdue' for past-due; 'week' for the next 7 days.",
        enum: ["any", "overdue", "today", "week"],
      },
      limit: { type: "integer", description: "Max rows. Default 20, cap 50." },
    },
    required: [],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);
    const filter = String(args.filter ?? "open");
    const due = String(args.due ?? "any");

    let q = supabaseServer.from("koleex_todos").select(TODO_COLS).eq("tenant_id", tenantId);

    /* ── Port of the route's non-SA visibility scope ── */
    if (!ctx.isSuperAdmin) {
      // Tasks the caller is an assignee of.
      const { data: asg } = await supabaseServer
        .from("koleex_todo_assignees")
        .select("todo_id")
        .eq("account_id", accountId);
      const assigneeIds = (asg ?? []).map((r) => (r as { todo_id: string }).todo_id);

      // Tasks the caller observes (metadata.observers jsonb containment).
      const { data: obs } = await supabaseServer
        .from("koleex_todos")
        .select("id")
        .contains("metadata", { observers: [{ account_id: accountId }] })
        .eq("tenant_id", tenantId);
      const observerIds = (obs ?? []).map((r) => (r as { id: string }).id);

      const orParts = [
        `created_by_account_id.eq.${accountId}`,
        `assigned_by_account_id.eq.${accountId}`,
        `assign_to_all.eq.true`,
      ];
      if (ctx.department) orParts.push(`assigned_department.eq.${ctx.department}`);
      const ids = [...new Set([...assigneeIds, ...observerIds])];
      if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
      q = q.or(orParts.join(","));

      // Private-task overlay: hide others' private tasks unless break-glass.
      if (!ctx.canViewPrivate) {
        q = q.or(`is_private.eq.false,created_by_account_id.eq.${accountId}`);
      }
    }

    /* ── Convenience filters ── */
    if (filter === "open") q = q.eq("completed", false);
    else if (filter === "done") q = q.eq("completed", true);

    if (due !== "any") {
      const { endOfToday, endOfWeek } = todayRangeISO();
      const nowISO = new Date().toISOString();
      if (due === "overdue") q = q.lt("due_date", nowISO).eq("completed", false);
      else if (due === "today") q = q.gte("due_date", nowISO.slice(0, 10)).lte("due_date", endOfToday);
      else if (due === "week") q = q.gte("due_date", nowISO).lte("due_date", endOfWeek);
    }

    const { data, error } = await q
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error("[tool.listMyTodos]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load your tasks right now." };
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length
        ? `You have ${rows.length} matching to-do task(s).`
        : "No matching to-do tasks.",
      sources: [`koleex_todos(scope=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

/* ── Create (with confirm) ──
   Two-phase by design: the FIRST call (no confirm) returns a preview and
   writes NOTHING; only a second call with confirm:true actually inserts.
   The orchestrator prompt instructs the model to preview → get the user's
   explicit yes → then call again with confirm:true. The dispatcher's
   module guard (requiredAction:"create") already enforced can_create before
   we got here, so a user who can't create tasks can't create via AI. */
const createTodo: ToolDef<
  {
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    label?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createTodo",
  description:
    "Create a NEW personal to-do task for the current user. ALWAYS call this first WITHOUT confirm to preview what will be created; show the user the details and only call again with confirm:true after they explicitly agree. Creates the task as the user's own (assigned to them). It cannot assign tasks to other people yet.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The task title (required)." },
      description: { type: "string", description: "Optional longer description." },
      priority: { type: "string", description: "low | medium | high. Default medium.", enum: ["low", "medium", "high"] },
      due_date: { type: "string", description: "Optional ISO date/datetime the task is due." },
      label: { type: "string", description: "Optional short label/category." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user has explicitly confirmed the previewed task." },
    },
    required: ["title"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const title = String(args.title ?? "").trim();
    if (!title) {
      return { ok: false, permissionStatus: "denied", data: null, message: "What should the task be called? Give me a title." };
    }
    const priority = ["low", "medium", "high"].includes(String(args.priority)) ? String(args.priority) : "medium";
    const normalized = {
      title,
      description: args.description ? String(args.description) : null,
      priority,
      due_date: args.due_date ? String(args.due_date) : null,
      label: args.label ? String(args.label) : null,
    };

    // Phase 1: preview only — nothing is written.
    if (args.confirm !== true) {
      const due = normalized.due_date ? ` · due ${normalized.due_date}` : "";
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: normalized },
        message: `Ready to create this to-do for you: "${title}" (priority ${priority}${due}). Confirm and I'll add it.`,
        pendingAction: { tool: "createTodo", args: { ...normalized, confirm: true } },
      };
    }

    // Phase 2: confirmed — insert exactly like /api/todos POST (personal task).
    const { data, error } = await supabaseServer
      .from("koleex_todos")
      .insert({
        title: normalized.title,
        metadata: {},
        description: normalized.description,
        completed: false,
        completed_at: null,
        status: "todo",
        priority: normalized.priority,
        label: normalized.label,
        due_date: normalized.due_date,
        start_date: null,
        remind_at: null,
        recurrence: null,
        recurrence_until: null,
        created_by_account_id: ctx.auth.account_id,
        assigned_by_account_id: ctx.auth.account_id,
        source: "koleex-ai",
        source_id: null,
        assigned_department: null,
        assign_to_all: false,
        is_private: false,
        tenant_id: ctx.auth.tenant_id,
      })
      .select("id, title, status, priority, due_date, created_at")
      .single();

    if (error) {
      console.error("[tool.createTodo]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't create the task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: data as Record<string, unknown>,
      message: `Created the to-do "${title}". You'll find it in your To-do app.`,
      sources: ["koleex_todos(insert)"],
    };
  },
};

export const todoTools: ToolDef[] = [listMyTodos as ToolDef, createTodo as ToolDef];
