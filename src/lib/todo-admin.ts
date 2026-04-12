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

/* ── Fetch all todos with relations ── */

export async function fetchTodos(): Promise<TodoWithRelations[]> {
  const { data: todos, error } = await supabase
    .from("koleex_todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !todos || todos.length === 0) return [];

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
  const { error } = await supabase
    .from("koleex_todos")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[Todos] Update:", error.message);
    return false;
  }

  // Re-sync assignees if provided
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
  const { error } = await supabase.from("koleex_todos").delete().eq("id", id);
  return !error;
}

/* ── Notes ── */

export async function addTodoNote(
  todoId: string,
  authorAccountId: string,
  body: string,
): Promise<TodoNoteRow | null> {
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
  const { error } = await supabase.from("koleex_todo_notes").delete().eq("id", noteId);
  return !error;
}

/* ── Labels ── */

export async function fetchTodoLabels(): Promise<TodoLabelRow[]> {
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
