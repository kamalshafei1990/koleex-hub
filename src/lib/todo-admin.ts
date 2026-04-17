/* ---------------------------------------------------------------------------
   Todo Admin — Multi-user task management with Supabase tables.

   Tables:
     koleex_todos          — main task records
     koleex_todo_assignees — many-to-many assignment junction
     koleex_todo_notes     — per-task comments / notes
     koleex_todo_labels    — custom label catalogue

   Integrations:
     CRM activities  → source="crm"
     Calendar events → source="calendar"
     Inbox           → notification fan-out on assignment
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  TodoRow,
  TodoInsert,
  TodoUpdate,
  TodoAssigneeRow,
  TodoNoteRow,
  TodoLabelRow,
  TodoWithRelations,
  TodoAssigneeInfo,
  AccountRow,
  EmployeeRow,
} from "@/types/supabase";
import {
  buildScopeFilter,
  orClauseForScope,
  privacyClause,
  logPrivateAccess,
  type ScopeContext,
} from "./scope";

/* ── Helper: resolve assignee info from account_ids ── */

async function resolveAssignees(accountIds: string[]): Promise<TodoAssigneeInfo[]> {
  if (accountIds.length === 0) return [];

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, username, avatar_url, person_id")
    .in("id", accountIds);

  if (!accounts || accounts.length === 0) return [];

  const personIds = accounts.map((a) => a.person_id).filter(Boolean) as string[];

  const [{ data: people }, { data: employees }] = await Promise.all([
    personIds.length > 0
      ? supabase.from("people").select("id, full_name").in("id", personIds)
      : { data: [] as { id: string; full_name: string | null }[] },
    supabase.from("koleex_employees").select("account_id, department, position").in("account_id", accountIds),
  ]);

  const personMap = new Map((people || []).map((p) => [p.id, p]));
  const empMap = new Map((employees || []).map((e) => [e.account_id, e]));

  return accounts.map((a) => {
    const person = a.person_id ? personMap.get(a.person_id) : null;
    const emp = empMap.get(a.id);
    return {
      account_id: a.id,
      username: a.username,
      full_name: person?.full_name ?? null,
      avatar_url: a.avatar_url,
      department: emp?.department ?? null,
      position: emp?.position ?? null,
    };
  });
}

/* ── Fetch todos with scope enforcement ──
   When ctx is provided, the fetch filters results to what the user's role
   allows (own / department / all + is_super_admin bypass + private handling).
   When ctx is null/undefined the fetch stays wide-open for backwards-compat
   with integrations that haven't been migrated yet. All UI pages should pass
   ctx — only Supabase-internal triggers or data migrations may skip it.   */

export async function fetchTodos(
  ctx?: ScopeContext | null,
): Promise<TodoWithRelations[]> {
  // Try API first — server-side route does Type C scope + enrichment via
  // service_role, so this path stays sound even after temp RLS policies
  // are dropped.
  try {
    const res = await fetch("/api/todos", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { todos: TodoWithRelations[] };
      return json.todos;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Todos] fetchTodos API failed:", e);
  }

  // Legacy fallback — direct anon-key query with local scope logic.
  // Build scope filter once (loads shared IDs from assignee junction in a
  // single round-trip) — returns null when no ctx provided (wide-open).
  const filter = ctx
    ? await buildScopeFilter({ ctx, module_name: "To-do" })
    : null;

  let query = supabase
    .from("koleex_todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter && ctx) {
    // Multi-tenancy: every fetch is scoped to the viewer's tenant. A
    // customer-tenant account NEVER sees Koleex's todos and vice versa.
    // Super Admin viewing across tenants uses the tenant picker in the
    // top bar to switch ctx.tenant_id, so they still hit this filter —
    // just with a different tenant.
    if (ctx.tenant_id) {
      query = query.eq("tenant_id", ctx.tenant_id);
    }

    // Apply scope-level OR (own / department / all — bypass = no filter).
    // For To-do (a Type C module), scope is hardcoded to Own regardless
    // of koleex_permissions — so non-SA users see only their own records
    // + explicitly assigned + broadcast. No role can grant visibility into
    // another account's private productivity data.
    const scopeOr = orClauseForScope(filter, ctx);
    if (scopeOr) {
      query = query.or(scopeOr);
    }
    // Apply privacy filter: hide is_private unless owner (or break-glass role)
    const privacyOr = privacyClause(filter, ctx);
    if (privacyOr) {
      query = query.or(privacyOr);
    }
  }

  const { data: todos, error } = await query;

  if (error || !todos || todos.length === 0) return [];

  // Break-glass audit: log every private record the user accessed so we
  // have a trail for legally-sensitive access.
  if (ctx?.can_view_private) {
    const privateIds = todos.filter((t) => t.is_private).map((t) => t.id);
    if (privateIds.length > 0) {
      void logPrivateAccess(ctx, "To-do", "koleex_todos", privateIds);
    }
  }

  const todoIds = todos.map((t) => t.id);

  // Fetch assignees
  const { data: assigneeRows } = await supabase
    .from("koleex_todo_assignees")
    .select("*")
    .in("todo_id", todoIds);

  // Fetch notes
  const { data: noteRows } = await supabase
    .from("koleex_todo_notes")
    .select("*")
    .in("todo_id", todoIds)
    .order("created_at", { ascending: true });

  // Collect all unique account_ids
  const allAccountIds = new Set<string>();
  todos.forEach((t) => {
    if (t.created_by_account_id) allAccountIds.add(t.created_by_account_id);
    if (t.assigned_by_account_id) allAccountIds.add(t.assigned_by_account_id);
  });
  (assigneeRows || []).forEach((a) => allAccountIds.add(a.account_id));
  (noteRows || []).forEach((n) => allAccountIds.add(n.author_account_id));

  // Resolve all accounts in one batch
  const allInfos = await resolveAssignees(Array.from(allAccountIds));
  const infoMap = new Map(allInfos.map((i) => [i.account_id, i]));

  // Build enriched list
  return todos.map((t) => {
    const tAssignees = (assigneeRows || [])
      .filter((a) => a.todo_id === t.id)
      .map((a) => infoMap.get(a.account_id))
      .filter(Boolean) as TodoAssigneeInfo[];

    const assigner = t.assigned_by_account_id
      ? (() => {
          const info = infoMap.get(t.assigned_by_account_id!);
          return info ? {
            account_id: info.account_id,
            username: info.username,
            full_name: info.full_name,
            avatar_url: info.avatar_url,
          } : null;
        })()
      : null;

    const tNotes = (noteRows || [])
      .filter((n) => n.todo_id === t.id)
      .map((n) => {
        const auth = infoMap.get(n.author_account_id);
        return {
          ...n,
          author_username: auth?.username ?? "unknown",
          author_full_name: auth?.full_name ?? null,
          author_avatar_url: auth?.avatar_url ?? null,
        };
      });

    return { ...t, assignees: tAssignees, assigner, notes: tNotes } as TodoWithRelations;
  });
}

/* ── Create todo ── */

export async function createTodo(input: {
  title: string;
  description?: string | null;
  priority?: "high" | "medium" | "low";
  label?: string | null;
  due_date?: string | null;
  created_by_account_id?: string | null;
  assigned_by_account_id?: string | null;
  source?: "manual" | "crm" | "calendar";
  source_id?: string | null;
  assignee_account_ids?: string[];
  assigned_department?: string | null;
  assign_to_all?: boolean;
}): Promise<TodoRow | null> {
  // API-first — server enforces creator/tenant and handles fan-out.
  try {
    const res = await fetch("/api/todos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        priority: input.priority,
        label: input.label,
        due_date: input.due_date,
        source: input.source,
        source_id: input.source_id,
        assignee_account_ids: input.assignee_account_ids,
        assigned_department: input.assigned_department,
        assign_to_all: input.assign_to_all,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { todo: TodoRow | null };
      if (typeof window !== "undefined" && json.todo) {
        setTimeout(
          () => window.dispatchEvent(new CustomEvent("inbox:force-recount")),
          500,
        );
      }
      return json.todo;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Todos] createTodo API failed:", e);
  }

  const { data: todo, error } = await supabase
    .from("koleex_todos")
    .insert({
      title: input.title,
      description: input.description ?? null,
      completed: false,
      priority: input.priority ?? "medium",
      label: input.label ?? null,
      due_date: input.due_date ?? null,
      created_by_account_id: input.created_by_account_id ?? null,
      assigned_by_account_id: input.assigned_by_account_id ?? null,
      source: input.source ?? "manual",
      source_id: input.source_id ?? null,
      assigned_department: input.assigned_department ?? null,
      assign_to_all: input.assign_to_all ?? false,
    })
    .select("*")
    .single();

  if (error || !todo) {
    console.error("[Todos] Create:", error?.message);
    return null;
  }

  // Resolve assignee list
  let assigneeIds = input.assignee_account_ids ?? [];

  // Department assignment: add all employees in that department
  if (input.assigned_department) {
    const { data: emps } = await supabase
      .from("koleex_employees")
      .select("account_id")
      .eq("department", input.assigned_department)
      .not("account_id", "is", null);
    if (emps) {
      const deptIds = emps.map((e) => e.account_id).filter(Boolean) as string[];
      assigneeIds = [...new Set([...assigneeIds, ...deptIds])];
    }
  }

  // Assign to all internal accounts
  if (input.assign_to_all) {
    const { data: allAccounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_type", "internal")
      .eq("status", "active");
    if (allAccounts) {
      assigneeIds = allAccounts.map((a) => a.id);
    }
  }

  // Insert assignees
  if (assigneeIds.length > 0) {
    const rows = assigneeIds.map((accountId) => ({
      todo_id: todo.id,
      account_id: accountId,
    }));
    await supabase.from("koleex_todo_assignees").insert(rows);
  }

  // Fan out notifications to assignees (except self)
  const creatorId = input.created_by_account_id || input.assigned_by_account_id;
  if (creatorId && assigneeIds.length > 0) {
    const recipientIds = assigneeIds.filter((id) => id !== creatorId);
    if (recipientIds.length > 0) {
      const notifs = recipientIds.map((recipientId) => ({
        recipient_account_id: recipientId,
        sender_account_id: creatorId,
        category: "task" as const,
        subject: `New task: ${input.title}`,
        body: input.description || input.title,
        link: `/todo?task=${todo.id}`,
        metadata: {
          type: "todo_assignment",
          todo_id: todo.id,
          priority: input.priority ?? "medium",
        },
      }));
      await supabase.from("inbox_messages").insert(notifs);

      /* Kick NotificationBell to recount immediately — this covers
         the case where the sender is also a recipient, or where the
         Supabase realtime event has a slight delay. */
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("inbox:force-recount"));
        }, 500);
      }
    }
  }

  return todo as TodoRow;
}

/* ── Update todo ── */

export async function updateTodo(
  id: string,
  updates: TodoUpdate,
  newAssigneeIds?: string[],
): Promise<boolean> {
  try {
    const res = await fetch("/api/todos/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, newAssigneeIds }),
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Todos] updateTodo API failed:", e);
  }

  const { error } = await supabase
    .from("koleex_todos")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[Todos] Update:", error.message);
    return false;
  }

  if (newAssigneeIds !== undefined) {
    await supabase.from("koleex_todo_assignees").delete().eq("todo_id", id);
    if (newAssigneeIds.length > 0) {
      await supabase.from("koleex_todo_assignees").insert(
        newAssigneeIds.map((accountId) => ({ todo_id: id, account_id: accountId })),
      );
    }
  }

  return true;
}

/* ── Toggle complete ── */

export async function toggleTodo(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todos/" + id + "/toggle", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Todos] toggleTodo API failed:", e);
  }

  const { data: row } = await supabase
    .from("koleex_todos")
    .select("completed")
    .eq("id", id)
    .single();
  if (!row) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("koleex_todos")
    .update({
      completed: !row.completed,
      completed_at: !row.completed ? now : null,
      updated_at: now,
    })
    .eq("id", id);
  return !error;
}

/* ── Delete todo ── */

export async function deleteTodo(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todos/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Todos] deleteTodo API failed:", e);
  }
  const { error } = await supabase.from("koleex_todos").delete().eq("id", id);
  return !error;
}

/* ── Notes ── */

export async function addTodoNote(
  todoId: string,
  authorAccountId: string,
  body: string,
): Promise<TodoNoteRow | null> {
  try {
    const res = await fetch("/api/todos/" + todoId + "/notes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const json = (await res.json()) as { note: TodoNoteRow | null };
      return json.note;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  } catch (e) {
    console.error("[Todos] addTodoNote API failed:", e);
  }
  const { data, error } = await supabase
    .from("koleex_todo_notes")
    .insert({ todo_id: todoId, author_account_id: authorAccountId, body })
    .select("*")
    .single();

  if (error) {
    console.error("[Todos] Add note:", error.message);
    return null;
  }
  return data as TodoNoteRow;
}

export async function deleteTodoNote(noteId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todo-notes/" + noteId, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Todos] deleteTodoNote API failed:", e);
  }
  const { error } = await supabase.from("koleex_todo_notes").delete().eq("id", noteId);
  return !error;
}

/* ── Labels ── */

export async function fetchTodoLabels(): Promise<TodoLabelRow[]> {
  try {
    const res = await fetch("/api/todo-labels", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { labels: TodoLabelRow[] };
      return json.labels;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Todos] fetchTodoLabels API failed:", e);
  }
  const { data } = await supabase
    .from("koleex_todo_labels")
    .select("*")
    .order("name");
  return (data || []) as TodoLabelRow[];
}

export async function createTodoLabel(
  name: string,
  color?: string | null,
): Promise<TodoLabelRow | null> {
  try {
    const res = await fetch("/api/todo-labels", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      const json = (await res.json()) as { label: TodoLabelRow | null };
      return json.label;
    }
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Todos] createTodoLabel API failed:", e);
  }
  const { data, error } = await supabase
    .from("koleex_todo_labels")
    .insert({ name, color: color ?? null })
    .select("*")
    .single();

  if (error) {
    console.error("[Todos] Create label:", error.message);
    return null;
  }
  return data as TodoLabelRow;
}

/* ── Assignable employees ── */

export async function fetchAssignableEmployees(): Promise<TodoAssigneeInfo[]> {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, username, avatar_url, person_id")
    .eq("user_type", "internal")
    .eq("status", "active");

  if (!accounts || accounts.length === 0) return [];
  return resolveAssignees(accounts.map((a) => a.id));
}

/* ── Departments ── */

export async function fetchDepartments(): Promise<string[]> {
  const { data } = await supabase
    .from("koleex_employees")
    .select("department")
    .not("department", "is", null);

  if (!data) return [];
  const unique = [...new Set(data.map((d) => d.department).filter(Boolean) as string[])];
  return unique.sort();
}

/* ── Realtime subscription for live todo updates ── */

export function subscribeToTodos(
  onInsert: (row: TodoRow) => void,
  onChange: (row: TodoRow) => void,
  onDelete: (oldRow: { id: string }) => void,
): () => void {
  const topic = `todos-live-${Date.now()}`;

  const channel = supabase
    .channel(topic)
    .on(
      "postgres_changes" as never,
      { event: "INSERT", schema: "public", table: "koleex_todos" },
      (payload: { new: TodoRow }) => onInsert(payload.new),
    )
    .on(
      "postgres_changes" as never,
      { event: "UPDATE", schema: "public", table: "koleex_todos" },
      (payload: { new: TodoRow }) => onChange(payload.new),
    )
    .on(
      "postgres_changes" as never,
      { event: "DELETE", schema: "public", table: "koleex_todos" },
      (payload: { old: { id: string } }) => onDelete(payload.old),
    )
    .subscribe((status: string) => {
      if (status === "CHANNEL_ERROR") {
        setTimeout(() => {
          channel.unsubscribe();
          supabase.channel(topic).subscribe();
        }, 3000);
      }
    });

  return () => {
    channel.unsubscribe();
  };
}
