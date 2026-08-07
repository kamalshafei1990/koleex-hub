import "server-only";

/* ---------------------------------------------------------------------------
   To-do tools — agent-facing operations on koleex_todos.

   Security: every tool ports the EXACT rules of the owning route so the AI
   can never do more than the caller could in the To-do app itself:
   - listMyTodos       ← /api/todos GET visibility scope (creator / assigner /
                          assignee / observer / department / broadcast, plus
                          the private-task overlay; SA skips row scope).
   - createTodo        ← /api/todos POST (personal task, with confirm).
   - completeTodo      ← /api/todos/[id]/toggle (owners flip; participants
                          submit for the assigner's approval, with confirm).
   - updateTodo        ← /api/todos/[id] PATCH owner rules (with confirm).
   - deleteTodo        ← /api/todos/[id] DELETE owner rules (with confirm).
   Every mutation is two-phase: first call previews and writes NOTHING;
   only a second call with confirm:true executes.

   Money/rate fields don't exist on todos, so no sensitive-field stripping
   is needed; we still select a conservative, operational column set.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { sendPushToAccounts } from "../../web-push";
import type { ToolDef, ToolResult } from "../types";

const TODO_MODULE = "To-do";

/* Ownership row loaded before any mutation — the same columns the
   /api/todos/[id] routes read to decide owner vs participant. */
interface TodoRow {
  id: string;
  tenant_id: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  due_date: string | null;
  label: string | null;
  completed: boolean;
  approval_state: string | null;
  created_by_account_id: string | null;
  assigned_by_account_id: string | null;
  metadata: { observers?: Array<{ account_id?: string }> } | null;
}

async function loadTodoRow(id: string, tenantId: string | null): Promise<TodoRow | null> {
  let q = supabaseServer
    .from("koleex_todos")
    .select(
      "id, tenant_id, title, description, priority, due_date, label, completed, approval_state, created_by_account_id, assigned_by_account_id, metadata",
    )
    .eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return (data as TodoRow | null) ?? null;
}

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

/* ── Complete / reopen (with confirm) ──
   Ports /api/todos/[id]/toggle verbatim, expressed as intent (done true/false)
   instead of a blind flip: owners (SA / creator / assigner) change the state
   directly; a participant (assignee / observer) marking a delegated task done
   SUBMITS it for the assigner's approval — the server-enforced approval loop —
   and done:false while pending withdraws the submission. Same "create" gate
   as the toggle route (completing your own work is part of normal usage). */
const completeTodo: ToolDef<
  { task_id?: string; done?: boolean; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "completeTodo",
  description:
    "Mark one of the user's to-do tasks as done, or reopen it (done:false). Resolve the task id via listMyTodos FIRST (match by title; if several match, ask which one) — never invent an id. ALWAYS call first WITHOUT confirm to preview exactly which task will change; only call again with confirm:true after the user explicitly agrees. If the task was delegated to the user by someone else, marking it done submits it for the assigner's approval instead of closing it outright (same rule as the To-do app).",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listMyTodos result." },
      done: { type: "boolean", description: "true = mark done (default); false = reopen / withdraw an approval submission." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which task? Pick it from listMyTodos first." };
    const done = args.done !== false;

    const [t, { data: assignee }] = await Promise.all([
      loadTodoRow(id, ctx.auth.tenant_id),
      supabaseServer
        .from("koleex_todo_assignees")
        .select("todo_id")
        .eq("todo_id", id)
        .eq("account_id", ctx.auth.account_id)
        .maybeSingle(),
    ]);
    if (!t) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that task — pick it again from listMyTodos." };

    const acc = ctx.auth.account_id;
    const isOwner = ctx.isSuperAdmin || t.created_by_account_id === acc || t.assigned_by_account_id === acc;
    const isObserver =
      Array.isArray(t.metadata?.observers) &&
      (t.metadata?.observers ?? []).some((o) => o?.account_id === acc);
    if (!isOwner && !assignee && !isObserver) {
      return { ok: false, permissionStatus: "denied", data: null, message: "That task isn't yours to update." };
    }

    const title = t.title ?? "Task";
    /* Participant path exists only while the task is open and not yet
       approved — identical condition to the toggle route. */
    const participantFlow = !isOwner && !t.completed && t.approval_state !== "approved";

    /* Intent-based no-ops (the route is a flip; the agent gets intent). */
    if (done && t.completed) {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, completed: true }, message: `"${title}" is already done.` };
    }
    if (done && participantFlow && t.approval_state === "pending") {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, approval: "pending" }, message: `"${title}" is already submitted and waiting for the assigner's approval.` };
    }
    if (!done && !t.completed && t.approval_state !== "pending") {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, completed: false }, message: `"${title}" is already open.` };
    }

    const willSubmit = participantFlow && done;
    const willWithdraw = participantFlow && !done && t.approval_state === "pending";
    const action = willSubmit
      ? "submit_for_approval"
      : willWithdraw
        ? "withdraw_submission"
        : done
          ? "mark_done"
          : "reopen";

    if (args.confirm !== true) {
      const msg = willSubmit
        ? `"${title}" was assigned to you by someone else — marking it done will SUBMIT it for the assigner's approval. Confirm?`
        : willWithdraw
          ? `Ready to withdraw the approval request for "${title}" (it stays open). Confirm?`
          : done
            ? `Ready to mark "${title}" as done. Confirm?`
            : `Ready to reopen "${title}". Confirm?`;
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, action } },
        message: msg,
        pendingAction: { tool: "completeTodo", args: { task_id: t.id, done, confirm: true } },
      };
    }

    const now = new Date().toISOString();

    if (willSubmit || willWithdraw) {
      const { error } = await supabaseServer
        .from("koleex_todos")
        .update({ approval_state: willWithdraw ? null : "pending", updated_at: now })
        .eq("id", id);
      if (error) {
        console.error("[tool.completeTodo]", error);
        return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the task — please try again." };
      }
      if (willSubmit && t.assigned_by_account_id && t.assigned_by_account_id !== acc) {
        await supabaseServer.from("inbox_messages").insert({
          recipient_account_id: t.assigned_by_account_id,
          sender_account_id: acc,
          category: "task",
          subject: `Awaiting your approval: ${title}`,
          body: `The task "${title}" was submitted as done and needs your confirmation.`,
          link: `/todo?task=${t.id}`,
          metadata: { type: "todo_approval_request", todo_id: t.id },
        });
        await sendPushToAccounts([t.assigned_by_account_id], {
          title: "Task awaiting your approval",
          body: title,
          url: `/todo?task=${t.id}`,
        });
      }
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { id: t.id, title, approval: willWithdraw ? null : "pending" },
        message: willWithdraw
          ? `Withdrawn — "${title}" is no longer awaiting approval.`
          : `Submitted — "${title}" now waits for the assigner to confirm it's done.`,
        sources: ["koleex_todos(update)"],
      };
    }

    const { error } = await supabaseServer
      .from("koleex_todos")
      .update({
        completed: done,
        completed_at: done ? now : null,
        status: done ? "done" : "todo",
        approval_state: done ? (t.approval_state === "pending" ? "approved" : t.approval_state) : null,
        updated_at: now,
      })
      .eq("id", id);
    if (error) {
      console.error("[tool.completeTodo]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, title, completed: done },
      message: done ? `Done — "${title}" is marked complete.` : `Reopened "${title}".`,
      sources: ["koleex_todos(update)"],
    };
  },
};

/* ── Edit details (with confirm) ──
   Owner-only, matching /api/todos/[id] PATCH: participants may only move a
   task's situation (that's completeTodo); title/dates/priority stay with the
   owner (SA / creator / assigner). Only whitelisted fields are ever written. */
const updateTodo: ToolDef<
  {
    task_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    label?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "updateTodo",
  description:
    "Update details of one of the user's own to-do tasks: title, description, priority, due date, or label. Resolve the task id via listMyTodos FIRST — never invent an id. Only the task's owner (its creator or assigner) can edit details; assignees should use completeTodo instead. ALWAYS call first WITHOUT confirm to preview the change; only call again with confirm:true after the user explicitly agrees. Pass ONLY the fields being changed. To clear the due date or label, pass the literal string \"none\".",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listMyTodos result." },
      title: { type: "string", description: "New title." },
      description: { type: "string", description: "New description." },
      priority: { type: "string", description: "New priority.", enum: ["low", "medium", "high"] },
      due_date: { type: "string", description: "New ISO due date/datetime, or \"none\" to clear it." },
      label: { type: "string", description: "New short label, or \"none\" to clear it." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which task? Pick it from listMyTodos first." };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that task — pick it again from listMyTodos." };

    const acc = ctx.auth.account_id;
    const isOwner = ctx.isSuperAdmin || t.created_by_account_id === acc || t.assigned_by_account_id === acc;
    if (!isOwner) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Only the task's owner (its creator or assigner) can change its details. You can still mark it done — that submits it for their approval.",
      };
    }

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.description === "string") changes.description = args.description;
    if (["low", "medium", "high"].includes(String(args.priority))) changes.priority = String(args.priority);
    if (typeof args.due_date === "string" && args.due_date.trim()) {
      changes.due_date = args.due_date.trim().toLowerCase() === "none" ? null : args.due_date.trim();
    }
    if (typeof args.label === "string" && args.label.trim()) {
      changes.label = args.label.trim().toLowerCase() === "none" ? null : args.label.trim();
    }
    if (Object.keys(changes).length === 0) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Nothing to change — tell me what to update (title, description, priority, due date, or label)." };
    }

    const title = t.title ?? "Task";
    if (args.confirm !== true) {
      const parts = Object.entries(changes).map(([k, v]) => `${k.replace("_", " ")} → ${v === null ? "(cleared)" : String(v)}`);
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: {
          preview: {
            task_id: t.id,
            title,
            current: { title: t.title, description: t.description, priority: t.priority, due_date: t.due_date, label: t.label },
            changes,
          },
        },
        message: `Ready to update "${title}": ${parts.join(", ")}. Confirm?`,
        pendingAction: { tool: "updateTodo", args: { ...args, task_id: t.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer
      .from("koleex_todos")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[tool.updateTodo]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, updated: Object.keys(changes) },
      message: `Updated "${typeof changes.title === "string" ? changes.title : title}".`,
      sources: ["koleex_todos(update)"],
    };
  },
};

/* ── Delete (with confirm) ──
   Ports /api/todos/[id] DELETE: SA / creator / assigner only. Deletion is
   permanent (assignees/notes cascade) — the preview says so explicitly. */
const deleteTodo: ToolDef<
  { task_id?: string; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "deleteTodo",
  description:
    "PERMANENTLY delete one of the user's own to-do tasks. Resolve the task id via listMyTodos FIRST — never invent an id. Only the task's owner (its creator or assigner) can delete it. ALWAYS call first WITHOUT confirm to preview exactly which task will be deleted; only call again with confirm:true after the user explicitly agrees. This cannot be undone.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listMyTodos result." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed deleting the previewed task." },
    },
    required: ["task_id"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "delete",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which task? Pick it from listMyTodos first." };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that task — pick it again from listMyTodos." };

    const acc = ctx.auth.account_id;
    const canDelete = ctx.isSuperAdmin || t.created_by_account_id === acc || t.assigned_by_account_id === acc;
    if (!canDelete) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Only the task's owner (its creator or assigner) can delete it." };
    }

    const title = t.title ?? "Task";
    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, action: "delete" } },
        message: `This will PERMANENTLY delete the task "${title}" — it cannot be undone. Confirm?`,
        pendingAction: { tool: "deleteTodo", args: { task_id: t.id, confirm: true } },
      };
    }

    const { error } = await supabaseServer.from("koleex_todos").delete().eq("id", id);
    if (error) {
      console.error("[tool.deleteTodo]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't delete the task — please try again." };
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, title, deleted: true },
      message: `Deleted "${title}".`,
      sources: ["koleex_todos(delete)"],
    };
  },
};

export const todoTools: ToolDef[] = [
  listMyTodos as ToolDef,
  createTodo as ToolDef,
  completeTodo as ToolDef,
  updateTodo as ToolDef,
  deleteTodo as ToolDef,
];
