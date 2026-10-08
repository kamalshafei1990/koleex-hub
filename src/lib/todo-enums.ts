/* ---------------------------------------------------------------------------
   To-do vocabularies — the one place the allowed values live.

   The database CHECKs status and priority; approval_state and recurrence
   were added out-of-band as plain text. Routes used to accept whatever the
   client sent for those two, so a mistyped cadence reached the recurrence
   engine and silently fell through to its monthly branch. Every write path
   (routes, the AI tools) validates against these lists; the screens render
   from them so a new value is added once.

   Dependency-free on purpose: imported by the browser and the server.
   --------------------------------------------------------------------------- */

import type { TodoPriority, TodoRecurrence, TodoStatus } from "@/types/supabase";

export const TODO_STATUSES: readonly TodoStatus[] = ["todo", "in_progress", "blocked", "done"];
export const TODO_PRIORITIES: readonly TodoPriority[] = ["high", "medium", "low"];
export const TODO_RECURRENCES: readonly NonNullable<TodoRecurrence>[] = ["daily", "weekly", "monthly"];
export const TODO_APPROVAL_STATES = ["pending", "approved", "rejected"] as const;
export type TodoApprovalState = (typeof TODO_APPROVAL_STATES)[number];

export const isTodoStatus = (v: unknown): v is TodoStatus =>
  typeof v === "string" && (TODO_STATUSES as readonly string[]).includes(v);
export const isTodoPriority = (v: unknown): v is TodoPriority =>
  typeof v === "string" && (TODO_PRIORITIES as readonly string[]).includes(v);
export const isTodoRecurrence = (v: unknown): v is NonNullable<TodoRecurrence> =>
  typeof v === "string" && (TODO_RECURRENCES as readonly string[]).includes(v);
export const isTodoApprovalState = (v: unknown): v is TodoApprovalState =>
  typeof v === "string" && (TODO_APPROVAL_STATES as readonly string[]).includes(v);
