/* ---------------------------------------------------------------------------
   To-do data — the one load the list and the report share, and the warm
   snapshot both paint from.

   Why not fetchTodos(): it answers [] for EVERY failure (a 500, a dropped
   connection). The list took that as the truth, painted "No tasks yet" and
   then saved the empty list as the warm snapshot — one bad request blanked
   the screen and the next open too. This load throws instead, so a failure
   keeps what is on screen and shows a retry.
   --------------------------------------------------------------------------- */

import type { TodoAssigneeInfo, TodoLabelRow, TodoWithRelations } from "@/types/supabase";
import { fetchAssignableEmployees, fetchDepartments, fetchTodoLabels } from "@/lib/todo-admin";
import { todoListUrl } from "@/lib/todo-list-url";
import { writeWarm } from "@/lib/warm-cache";

export interface TodoSnap {
  todos: TodoWithRelations[];
  /** The server stopped at its safety cap — older tasks exist but were not sent. */
  truncated?: boolean;
  employees: TodoAssigneeInfo[];
  departments: string[];
  labels: TodoLabelRow[];
}

/** The warm-cache key — per account, so a shared browser never paints one
 *  person's tasks to the next. Empty (= not warmed) until the id is known. */
export const todoWarmKey = (accountId: string | null) => (accountId ? `todo:list:${accountId}` : "");

export async function loadTodoList(revalidate = false): Promise<TodoWithRelations[]> {
  return (await loadTodoPage(revalidate)).todos;
}

async function loadTodoPage(revalidate: boolean): Promise<{ todos: TodoWithRelations[]; truncated: boolean }> {
  /* ?v=<write version> busts the route's 30 s HTTP cache after OUR writes;
     `no-cache` covers a refresh triggered by someone ELSE's write (the
     realtime ping), which does not move our version. */
  const res = await fetch(todoListUrl(), { credentials: "include", cache: revalidate ? "no-cache" : "default" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { todos?: TodoWithRelations[]; truncated?: boolean };
  return { todos: Array.isArray(json.todos) ? json.todos : [], truncated: json.truncated === true };
}

export async function loadTodoSnap(revalidate = false): Promise<TodoSnap> {
  const [{ todos, truncated }, employees, departments, labels] = await Promise.all([
    loadTodoPage(revalidate),
    fetchAssignableEmployees(),
    fetchDepartments(),
    fetchTodoLabels(),
  ]);
  return { todos, truncated, employees, departments, labels };
}

/* The warm copy only has to paint the first screens; the refresh brings the
   rest. The store refuses entries over ~500 KB, so a large list is trimmed
   until it fits instead of silently not being saved at all. */
const WARM_BUDGET = 440_000;
export function saveTodoWarm(key: string, snap: TodoSnap): void {
  if (!key) return;
  let rows = Math.min(snap.todos.length, 300);
  for (let i = 0; i < 4; i++) {
    const candidate = { ...snap, todos: snap.todos.slice(0, rows) };
    if (JSON.stringify(candidate).length <= WARM_BUDGET || rows <= 25) {
      writeWarm(key, candidate);
      return;
    }
    rows = Math.floor(rows / 2);
  }
}
