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
import { fetchAssignableEmployees, fetchCompletedTodos, fetchDepartments, fetchTodoLabels } from "@/lib/todo-admin";
import { todoListUrl, todoOpenListUrl } from "@/lib/todo-list-url";
import { writeWarm } from "@/lib/warm-cache";

export interface TodoSnap {
  /** The OPEN set (not done, or done in the last 24 h) — the warm copy. */
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

/* THE LIST LOADS THE OPEN SET ONLY: every task not yet done, plus those
   finished in the last 24 h (so a tick you just made does not vanish).
   Finished history is paged separately, newest first, and only when someone
   opens it — it is usually most of the rows and none of the day's work. */
function listUrl(query: string): string {
  const base = todoListUrl(); // "/api/todos?v=<write version>"
  return `${base}${base.includes("?") ? "&" : "?"}${query}`;
}

/* Not todo-admin's fetchOpenTodos: a refresh triggered by someone else's
   write (the realtime ping) must bypass the HTTP cache, which our ?v= write
   version does not move, and the screen wants `truncated`. */
async function getList(url: string, revalidate: boolean) {
  /* ?v=<write version> busts the route's 30 s HTTP cache after OUR writes;
     `no-cache` covers a refresh triggered by someone ELSE's write (the
     realtime ping), which does not move our version. */
  const res = await fetch(url, { credentials: "include", cache: revalidate ? "no-cache" : "default" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { todos?: TodoWithRelations[]; truncated?: boolean };
  return { todos: Array.isArray(json.todos) ? json.todos : [], truncated: json.truncated === true };
}

export async function loadOpenTodos(revalidate = false) {
  return getList(todoOpenListUrl(), revalidate);
}

export const DONE_PAGE = 50;

/** One page of finished tasks, newest first by completed_at. */
export async function loadCompletedPage(before: string | null, limit = DONE_PAGE) {
  const page = await fetchCompletedTodos({ limit, before });
  /* Only finished rows, whatever the server sent. */
  return { todos: page.todos.filter((x) => x.completed), nextBefore: page.nextBefore };
}

/** Every task finished on or after `since` (a YYYY-MM-DD day, local), or all
 *  history when null — paged until the cursor passes it, with a hard cap. */
export async function loadCompletedSince(since: string | null, maxPages = 20): Promise<{ todos: TodoWithRelations[]; complete: boolean }> {
  const out: TodoWithRelations[] = [];
  let before: string | null = null;
  const sinceMs = since ? new Date(`${since}T00:00:00`).getTime() : null;
  for (let i = 0; i < maxPages; i++) {
    const page = await loadCompletedPage(before, 200);
    out.push(...page.todos);
    if (!page.nextBefore) return { todos: out, complete: true };
    if (sinceMs !== null && new Date(page.nextBefore).getTime() < sinceMs) return { todos: out, complete: true };
    before = page.nextBefore;
  }
  return { todos: out, complete: false };
}

export async function loadTodoSnap(revalidate = false): Promise<TodoSnap> {
  const [{ todos, truncated }, employees, departments, labels] = await Promise.all([
    loadOpenTodos(revalidate),
    fetchAssignableEmployees(),
    fetchDepartments(),
    fetchTodoLabels(),
  ]);
  return { todos, truncated, employees, departments, labels };
}

/** Merge the open set with loaded history — one row per id, open set wins. */
export function mergeTodos(open: TodoWithRelations[], done: TodoWithRelations[]): TodoWithRelations[] {
  if (done.length === 0) return open;
  const seen = new Set(open.map((x) => x.id));
  return [...open, ...done.filter((x) => !seen.has(x.id))];
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
