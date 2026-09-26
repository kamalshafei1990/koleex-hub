/* ---------------------------------------------------------------------------
   To-do writes that REPORT WHY they failed.

   lib/todo-admin's create / update / toggle / label helpers answer a bare
   true/false (or null), so the screen could only ever say "something went
   wrong" — for a lost race (409), a refused "assign to everyone" (403), an
   invalid field (400, with the server's own message) or a duplicate label
   alike. These call the same routes and return the status and message.

   After a successful write they do exactly what todo-admin's
   announceTodoChange does (bump the list's ?v= write version, drop the
   coalesced badge / inbox reads, fire the recount event), so the two paths
   cannot drift in effect. ⚠️ If todo-admin grows result-returning variants,
   switch to them and delete this file — requested in the To-do audit.
   --------------------------------------------------------------------------- */

import type { TodoLabelRow, TodoRow, TodoUpdate } from "@/types/supabase";
import { TODO_WRITE_VERSION_KEY } from "@/lib/todo-list-url";

export type WriteResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string | null };

async function announce(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const n = Number(window.localStorage.getItem(TODO_WRITE_VERSION_KEY) ?? "0") + 1;
    window.localStorage.setItem(TODO_WRITE_VERSION_KEY, String(n));
  } catch { /* private mode */ }
  try {
    const { invalidateCachedGet } = await import("@/lib/client-cache");
    invalidateCachedGet("/api/todos");
    invalidateCachedGet("/api/inbox/feed");
  } catch { /* the event below still refreshes it */ }
  window.dispatchEvent(new CustomEvent("inbox:force-recount"));
}

async function send<T>(url: string, init: RequestInit, pick: (json: Record<string, unknown>) => T, announces = true): Promise<WriteResult<T>> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, status: res.status, error: typeof json.error === "string" ? json.error : null };
    }
    if (announces) await announce();
    return { ok: true, data: pick(json) };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function patchTask(id: string, updates: TodoUpdate, newAssigneeIds?: string[]) {
  return send(`/api/todos/${id}`, {
    method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ updates, newAssigneeIds }),
  }, () => undefined);
}

/** Toggle answers with the server's resulting `completed` (when it sends it). */
export function toggleTask(id: string) {
  return send(`/api/todos/${id}/toggle`, { method: "POST" }, (j) => ({
    completed: typeof j.completed === "boolean" ? j.completed : null,
    approval: (j.approval ?? undefined) as "pending" | null | undefined,
  }));
}

export function createTask(body: Record<string, unknown>) {
  return send("/api/todos", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) },
    (j) => (j.todo ?? null) as TodoRow | null);
}

export async function createLabel(name: string, color?: string | null): Promise<WriteResult<TodoLabelRow | null>> {
  const r = await send("/api/todo-labels", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name, color }) },
    (j) => (j.label ?? null) as TodoLabelRow | null, false);
  if (r.ok) {
    try {
      const { invalidateCachedGet } = await import("@/lib/client-cache");
      invalidateCachedGet("/api/todo-labels");
    } catch { /* next load refetches */ }
  }
  return r;
}

/** Gated attachment link (redirects to a short-lived signed URL) — works for
 *  attachments saved before the bucket went private too. */
export const attachmentHref = (path: string) => `/api/todos/attachment?path=${encodeURIComponent(path)}`;
