/* ---------------------------------------------------------------------------
   To-do screen vocabulary — the value lists come from lib/todo-enums (the
   one place the allowed values live); this file only adds how each looks.
   Labels are always t("p." + value) / t("st." + value) / t("rec." + value).
   --------------------------------------------------------------------------- */

import type { TodoPriority, TodoStatus, TodoWithRelations } from "@/types/supabase";
import { TODO_PRIORITIES, TODO_RECURRENCES, TODO_STATUSES } from "@/lib/todo-enums";

export type TFn = (key: string, fallback?: string) => string;

export const PRIORITIES = TODO_PRIORITIES;
export const STATUSES = TODO_STATUSES;
export const RECURRENCES = [null, ...TODO_RECURRENCES] as const;

export const PRIORITY_TEXT: Record<TodoPriority, string> = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-[#7FA9D6]",
};
/** Selected pill for a priority choice. */
export const PRIORITY_ON: Record<TodoPriority, string> = {
  high: "bg-red-500/15 border-red-500/30 text-red-400",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
  low: "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#7FA9D6]",
};
export const PRIORITY_RANK: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

export const STATUS_DOT: Record<TodoStatus, string> = {
  todo: "bg-[var(--text-dim)]",
  in_progress: "bg-[#7FA9D6]",
  blocked: "bg-red-400",
  done: "bg-green-400",
};

export const statusOf = (t: TodoWithRelations): TodoStatus =>
  (t.status ?? (t.completed ? "done" : "todo")) as TodoStatus;

/** Initials for an avatar fallback. */
export function initials(name: string | null | undefined, username?: string | null): string {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (username ?? "").slice(0, 2).toUpperCase() || "?";
}

/** Did this viewer create, assign or receive the task? */
export function involves(t: TodoWithRelations, id: string): boolean {
  return (
    t.created_by_account_id === id ||
    t.assigned_by_account_id === id ||
    t.assignees.some((a) => a.account_id === id)
  );
}

/* Shared class strings — one definition so the pills, fields and chips of
   the list, the filter sheet and the task form cannot drift apart. */
export const PILL = "h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border whitespace-nowrap flex items-center gap-1.5";
export const PILL_ON = "kx-seg-on border-transparent text-[var(--text-primary)]";
export const PILL_OFF = "bg-transparent border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]";
export const FIELD_LABEL = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";
export const INPUT = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
export const CHOICE = "rounded-lg text-[11px] font-semibold transition-colors border flex items-center justify-center gap-1.5";
export const CHOICE_ON = "bg-[var(--bg-surface-active)] border-[var(--border-color)] text-[var(--text-primary)]";
export const CHOICE_OFF = "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]";
export const SELECT_TRIGGER = "h-9 w-full ps-3 pe-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none cursor-pointer text-start";
