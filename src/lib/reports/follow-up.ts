/* ---------------------------------------------------------------------------
   Reports — a report becomes work (Phase 6A, owner's picks 27 Sep 2026).
   Pure: the routes, the reader and validate:reports share it.

   FORWARD — someone who can read a report sends it on to people who were not
   on it, with a note. They become copy readers (role 'cc'): they read it,
   comment and acknowledge it, and never approve or return it. A CONFIDENTIAL
   report is forwarded by its author only; a draft, or a version a newer one
   replaced, is never forwarded. A forward is for that version: a new version
   goes to the readers its author chose.

   A TASK FROM A LINE — a reader who may create To-do tasks turns a line of
   the report (or anything they write) into a To-do task for someone. The
   task says which report it came from, and the report shows its tasks — to
   each reader only the tasks To-do itself shows them (lib/server/todo-scope),
   a count for the rest. From a confidential report a task goes only to
   someone who can already read it, unless its author makes it: the author
   could forward it anyway, and nobody else may carry its words further.
   --------------------------------------------------------------------------- */

import type { ReportSectionValue } from "./templates";

export const FOLLOW_UP_LIMITS = { forwardPeople: 10, note: 500, taskTitle: 200, taskPeople: 10 } as const;

export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ForwardFacts {
  status: "draft" | "submitted" | "approved" | "returned";
  superseded: boolean;
  confidential: boolean;
  /** The viewer wrote it. */
  isAuthor: boolean;
}

/** May a reader forward this report? (That they can read it is the
 *  caller's check — loadForViewer.) */
export function mayForward(f: ForwardFacts): boolean {
  if (f.status === "draft" || f.superseded) return false;
  return f.confidential ? f.isAuthor : true;
}

/** The people a forward adds: known staff only, never the author or someone
 *  already on the report, each once, at most FOLLOW_UP_LIMITS.forwardPeople. */
export function forwardTargets(ids: unknown, o: { staff: Set<string>; authorId: string; already: Set<string> }): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const v of ids) {
    if (typeof v !== "string" || !o.staff.has(v) || v === o.authorId || o.already.has(v) || out.includes(v)) continue;
    out.push(v);
    if (out.length === FOLLOW_UP_LIMITS.forwardPeople) break;
  }
  return out;
}

/** A forward's note, as it is kept: trimmed, at most FOLLOW_UP_LIMITS.note. */
export function forwardNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, FOLLOW_UP_LIMITS.note);
  return s || null;
}

/** May a task from this report go to these people? `readers` = its author
 *  and everyone on it (a forwarded reader included). */
export function taskPeopleAllowed(f: { confidential: boolean; isAuthor: boolean; readers: Set<string> }, people: string[]): boolean {
  if (!f.confidential || f.isAuthor) return true;
  return people.every((p) => f.readers.has(p));
}

/** The line a task is made from: an item of a list section, as this version
 *  of the report holds it (a sent report never changes, so the index holds). */
export function reportLine(sections: ReportSectionValue[], line: unknown): { section: string; item: number; text: string } | null {
  if (!line || typeof line !== "object") return null;
  const { section, item } = line as { section?: unknown; item?: unknown };
  if (typeof section !== "string" || typeof item !== "number" || !Number.isInteger(item) || item < 0) return null;
  const text = sections.find((s) => s.id === section)?.items?.[item];
  return typeof text === "string" && text.trim() ? { section, item, text: text.trim() } : null;
}

/** A task's title, as it is kept: one line, trimmed, at most
 *  FOLLOW_UP_LIMITS.taskTitle characters. */
export function taskTitle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, FOLLOW_UP_LIMITS.taskTitle);
  return s || null;
}

/** A task's due day: a real calendar day (YYYY-MM-DD), or none. */
export function taskDue(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** A task made from a report, as the report shows it. */
export interface ReportTask {
  id: string;
  /** The version of the report it was made from (tasks from an earlier
   *  version still show on the newer one). */
  reportId: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  approval: "pending" | "approved" | "rejected" | null;
  due: string | null;
  people: Array<{ id: string; name: string; avatar: string | null }>;
  line: { section: string; item: number } | null;
}
