/* ---------------------------------------------------------------------------
   todoListUrl — the EXACT URL the To-do app's fetchTodos requests.

   Lives in its own dependency-free module on purpose: Home's hover prefetch
   imports it to warm the same HTTP-cache key, and importing it from
   todo-admin.ts dragged the whole supabase-js client into the home entry
   chunk (boot budget guard caught it: 1295 KB > 1160 KB). Nothing in here
   may import anything.

   ?v=<write version> — every To-do write bumps kx_todo_write_v, which busts
   the list's 30-second HTTP cache (see todo-admin's bumpTodoWriteVersion).
   A prefetch without the same ?v= would be a different cache key and pure
   wasted download.
   --------------------------------------------------------------------------- */

export const TODO_WRITE_VERSION_KEY = "kx_todo_write_v";

export function todoWriteVersion(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TODO_WRITE_VERSION_KEY) ?? "0";
  } catch {
    return "0";
  }
}

export function todoListUrl(): string {
  return `/api/todos?v=${todoWriteVersion()}`;
}
