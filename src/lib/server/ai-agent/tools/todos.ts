import "server-only";

/* ---------------------------------------------------------------------------
   To-do tools — agent-facing operations on koleex_todos.

   Security: every tool ports the EXACT rules of the owning route so the AI
   can never do more than the caller could in the To-do app itself:
   - listMyTodos       ← /api/todos GET visibility scope (creator / assigner /
                          assignee / observer / department / broadcast, plus
                          the private-task overlay; SA skips row scope).
   - findTeamMember    ← /api/todos/assignees (assignable employees =
                          internal + active + human; read-only lookup).
   - createTodo        ← /api/todos POST (personal or assigned-to-colleagues
                          task incl. assignee rows + inbox fan-out, with
                          confirm; assignee ids must resolve against the
                          assignable-employees list = INTERNAL ONLY).
   - completeTodo      ← /api/todos/[id]/toggle (owners flip; participants
                          submit for the assigner's approval, with confirm).
   - updateTodo        ← /api/todos/[id] PATCH owner rules (with confirm).
   - reassignTodo      ← /api/todos/[id] PATCH newAssigneeIds path (owner
                          resync + internal-only + notify newly added).
   - deleteTodo        ← /api/todos/[id] DELETE owner rules (with confirm).
   Every mutation is two-phase: first call previews and writes NOTHING;
   only a second call with confirm:true executes.

   Money/rate fields don't exist on todos, so no sensitive-field stripping
   is needed; we still select a conservative, operational column set.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { sendPushToAccounts } from "../../web-push";
import { listAssignableEmployees } from "../../assignable-employees";
import type { ToolDef, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";

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
  { filter?: string; due?: string; q?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyTodos",
  description:
    "List the current user's to-do tasks (from the To-do app), already scoped to what THEY are allowed to see. Use for questions like 'what are my tasks', 'what's due today', 'my open to-dos', 'overdue tasks'. When resolving a SPECIFIC task by name (to complete/update/delete/reassign it), ALWAYS pass q with a couple of words from its title — the plain list is capped and a matching task can sit beyond the cap. Returns only this user's visible tasks — never anyone else's private work.",
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
      q: { type: "string", description: "Title search (case-insensitive contains). Use when looking for a specific task by name." },
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
    const titleQuery = typeof args.q === "string" ? args.q.trim() : "";

    let q = supabaseServer.from("koleex_todos").select(TODO_COLS).eq("tenant_id", tenantId);

    /* Title resolution — without this, a specific task can sit past the
       row cap and the model wrongly concludes it doesn't exist (observed
       live 2026-08-08 right after a successful create). Escaped ilike. */
    if (titleQuery) {
      q = q.ilike("title", `%${titleQuery.replace(/[%_\\]/g, "\\$&")}%`);
    }

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

/* ── Find a colleague to assign to ──
   Same source as every "pick a person" control in the apps:
   listAssignableEmployees — internal + active + human accounts only, so a
   customer/portal login can never be resolved as an assignee. Read-only;
   gated like the app's own /api/todos/assignees endpoint. */
const findTeamMember: ToolDef<
  { query?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "findTeamMember",
  description:
    "Find a colleague (an internal Koleex employee) by name or username, returning their account_id, full name, native name, department and position. Use this BEFORE createTodo with assign_to_account_ids when the user wants to assign a task to someone. If several people match the name, show them to the user and ask which one — never pick for them. Internal employees only; customers can never be assigned.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The person's name (any part — full, native, or username)." },
      limit: { type: "integer", description: "Max matches. Default 6, cap 10." },
    },
    required: ["query"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "view",
  minRole: "internal",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const query = String(args.query ?? "").trim().toLowerCase();
    if (!query) return { ok: false, permissionStatus: "denied", data: null, message: "Whose name should I look up?" };
    const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 10);

    let all;
    try {
      all = await listAssignableEmployees(ctx.auth.tenant_id);
    } catch (e) {
      console.error("[tool.findTeamMember]", e instanceof Error ? e.message : e);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't search the team right now." };
    }

    const matches = all
      .filter((a) =>
        [a.full_name, a.name_alt, a.username]
          .some((n) => typeof n === "string" && n.toLowerCase().includes(query)),
      )
      .slice(0, limit)
      .map((a) => ({
        account_id: a.account_id,
        full_name: a.full_name,
        name_alt: a.name_alt,
        username: a.username,
        department: a.department,
        position: a.position,
      }));

    return {
      ok: true,
      permissionStatus: "allowed",
      data: matches,
      message: matches.length
        ? `Found ${matches.length} team member(s) matching "${args.query}".`
        : `No team member matches "${args.query}". Check the spelling or try another part of the name.`,
      sources: ["accounts(assignable employees)"],
    };
  },
};

/* ── Create (with confirm) ──
   Two-phase by design: the FIRST call (no confirm) returns a preview and
   writes NOTHING; only a second call with confirm:true actually inserts.
   The orchestrator prompt instructs the model to preview → get the user's
   explicit yes → then call again with confirm:true. The dispatcher's
   module guard (requiredAction:"create") already enforced can_create before
   we got here, so a user who can't create tasks can't create via AI.
   Assignment to colleagues mirrors /api/todos POST: assignee rows in
   koleex_todo_assignees + the same inbox "New task" fan-out; every id must
   resolve against the assignable-employees list (internal/active/human),
   which is the server-side INTERNAL-ONLY rule the route enforces. */
const createTodo: ToolDef<
  {
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    label?: string;
    assign_to_account_ids?: string[];
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createTodo",
  description:
    "Create a NEW to-do task — personal by default, or ASSIGNED TO COLLEAGUES by passing assign_to_account_ids (resolve each person with findTeamMember first; if a name matches several people, ask the user which one before calling this). ALWAYS call this first WITHOUT confirm to preview what will be created; show the user the details — including WHO it will be assigned to — and only call again with confirm:true after they explicitly agree. Assigned colleagues are notified automatically.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The task title (required)." },
      description: { type: "string", description: "Optional longer description." },
      priority: { type: "string", description: "low | medium | high. Default medium.", enum: ["low", "medium", "high"] },
      due_date: { type: "string", description: "Optional ISO date/datetime the task is due." },
      label: { type: "string", description: "Optional short label/category." },
      assign_to_account_ids: {
        type: "array",
        items: { type: "string" },
        description: "Account ids of colleagues to assign this task to — each id MUST come from a findTeamMember result in this conversation. Omit for a personal task.",
      },
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

    /* Resolve requested assignees against the assignable-employees list —
       the same internal/active/human source every app picker uses. An id
       that isn't on that list (hallucinated, or a portal account) is a
       hard error, never silently dropped. */
    const requestedIds = Array.isArray(args.assign_to_account_ids)
      ? Array.from(new Set(args.assign_to_account_ids.map((v) => String(v).trim()).filter(Boolean)))
      : [];
    let assignees: Array<{ account_id: string; name: string }> = [];
    if (requestedIds.length > 0) {
      let all;
      try {
        all = await listAssignableEmployees(ctx.auth.tenant_id);
      } catch (e) {
        console.error("[tool.createTodo.assignees]", e instanceof Error ? e.message : e);
        return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't verify the assignees right now — please try again." };
      }
      const byId = new Map(all.map((a) => [a.account_id, a]));
      const unknown = requestedIds.filter((id) => !byId.has(id));
      if (unknown.length > 0) {
        return {
          ok: false,
          permissionStatus: "denied",
          data: null,
          message: "One or more assignees didn't match a real team member. Look each person up with findTeamMember and use the account_id it returns.",
        };
      }
      assignees = requestedIds.map((id) => {
        const a = byId.get(id)!;
        return { account_id: id, name: a.full_name || a.username };
      });
    }
    const assigneeNames = assignees.map((a) => a.name).join(", ");

    // Phase 1: preview only — nothing is written.
    if (args.confirm !== true) {
      const due = normalized.due_date ? ` · due ${normalized.due_date}` : "";
      const who = assignees.length > 0 ? ` assigned to ${assigneeNames}` : " for you";
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { ...normalized, assignees } },
        message: `Ready to create this to-do${who}: "${title}" (priority ${priority}${due}). Confirm and I'll add it${assignees.length > 0 ? " and notify them" : ""}.`,
        pendingAction: {
          tool: "createTodo",
          args: {
            ...normalized,
            ...(requestedIds.length > 0 ? { assign_to_account_ids: requestedIds } : {}),
            confirm: true,
          },
        },
      };
    }

    // Phase 2: confirmed — insert exactly like /api/todos POST (personal task).
    const { data, error } = await supabaseServer
      .from("koleex_todos")
      .insert({
        title: normalized.title,
        /* AI provenance lives in metadata: the `source` column has a CHECK
           constraint (manual|crm|calendar) — 'koleex-ai' violates it and
           silently failed every confirmed create until 2026-08-08. */
        metadata: { created_via: "koleex-ai" },
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
        source: "manual",
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

    /* Assignment fan-out — mirrors /api/todos POST: assignee rows, then an
       inbox "New task" notification to every assignee except the creator. */
    if (assignees.length > 0) {
      const todoId = (data as { id: string }).id;
      const { error: asgErr } = await supabaseServer.from("koleex_todo_assignees").insert(
        assignees.map((a) => ({ todo_id: todoId, account_id: a.account_id })),
      );
      if (asgErr) console.error("[tool.createTodo.assignRows]", asgErr);
      const recipients = assignees.map((a) => a.account_id).filter((id) => id !== ctx.auth.account_id);
      if (recipients.length > 0) {
        await supabaseServer.from("inbox_messages").insert(
          recipients.map((recipientId) => ({
            recipient_account_id: recipientId,
            sender_account_id: ctx.auth.account_id,
            category: "task",
            subject: `New task: ${normalized.title}`,
            body: normalized.description || normalized.title,
            link: `/todo?task=${todoId}`,
            metadata: { type: "todo_assignment", todo_id: todoId, priority: normalized.priority },
          })),
        );
      }
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { ...(data as Record<string, unknown>), assignees },
      message:
        assignees.length > 0
          ? `Created the to-do "${title}" and assigned it to ${assigneeNames} — they've been notified.`
          : `Created the to-do "${title}". You'll find it in your To-do app.`,
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
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };
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
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

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

/* ── Reassign (with confirm) ──
   Ports the PATCH newAssigneeIds path of /api/todos/[id]: owner-only
   (SA / creator / assigner), full-set resync of koleex_todo_assignees,
   INTERNAL-ONLY assignees, and an inbox "New task" ping to NEWLY added
   people only (never a re-ping of existing assignees, no ping on remove).
   The tool speaks add/remove/replace; the confirm call collapses to the
   exact previewed replacement list so what the user approved is what
   gets written even if the set changed in between. */
const reassignTodo: ToolDef<
  {
    task_id?: string;
    add_account_ids?: string[];
    remove_account_ids?: string[];
    replace_with_account_ids?: string[];
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "reassignTodo",
  description:
    "Change WHO an existing to-do task is assigned to: add colleagues, remove colleagues, or replace the whole assignee list. Resolve the task id via listMyTodos and every person via findTeamMember FIRST — never invent ids (if a name matches several people, ask which one). Only the task's owner (its creator or assigner) can reassign. ALWAYS call first WITHOUT confirm to preview the before → after assignees; only call again with confirm:true after the user explicitly agrees. Newly added colleagues are notified automatically.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listMyTodos result." },
      add_account_ids: {
        type: "array",
        items: { type: "string" },
        description: "Account ids (from findTeamMember) to ADD to the current assignees.",
      },
      remove_account_ids: {
        type: "array",
        items: { type: "string" },
        description: "Account ids (from findTeamMember) to REMOVE from the current assignees.",
      },
      replace_with_account_ids: {
        type: "array",
        items: { type: "string" },
        description: "The COMPLETE new assignee list (replaces everyone). Empty array = unassign everyone. Don't combine with add/remove.",
      },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "denied", data: null, message: "Which task? Pick it from listMyTodos first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "denied", data: null, message: "I can't find that task — pick it again from listMyTodos." };

    const acc = ctx.auth.account_id;
    const isOwner = ctx.isSuperAdmin || t.created_by_account_id === acc || t.assigned_by_account_id === acc;
    if (!isOwner) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Only the task's owner (its creator or assigner) can change who it's assigned to." };
    }

    const norm = (v: unknown): string[] =>
      Array.isArray(v) ? Array.from(new Set(v.map((x) => String(x).trim()).filter(Boolean))) : [];
    const addIds = norm(args.add_account_ids);
    const removeIds = norm(args.remove_account_ids);
    const hasReplace = args.replace_with_account_ids !== undefined;
    const replaceIds = norm(args.replace_with_account_ids);
    if (!hasReplace && addIds.length === 0 && removeIds.length === 0) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Tell me who to add or remove — or give me the complete new assignee list." };
    }
    if (hasReplace && (addIds.length > 0 || removeIds.length > 0)) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Use either add/remove OR a full replacement list — not both in one call." };
    }

    const { data: curRows } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("account_id")
      .eq("todo_id", id);
    const currentIds = (curRows ?? []).map((r) => (r as { account_id: string }).account_id);

    const nextIds = hasReplace
      ? replaceIds
      : Array.from(new Set([...currentIds.filter((i) => !removeIds.includes(i)), ...addIds]));

    /* Every id in the NEW set must be a real assignable employee —
       internal + active + human, the same server-side rule the route
       enforces. Unknown / portal ids are a hard error. */
    let all;
    try {
      all = await listAssignableEmployees(ctx.auth.tenant_id);
    } catch (e) {
      console.error("[tool.reassignTodo]", e instanceof Error ? e.message : e);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't verify the assignees right now — please try again." };
    }
    const byId = new Map(all.map((a) => [a.account_id, a]));
    if (nextIds.some((i) => !byId.has(i))) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "One or more people didn't match a real team member. Look each person up with findTeamMember and use the account_id it returns.",
      };
    }
    const nameOf = (aid: string): string => {
      const a = byId.get(aid);
      return a ? a.full_name || a.username : "a former team member";
    };
    const title = t.title ?? "Task";
    const currentNames = currentIds.map(nameOf).join(", ") || "nobody";
    const nextNames = nextIds.map(nameOf).join(", ") || "nobody";

    const same = nextIds.length === currentIds.length && nextIds.every((i) => currentIds.includes(i));
    if (same) {
      return { ok: true, permissionStatus: "allowed", data: { id: t.id, title, assignees: currentIds }, message: `"${title}" is already assigned exactly that way (${currentNames}).` };
    }

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { task_id: t.id, title, current: currentNames, next: nextNames } },
        message: `Ready to change who "${title}" is assigned to: ${currentNames} → ${nextNames}. Newly added people will be notified. Confirm?`,
        pendingAction: { tool: "reassignTodo", args: { task_id: t.id, replace_with_account_ids: nextIds, confirm: true } },
      };
    }

    /* Confirmed — resync exactly like the route: wipe + insert. */
    const { error: delErr } = await supabaseServer.from("koleex_todo_assignees").delete().eq("todo_id", id);
    if (delErr) {
      console.error("[tool.reassignTodo.delete]", delErr);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the assignees — please try again." };
    }
    if (nextIds.length > 0) {
      const { error: insErr } = await supabaseServer.from("koleex_todo_assignees").insert(
        nextIds.map((accountId) => ({ todo_id: id, account_id: accountId })),
      );
      if (insErr) {
        console.error("[tool.reassignTodo.insert]", insErr);
        return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't update the assignees — please try again." };
      }
    }

    const added = nextIds.filter((aid) => aid !== acc && !currentIds.includes(aid));
    if (added.length > 0) {
      await supabaseServer.from("inbox_messages").insert(
        added.map((recipientId) => ({
          recipient_account_id: recipientId,
          sender_account_id: acc,
          category: "task",
          subject: `New task: ${title}`,
          body: t.description || title,
          link: `/todo?task=${t.id}`,
          metadata: { type: "todo_assignment", todo_id: t.id, priority: t.priority ?? "medium" },
        })),
      );
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, title, assignees: nextIds },
      message: `Done — "${title}" is now assigned to ${nextNames}.${added.length > 0 ? " Newly added people have been notified." : ""}`,
      sources: ["koleex_todo_assignees(resync)"],
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
    if (!isUuid(id)) return { ok: false, permissionStatus: "denied", data: null, message: BAD_ID_MESSAGE };

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
  findTeamMember as ToolDef,
  createTodo as ToolDef,
  completeTodo as ToolDef,
  updateTodo as ToolDef,
  reassignTodo as ToolDef,
  deleteTodo as ToolDef,
];
