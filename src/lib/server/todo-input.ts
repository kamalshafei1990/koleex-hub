import "server-only";

/* ---------------------------------------------------------------------------
   todo-input — what a client may write to a task, checked once.

   The create route validated status/priority/recurrence and passed the rest
   straight to the insert; the PATCH route deleted a short deny-list and
   passed EVERYTHING else through. So an unparseable date, a non-object
   metadata, an unknown column or a 3 MB title reached Postgres and came back
   as a 500 "Failed to update" — and an owner could write any column not on
   the deny-list (completed without status, source, assigned_by…). Now both
   routes read an ALLOW-list through this one function: known fields are
   type-checked and normalised, unknown ones are dropped (old clients still
   send approved_by / approved_at, which the server stamps itself).
   --------------------------------------------------------------------------- */

import { isTodoApprovalState, isTodoPriority, isTodoRecurrence, isTodoStatus } from "@/lib/todo-enums";

const TODO_TITLE_MAX = 500;
const TODO_TEXT_MAX = 20_000;
export const TODO_NOTE_MAX = 10_000;

const SOURCES = new Set(["manual", "crm", "calendar"]);

/** The columns a client may set. Everything else is decided by the server. */
type Writable =
  | "title" | "description" | "priority" | "label" | "status"
  | "due_date" | "start_date" | "remind_at" | "recurrence" | "recurrence_until"
  | "assigned_department" | "assign_to_all" | "is_private" | "metadata"
  | "approval_state" | "completed" | "source" | "source_id";

export type TodoFieldsResult =
  | { ok: true; fields: Partial<Record<Writable, unknown>> }
  | { ok: false; error: string };

const isDateish = (v: string) => Number.isFinite(Date.parse(v));

/** Normalise the writable fields present in `input`. Absent keys stay
 *  absent (a PATCH touches only what it names); "" on a nullable field
 *  means null, as the forms send it. */
export function readTodoFields(input: Record<string, unknown>): TodoFieldsResult {
  const out: Partial<Record<Writable, unknown>> = {};
  const has = (k: Writable) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined;
  const nullableText = (k: Writable, max: number): string | null => {
    const v = input[k];
    if (v === null || v === "") return (out[k] = null);
    if (typeof v !== "string") throw new Error(`${k} must be text`);
    const t = k === "description" ? v : v.trim();
    if (t.length > max) throw new Error(`${k} is too long`);
    return (out[k] = t || null) as string | null;
  };
  const nullableDate = (k: Writable) => {
    const v = input[k];
    if (v === null || v === "") { out[k] = null; return; }
    if (typeof v !== "string" || !isDateish(v)) throw new Error(`${k} is not a valid date`);
    out[k] = v;
  };
  const bool = (k: Writable) => {
    if (typeof input[k] !== "boolean") throw new Error(`${k} must be true or false`);
    out[k] = input[k];
  };

  try {
    if (has("title")) {
      const v = input.title;
      if (typeof v !== "string" || !v.trim()) throw new Error("Title is required");
      if (v.trim().length > TODO_TITLE_MAX) throw new Error("Title is too long");
      out.title = v.trim();
    }
    if (has("description")) nullableText("description", TODO_TEXT_MAX);
    if (has("label")) nullableText("label", 100);
    if (has("assigned_department")) nullableText("assigned_department", 200);
    if (has("source_id")) nullableText("source_id", 200);
    if (has("priority")) {
      if (!isTodoPriority(input.priority)) throw new Error("Invalid priority");
      out.priority = input.priority;
    }
    if (has("status")) {
      if (!isTodoStatus(input.status)) throw new Error("Invalid status");
      out.status = input.status;
    }
    if (has("recurrence")) {
      if (input.recurrence !== null && !isTodoRecurrence(input.recurrence)) throw new Error("Invalid recurrence");
      out.recurrence = input.recurrence;
    }
    if (has("approval_state")) {
      if (input.approval_state !== null && !isTodoApprovalState(input.approval_state)) throw new Error("Invalid approval state");
      out.approval_state = input.approval_state;
    }
    if (has("source")) {
      if (typeof input.source !== "string" || !SOURCES.has(input.source)) throw new Error("Invalid source");
      out.source = input.source;
    }
    for (const k of ["due_date", "start_date", "remind_at", "recurrence_until"] as const) {
      if (has(k)) nullableDate(k);
    }
    for (const k of ["assign_to_all", "is_private", "completed"] as const) {
      if (has(k)) bool(k);
    }
    if (has("metadata")) {
      const m = input.metadata;
      if (m === null || typeof m !== "object" || Array.isArray(m)) throw new Error("metadata must be an object");
      out.metadata = m;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input" };
  }
  return { ok: true, fields: out };
}

/** An id list from the client: strings only, de-duplicated. Anything that
 *  is not an array is a 400 at the caller. */
export function readIdList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  return Array.from(new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0)));
}
