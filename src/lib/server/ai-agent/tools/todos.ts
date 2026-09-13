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
import { resolveTaskTime, resolveTaskDay, describeWhen, parseRecurrence } from "./task-time";
import { buildTaskDraft, dayRangeISO, idList, type Person } from "./task-draft";

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
  metadata: { observers?: Array<{ account_id?: string; full_name?: string | null; username?: string | null }>; [key: string]: unknown } | null;
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

/* ── People on a task, resolved once ──
   Every account id the model passes — assignees, observers, mentions — must
   be a real, assignable colleague (internal, active, human: the same list
   every picker in the app uses) and, for a department, a department those
   colleagues actually have. An id not on the list is a hard error, never
   silently dropped; the model is told to look the person up again. One
   lookup serves all three groups. */
type PeopleResult =
  | { ok: true; people: Map<string, Person>; departments: Set<string> }
  | { ok: false; message: string };

async function resolvePeople(tenantId: string | null, ids: string[], label: string): Promise<PeopleResult> {
  let all;
  try {
    all = await listAssignableEmployees(tenantId);
  } catch (e) {
    console.error(`[tool.${label}.people]`, e instanceof Error ? e.message : e);
    return { ok: false, message: "Couldn't verify the people right now — please try again." };
  }
  const people = new Map<string, Person>();
  const departments = new Set<string>();
  for (const a of all) {
    people.set(a.account_id, { account_id: a.account_id, name: a.full_name || a.username, username: a.username, department: a.department });
    if (a.department) departments.add(a.department.trim().toLowerCase());
  }
  const unknown = ids.filter((id) => !people.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: "One or more people didn't match a real team member. Look each person up with findTeamMember and use the account_id it returns.",
    };
  }
  return { ok: true, people, departments };
}

/** The metadata shape the To-do app writes for a person on a task. */
function personRef(p: Person): { account_id: string; full_name: string | null; username: string | null } {
  return { account_id: p.account_id, full_name: p.name, username: p.username };
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
          "Optional due filter. Default 'any' — use 'any' for general questions like 'what tasks do I have', 'what's on my plate', or even 'what do I have today' (an active task with NO due date is still something the user has, so 'any' surfaces it). Only use 'today' when the user explicitly asks what is DUE today (it excludes undated tasks); 'overdue' for past-due; 'week' for the next 7 days; 'reminders' for tasks whose reminder rings today (for the day's brief). Days are the user's own, in their timezone.",
        enum: ["any", "overdue", "today", "week", "reminders"],
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

    /* THE DAY IS THE CALLER'S (tasks phase 4, 2026-09-13): "today" used to
       be the server's UTC day — for a caller in Dubai or Shanghai that
       started at 04:00 or 08:00 their time and hid the morning's tasks. */
    if (due !== "any") {
      const { startOfToday, endOfToday, endOfWeek } = dayRangeISO(ctx.timezone || "Asia/Dubai");
      const nowISO = new Date().toISOString();
      if (due === "overdue") q = q.lt("due_date", nowISO).eq("completed", false);
      else if (due === "today") q = q.gte("due_date", startOfToday).lte("due_date", endOfToday);
      else if (due === "week") q = q.gte("due_date", nowISO).lte("due_date", endOfWeek);
      else if (due === "reminders") q = q.gte("remind_at", startOfToday).lte("remind_at", endOfToday).eq("completed", false);
    }

    const { data, error } = await q
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error("[tool.listMyTodos]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't load your tasks right now." };
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
    if (!query) return { ok: false, permissionStatus: "allowed", data: null, message: "Whose name should I look up?" };
    const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 10);

    let all;
    try {
      all = await listAssignableEmployees(ctx.auth.tenant_id);
    } catch (e) {
      console.error("[tool.findTeamMember]", e instanceof Error ? e.message : e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't search the team right now." };
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
    remind_at?: string;
    start_date?: string;
    recurrence?: string;
    recurrence_until?: string;
    is_private?: boolean;
    assign_to_department?: string;
    assign_to_all?: boolean;
    observer_account_ids?: string[];
    mention_account_ids?: string[];
    label?: string;
    assign_to_account_ids?: string[];
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createTodo",
  description:
    "Create a NEW to-do task or reminder — for the user by default, or ASSIGNED TO COLLEAGUES by passing assign_to_account_ids (resolve each person with findTeamMember first; if a name matches several people, ask the user which one before calling this). Fill everything the conversation already says: due_date, remind_at (\"remind me at 3\" → today 15:00 in the user's timezone), start_date, priority, label, recurrence, is_private, observers (people who should follow it), mentions (people who should know). Only the title is required — never ask for the rest; leave what was not said empty. ALWAYS call this first WITHOUT confirm to preview what will be created; show the user the details — including WHO it will be assigned to and WHEN they will be reminded — and only call again with confirm:true after they explicitly agree. Assigned colleagues, observers and mentioned people are notified automatically.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The task title, in the user's own words (required)." },
      description: { type: "string", description: "Optional longer description — only what the user said, never invented." },
      priority: { type: "string", description: "low | medium | high. Default medium; \"urgent\" or a deadline today means high.", enum: ["low", "medium", "high"] },
      due_date: { type: "string", description: "When it is due: ISO date (2026-09-18) or local datetime (2026-09-18T15:00). A bare time the user said (\"at 3\") is today at that hour, or tomorrow if it has passed. Read in the user's timezone." },
      remind_at: { type: "string", description: "When to remind: ISO date or local datetime, read in the user's timezone. \"Remind me at 3\" → today 15:00. If omitted and due_date has a time, the reminder is at the due time; a bare due date gets no reminder." },
      start_date: { type: "string", description: "Optional ISO date the work starts (\"from Monday\")." },
      label: { type: "string", description: "Optional short label/category — a department or project word the user used, or an existing label name." },
      recurrence: { type: "string", description: "Optional: daily | weekly | monthly (\"every Monday\" → weekly with due_date on the first Monday).", enum: ["daily", "weekly", "monthly"] },
      recurrence_until: { type: "string", description: "Optional ISO date the recurrence stops." },
      is_private: { type: "boolean", description: "True when the user says the task is private / just for them." },
      assign_to_account_ids: {
        type: "array",
        items: { type: "string" },
        description: "Account ids of colleagues to assign this task to — each id MUST come from a findTeamMember result in this conversation. Omit for the user's own task.",
      },
      assign_to_department: { type: "string", description: "Optional department name to assign the task to everyone in it (\"the design team\")." },
      assign_to_all: { type: "boolean", description: "True to assign to everyone in the company (admins only)." },
      observer_account_ids: { type: "array", items: { type: "string" }, description: "People who should follow the task (\"keep X in the loop\") — ids from findTeamMember." },
      mention_account_ids: { type: "array", items: { type: "string" }, description: "People who should be told about it (\"let X know\", \"cc X\") — ids from findTeamMember." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user has explicitly confirmed the previewed task." },
    },
    required: ["title"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const title = String(args.title ?? "").trim();
    const tz = ctx.timezone || "Asia/Dubai";
    /* PEOPLE, resolved once against the assignable-employees list — the same
       internal/active/human source every app picker uses; the draft itself
       is decided by pure code (task-draft.ts) so it can be proved. */
    const everyone = [...idList(args.assign_to_account_ids), ...idList(args.observer_account_ids), ...idList(args.mention_account_ids)];
    const department = typeof args.assign_to_department === "string" ? args.assign_to_department.trim() : "";
    let people = new Map<string, Person>();
    let departments = new Set<string>();
    if (everyone.length > 0 || department) {
      const r = await resolvePeople(ctx.auth.tenant_id, [], "createTodo");
      if (!r.ok) return { ok: false, permissionStatus: "allowed", data: null, message: r.message };
      people = r.people;
      departments = r.departments;
    }
    const ut = (ctx.auth.user_type ?? "").toLowerCase();
    const built = buildTaskDraft(args, { tz, people, departments, isAdmin: ctx.isSuperAdmin || ut === "admin" });
    if (!built.ok) {
      return { ok: false, permissionStatus: built.permission ? "denied" : "allowed", data: null, message: built.message };
    }
    const { draft: normalized, assignees, observers, mentions, department: departmentName, toAll, who, when } = built;
    const priority = normalized.priority;
    const recurrence = normalized.recurrence;
    const assigneeIds = assignees.map((p) => p.account_id);
    const observerIds = observers.map((p) => p.account_id);
    const mentionIds = mentions.map((p) => p.account_id);
    const names = (list: Person[]) => list.map((p) => p.name).join(", ");

    // Phase 1: preview only — nothing is written.
    if (args.confirm !== true) {
      const bits = [
        `priority ${priority}`,
        when.due ? `due ${when.due}` : "",
        when.remind ? `reminder ${when.remind}` : "",
        when.start ? `starts ${when.start}` : "",
        recurrence ? `repeats ${recurrence}` : "",
        normalized.label ? `label ${normalized.label}` : "",
        normalized.is_private ? "private" : "",
        observers.length ? `observers ${names(observers)}` : "",
        mentions.length ? `mention ${names(mentions)}` : "",
      ].filter(Boolean);
      const forWhom = who ? ` assigned to ${who}` : " for you";
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: {
          preview: {
            ...normalized,
            assignees: assignees.map((p) => ({ account_id: p.account_id, name: p.name })),
            observers: observers.map((p) => ({ account_id: p.account_id, name: p.name })),
            mentions: mentions.map((p) => ({ account_id: p.account_id, name: p.name })),
            department: departmentName,
            assign_to_all: toAll,
            when,
            timezone: tz,
          },
        },
        message: `Ready to create this to-do${forWhom}: "${title}" (${bits.join(", ")}). Confirm and I'll add it${who ? " and notify them" : ""}.`,
        pendingAction: {
          tool: "createTodo",
          args: {
            ...normalized,
            ...(assigneeIds.length > 0 ? { assign_to_account_ids: assigneeIds } : {}),
            ...(observerIds.length > 0 ? { observer_account_ids: observerIds } : {}),
            ...(mentionIds.length > 0 ? { mention_account_ids: mentionIds } : {}),
            ...(departmentName ? { assign_to_department: departmentName } : {}),
            ...(toAll ? { assign_to_all: true } : {}),
            confirm: true,
          },
        },
      };
    }

    // Phase 2: confirmed — insert exactly like /api/todos POST.
    const { data, error } = await supabaseServer
      .from("koleex_todos")
      .insert({
        title: normalized.title,
        /* AI provenance lives in metadata: the `source` column has a CHECK
           constraint (manual|crm|calendar) — 'koleex-ai' violates it and
           silently failed every confirmed create until 2026-08-08. People on
           the task go where the To-do app puts them. */
        metadata: {
          created_via: "koleex-ai",
          ...(observers.length ? { observers: observers.map(personRef) } : {}),
          ...(mentions.length ? { mentions: mentions.map(personRef) } : {}),
        },
        description: normalized.description,
        completed: false,
        completed_at: null,
        status: "todo",
        priority: normalized.priority,
        label: normalized.label,
        due_date: normalized.due_date,
        start_date: normalized.start_date,
        remind_at: normalized.remind_at,
        recurrence: normalized.recurrence,
        recurrence_until: normalized.recurrence_until,
        created_by_account_id: ctx.auth.account_id,
        assigned_by_account_id: ctx.auth.account_id,
        source: "manual",
        source_id: null,
        assigned_department: departmentName,
        assign_to_all: toAll,
        is_private: normalized.is_private,
        tenant_id: ctx.auth.tenant_id,
      })
      .select("id, title, status, priority, due_date, remind_at, created_at")
      .single();

    if (error) {
      console.error("[tool.createTodo]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the task — please try again." };
    }
    const todoId = (data as { id: string }).id;

    /* ASSIGNEE ROWS — the explicit list, a department's members, or
       everyone — exactly as the route expands them, INTERNAL ONLY. */
    let assigneeAccountIds = assignees.map((a) => a.account_id);
    if (departmentName && ctx.auth.tenant_id) {
      const { data: emps } = await supabaseServer
        .from("koleex_employees")
        .select("account_id")
        .eq("department", departmentName)
        .eq("tenant_id", ctx.auth.tenant_id)
        .not("account_id", "is", null);
      const deptIds = (emps ?? []).map((e) => (e as { account_id: string | null }).account_id).filter(Boolean) as string[];
      assigneeAccountIds = Array.from(new Set([...assigneeAccountIds, ...deptIds]));
    }
    if (toAll && ctx.auth.tenant_id) {
      const { data: allAccounts } = await supabaseServer
        .from("accounts")
        .select("id")
        .eq("user_type", "internal")
        .eq("status", "active")
        .eq("tenant_id", ctx.auth.tenant_id);
      assigneeAccountIds = (allAccounts ?? []).map((a) => (a as { id: string }).id);
    }
    if (assigneeAccountIds.length > 0 && ctx.auth.tenant_id) {
      const { data: internal } = await supabaseServer
        .from("accounts")
        .select("id")
        .in("id", assigneeAccountIds)
        .eq("user_type", "internal")
        .eq("tenant_id", ctx.auth.tenant_id);
      assigneeAccountIds = (internal ?? []).map((a) => (a as { id: string }).id);
    }

    /* NOTIFICATIONS — mirror /api/todos POST: assignees, then mentions, then
       observers; never the creator, never the same person twice. */
    const notified = new Set<string>([ctx.auth.account_id]);
    const inbox = async (recipients: string[], subject: string, type: string, extra: Record<string, unknown> = {}) => {
      const fresh = recipients.filter((id) => !notified.has(id));
      if (fresh.length === 0) return;
      fresh.forEach((id) => notified.add(id));
      const { error: nErr } = await supabaseServer.from("inbox_messages").insert(
        fresh.map((recipientId) => ({
          recipient_account_id: recipientId,
          sender_account_id: ctx.auth.account_id,
          category: "task",
          subject,
          body: normalized.description || normalized.title,
          link: `/todo?task=${todoId}`,
          metadata: { type, todo_id: todoId, ...extra },
        })),
      );
      if (nErr) console.error(`[tool.createTodo.${type}]`, nErr);
    };
    if (assigneeAccountIds.length > 0) {
      const { error: asgErr } = await supabaseServer.from("koleex_todo_assignees").insert(
        assigneeAccountIds.map((accountId) => ({ todo_id: todoId, account_id: accountId })),
      );
      if (asgErr) console.error("[tool.createTodo.assignRows]", asgErr);
      await inbox(assigneeAccountIds, `New task: ${normalized.title}`, "todo_assignment", { priority: normalized.priority });
    }
    await inbox(mentions.map((p) => p.account_id), `You were mentioned: ${normalized.title}`, "todo_mention");
    await inbox(observers.map((p) => p.account_id), `You are now an observer: ${normalized.title}`, "todo_observer");

    const reminderNote = when.remind ? ` I'll remind ${who ? "them" : "you"} ${when.remind}.` : "";
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { ...(data as Record<string, unknown>), assignees: assignees.map((p) => ({ account_id: p.account_id, name: p.name })), when },
      message:
        who
          ? `Created the to-do "${title}" and assigned it to ${who} — they've been notified.${reminderNote}`
          : `Created the to-do "${title}". You'll find it in your To-do app.${reminderNote}`,
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
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listMyTodos first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };
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
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task — pick it again from listMyTodos." };

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
        return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
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
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
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
    remind_at?: string;
    start_date?: string;
    recurrence?: string;
    is_private?: boolean;
    add_observer_account_ids?: string[];
    remove_observer_account_ids?: string[];
    due_date?: string;
    label?: string;
    confirm?: boolean;
  },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "updateTodo",
  description:
    "Update details of one of the user's own to-do tasks: title, description, priority, due date, reminder time, start date, label, recurrence, private flag, or the people following it (observers). Resolve the task id via listMyTodos FIRST — never invent an id. Only the task's owner (its creator or assigner) can edit details; assignees should use completeTodo instead. ALWAYS call first WITHOUT confirm to preview the change; only call again with confirm:true after the user explicitly agrees. Pass ONLY the fields being changed. To clear a date, reminder, label or recurrence, pass the literal string \"none\". Times are read in the user's timezone.",
  parameters: {
    type: "object",
    properties: {
      task_id: { type: "string", description: "The task's id, taken from a listMyTodos result." },
      title: { type: "string", description: "New title." },
      description: { type: "string", description: "New description." },
      priority: { type: "string", description: "New priority.", enum: ["low", "medium", "high"] },
      due_date: { type: "string", description: "New due date (ISO date or local datetime), or \"none\" to clear it." },
      remind_at: { type: "string", description: "New reminder time (ISO date or local datetime), or \"none\" to clear it." },
      start_date: { type: "string", description: "New start date (ISO date), or \"none\" to clear it." },
      label: { type: "string", description: "New short label, or \"none\" to clear it." },
      recurrence: { type: "string", description: "daily | weekly | monthly, or \"none\" to stop repeating." },
      is_private: { type: "boolean", description: "Make the task private (true) or visible as usual (false)." },
      add_observer_account_ids: { type: "array", items: { type: "string" }, description: "People to add as observers — ids from findTeamMember." },
      remove_observer_account_ids: { type: "array", items: { type: "string" }, description: "Observers to remove — ids from the task's observers." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after the user explicitly confirmed the previewed change." },
    },
    required: ["task_id"],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const id = String(args.task_id ?? "").trim();
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listMyTodos first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task — pick it again from listMyTodos." };

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

    const tz = ctx.timezone || "Asia/Dubai";
    const isNone = (v: unknown) => typeof v === "string" && v.trim().toLowerCase() === "none";
    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string" && args.title.trim()) changes.title = args.title.trim();
    if (typeof args.description === "string") changes.description = args.description;
    if (["low", "medium", "high"].includes(String(args.priority))) changes.priority = String(args.priority);
    if (typeof args.due_date === "string" && args.due_date.trim()) {
      const v = isNone(args.due_date) ? null : resolveTaskTime(args.due_date, tz, 17);
      if (!isNone(args.due_date) && !v) return { ok: false, permissionStatus: "allowed", data: null, message: "I couldn't read that due date — give it as an ISO date or a local date and time." };
      changes.due_date = v;
    }
    if (typeof args.remind_at === "string" && args.remind_at.trim()) {
      const v = isNone(args.remind_at) ? null : resolveTaskTime(args.remind_at, tz);
      if (!isNone(args.remind_at) && !v) return { ok: false, permissionStatus: "allowed", data: null, message: "I couldn't read that reminder time — give it as a local date and time." };
      changes.remind_at = v;
    }
    if (typeof args.start_date === "string" && args.start_date.trim()) {
      changes.start_date = isNone(args.start_date) ? null : resolveTaskDay(args.start_date, tz);
    }
    if (typeof args.label === "string" && args.label.trim()) {
      changes.label = isNone(args.label) ? null : args.label.trim();
    }
    if (typeof args.recurrence === "string" && args.recurrence.trim()) {
      changes.recurrence = isNone(args.recurrence) ? null : parseRecurrence(args.recurrence);
      if (changes.recurrence === null) changes.recurrence_until = null;
    }
    if (typeof args.is_private === "boolean") changes.is_private = args.is_private;

    /* OBSERVERS live in metadata; a change is a new list, previewed by name. */
    const addObs = idList(args.add_observer_account_ids);
    const removeObs = new Set(idList(args.remove_observer_account_ids));
    const currentObs = Array.isArray(t.metadata?.observers) ? t.metadata!.observers : [];
    let nextObservers: Array<{ account_id: string; full_name: string | null; username: string | null }> | null = null;
    let observerNames = "";
    if (addObs.length > 0 || removeObs.size > 0) {
      const r = addObs.length > 0 ? await resolvePeople(ctx.auth.tenant_id, addObs, "updateTodo") : null;
      if (r && !r.ok) return { ok: false, permissionStatus: "allowed", data: null, message: r.message };
      const kept = currentObs
        .filter((o) => o.account_id && !removeObs.has(o.account_id))
        .map((o) => ({ account_id: o.account_id!, full_name: o.full_name ?? null, username: o.username ?? null }));
      const have = new Set(kept.map((o) => o.account_id));
      const added = r && r.ok ? addObs.filter((id) => !have.has(id)).map((id) => personRef(r.people.get(id)!)) : [];
      nextObservers = [...kept, ...added];
      observerNames = nextObservers.map((o) => o.full_name || o.username || "").filter(Boolean).join(", ") || "(none)";
    }
    if (Object.keys(changes).length === 0 && nextObservers === null) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Nothing to change — tell me what to update (title, description, priority, due date, reminder, start date, label, recurrence, private, or observers)." };
    }

    const title = t.title ?? "Task";
    const worded = (k: string, v: unknown) =>
      v === null ? "(cleared)" : (k === "due_date" || k === "remind_at") && typeof v === "string" ? describeWhen(v, tz) : String(v);
    if (args.confirm !== true) {
      const parts = Object.entries(changes).map(([k, v]) => `${k.replace("_", " ")} → ${worded(k, v)}`);
      if (nextObservers !== null) parts.push(`observers → ${observerNames}`);
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: {
          preview: {
            task_id: t.id,
            title,
            current: { title: t.title, description: t.description, priority: t.priority, due_date: t.due_date, label: t.label },
            changes,
            ...(nextObservers !== null ? { observers: nextObservers } : {}),
            timezone: tz,
          },
        },
        message: `Ready to update "${title}": ${parts.join(", ")}. Confirm?`,
        pendingAction: { tool: "updateTodo", args: { ...args, task_id: t.id, confirm: true } },
      };
    }

    const patch: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() };
    if (nextObservers !== null) patch.metadata = { ...(t.metadata ?? {}), observers: nextObservers };
    const { error } = await supabaseServer
      .from("koleex_todos")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[tool.updateTodo]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the task — please try again." };
    }
    /* Newly added observers hear about it, as they do from the app. */
    if (nextObservers !== null) {
      const before = new Set(currentObs.map((o) => o.account_id));
      const fresh = nextObservers.map((o) => o.account_id).filter((id) => !before.has(id) && id !== ctx.auth.account_id);
      if (fresh.length > 0) {
        await supabaseServer.from("inbox_messages").insert(
          fresh.map((recipientId) => ({
            recipient_account_id: recipientId,
            sender_account_id: ctx.auth.account_id,
            category: "task",
            subject: `You are now an observer: ${title}`,
            body: t.description || title,
            link: `/todo?task=${t.id}`,
            metadata: { type: "todo_observer", todo_id: t.id },
          })),
        );
      }
    }
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { id: t.id, updated: [...Object.keys(changes), ...(nextObservers !== null ? ["observers"] : [])] },
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
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listMyTodos first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task — pick it again from listMyTodos." };

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
      return { ok: false, permissionStatus: "allowed", data: null, message: "Tell me who to add or remove — or give me the complete new assignee list." };
    }
    if (hasReplace && (addIds.length > 0 || removeIds.length > 0)) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Use either add/remove OR a full replacement list — not both in one call." };
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
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't verify the assignees right now — please try again." };
    }
    const byId = new Map(all.map((a) => [a.account_id, a]));
    if (nextIds.some((i) => !byId.has(i))) {
      return {
        ok: false,
        permissionStatus: "allowed",
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
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the assignees — please try again." };
    }
    if (nextIds.length > 0) {
      const { error: insErr } = await supabaseServer.from("koleex_todo_assignees").insert(
        nextIds.map((accountId) => ({ todo_id: id, account_id: accountId })),
      );
      if (insErr) {
        console.error("[tool.reassignTodo.insert]", insErr);
        return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't update the assignees — please try again." };
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
    if (!id) return { ok: false, permissionStatus: "allowed", data: null, message: "Which task? Pick it from listMyTodos first." };
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };

    const t = await loadTodoRow(id, ctx.auth.tenant_id);
    if (!t) return { ok: false, permissionStatus: "allowed", data: null, message: "I can't find that task — pick it again from listMyTodos." };

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
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't delete the task — please try again." };
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
