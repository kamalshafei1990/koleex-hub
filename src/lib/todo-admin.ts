/* ---------------------------------------------------------------------------
   Todo Admin — the browser's client for the /api/todos family.

   Tables (server-side only now):
     koleex_todos          — main task records
     koleex_todo_assignees — many-to-many assignment junction
     koleex_todo_notes     — per-task comments / notes
     koleex_todo_labels    — custom label catalogue

   Integrations:
     CRM activities  → source="crm"
     Calendar events → source="calendar"
     Inbox           → notification fan-out on assignment (server-side)

   THE BROWSER NO LONGER READS OR WRITES THESE TABLES (2026-08-09). Every
   function called its API route and then, on any outcome that was not a clean
   401/403, fell back to querying Supabase directly with the anon key — while
   re-implementing scope, tenant and privacy rules in the browser. Three things
   were wrong with that:

     · the fallback ran precisely when something had already gone wrong, so a
       500 quietly demoted the caller to the least trustworthy code path;
     · most of it COULD NOT WORK. accounts, people and koleex_employees are
       service-role-only since the P0 lockdown, so those queries returned
       nothing and the comments said so;
     · each one was a direct cross-border round trip from the browser to
       ap-northeast-1 — the same query costs ~56 ms from the function.

   `resolveAssignees` went with them; /api/todos/assignees does that job.

   Realtime (`subscribeToTodos`) still uses the Supabase client, because live
   task updates need a socket and there is no first-party replacement yet.
   That is the only reason this file still touches the client at all. */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  TodoRow,
  TodoUpdate,
  TodoNoteRow,
  TodoLabelRow,
  TodoWithRelations,
  TodoAssigneeInfo,
  TodoMetadata,
} from "@/types/supabase";
import type { ScopeContext } from "./scope";

/* ── Fetch todos with scope enforcement ──
   When ctx is provided, the fetch filters results to what the user's role
   allows (own / department / all + is_super_admin bypass + private handling).
   When ctx is null/undefined the fetch stays wide-open for backwards-compat
   with integrations that haven't been migrated yet. All UI pages should pass
   ctx — only Supabase-internal triggers or data migrations may skip it.   */

export async function fetchTodos(
  ctx?: ScopeContext | null,
): Promise<TodoWithRelations[]> {
  void ctx; // the server derives scope from the session; see the file header
  try {
    const res = await fetch("/api/todos", { credentials: "include" });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        console.error("[Todos] fetchTodos:", res.status);
      }
      return [];
    }
    const json = (await res.json()) as { todos: TodoWithRelations[] };
    return json.todos;
  } catch (e) {
    console.error("[Todos] fetchTodos failed:", e);
    return [];
  }
}

/* ── Create todo ── */

export async function createTodo(input: {
  title: string;
  description?: string | null;
  priority?: "high" | "medium" | "low";
  label?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  remind_at?: string | null;
  status?: "todo" | "in_progress" | "blocked" | "done";
  recurrence?: "daily" | "weekly" | "monthly" | null;
  recurrence_until?: string | null;
  created_by_account_id?: string | null;
  assigned_by_account_id?: string | null;
  source?: "manual" | "crm" | "calendar";
  source_id?: string | null;
  assignee_account_ids?: string[];
  assigned_department?: string | null;
  assign_to_all?: boolean;
  metadata?: TodoMetadata;
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
        start_date: input.start_date,
        remind_at: input.remind_at,
        status: input.status,
        recurrence: input.recurrence,
        recurrence_until: input.recurrence_until,
        source: input.source,
        source_id: input.source_id,
        assignee_account_ids: input.assignee_account_ids,
        assigned_department: input.assigned_department,
        assign_to_all: input.assign_to_all,
        metadata: input.metadata,
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
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Todos] createTodo:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Todos] createTodo failed:", e);
    return null;
  }
}

/* ── Update todo ── */

/* ── Tell the rest of the Hub a task changed ────────────────────────────────
   Only createTodo ever announced itself, so finishing a task left the home
   badge showing the old number until the next 60s poll — which from the
   outside is a badge that "never changes". Anything that can alter how many
   tasks are open must both drop the cached count and fire the recount event
   the home page already listens for. */
async function announceTodoChange(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { invalidateCachedGet } = await import("@/lib/client-cache");
    invalidateCachedGet("/api/todos");        // the openCount badge
    invalidateCachedGet("/api/inbox/feed");   // bell + tile unread counts
  } catch { /* the event below still refreshes it */ }
  window.dispatchEvent(new CustomEvent("inbox:force-recount"));
}

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
    if (res.ok) { await announceTodoChange(); return true; }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Todos] updateTodo:", res.status);
    }
    return false;
  } catch (e) {
    console.error("[Todos] updateTodo failed:", e);
    return false;
  }
}

/* ── Toggle complete ── */

export async function toggleTodo(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todos/" + id + "/toggle", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) { await announceTodoChange(); return true; }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Todos] toggleTodo:", res.status);
    }
    return false;
  } catch (e) {
    console.error("[Todos] toggleTodo failed:", e);
    return false;
  }
}

/* ── Delete todo ── */

export async function deleteTodo(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todos/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) { await announceTodoChange(); return true; }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Todos] deleteTodo:", res.status);
    }
    return false;
  } catch (e) {
    console.error("[Todos] deleteTodo failed:", e);
    return false;
  }
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
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Todos] addTodoNote:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Todos] addTodoNote failed:", e);
    return null;
  }
}

export async function deleteTodoNote(noteId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/todo-notes/" + noteId, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Todos] deleteTodoNote:", res.status);
    }
    return false;
  } catch (e) {
    console.error("[Todos] deleteTodoNote failed:", e);
    return false;
  }
}

/* ── Labels ── */

export async function fetchTodoLabels(): Promise<TodoLabelRow[]> {
  try {
    /* Coalesced (SYS-2): two components mount together on /todo and each
       asked for labels; one shared request + 60s reuse covers both.
       createTodoLabel() below invalidates after a write. */
    const { cachedGet } = await import("@/lib/client-cache");
    const json = await cachedGet<{ labels: TodoLabelRow[] }>("/api/todo-labels", 60_000);
    return json.labels;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("HTTP 401") || msg.includes("HTTP 403")) return [];
    console.error("[Todos] fetchTodoLabels failed:", e);
    return [];
  }
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
      /* Drop the coalesced list so the next fetch shows the new label. */
      const { invalidateCachedGet } = await import("@/lib/client-cache");
      invalidateCachedGet("/api/todo-labels");
      return json.label;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Todos] createTodoLabel:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Todos] createTodoLabel failed:", e);
    return null;
  }
}

/* ── Assignable employees ── */

export async function fetchAssignableEmployees(): Promise<TodoAssigneeInfo[]> {
  /* accounts / people / koleex_employees are service-role-only (P0 lockdown),
     so /api/todos/assignees is the ONLY way to resolve this list. The legacy
     anon query that used to sit here could not have returned a row. */
  try {
    /* Coalesced (SYS-2): the picker, the filter bar and the report view each
       asked for this list on mount (measured ×4 on /todo). One request,
       60s reuse — the roster doesn't change mid-screen. */
    const { cachedGet } = await import("@/lib/client-cache");
    const json = await cachedGet<{ assignees?: TodoAssigneeInfo[] }>("/api/todos/assignees", 60_000);
    return Array.isArray(json.assignees) ? json.assignees : [];
  } catch (e) {
    console.error("[Todos] fetchAssignableEmployees failed:", e);
    return [];
  }
}

/* ── Departments ── */

export async function fetchDepartments(): Promise<string[]> {
  /* API-first for the same reason as fetchAssignableEmployees. */
  try {
    /* Same coalesced read as fetchAssignableEmployees — identical URL, so
       both helpers share one request when a screen needs both. */
    const { cachedGet } = await import("@/lib/client-cache");
    const json = await cachedGet<{ departments?: string[] }>("/api/todos/assignees", 60_000);
    return Array.isArray(json.departments) ? json.departments : [];
  } catch (e) {
    console.error("[Todos] fetchDepartments failed:", e);
    return [];
  }
}

/* ── Realtime subscription for live todo updates ── */

export function subscribeToTodos(
  onInsert: (row: TodoRow) => void,
  onChange: (row: TodoRow) => void,
  onDelete: (oldRow: { id: string }) => void,
): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let disposed = false;

  /* Build a fully-wired channel. On CHANNEL_ERROR the previous code created a
     bare `supabase.channel(topic).subscribe()` with NO handlers (and never
     reassigned it) — so after any transient error, live updates stopped and
     the dead channel leaked. Rebuild the whole subscription instead. */
  const build = () => {
    if (disposed) return;
    const topic = `todos-live-${Date.now()}`;
    channel = supabase
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
        if (status === "CHANNEL_ERROR" && !disposed) {
          setTimeout(() => {
            if (disposed || !channel) return;
            void supabase.removeChannel(channel);
            build();
          }, 3000);
        }
      });
  };

  build();

  return () => {
    disposed = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
