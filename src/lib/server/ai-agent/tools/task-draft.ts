import "server-only";

/* ---------------------------------------------------------------------------
   The task draft — what createTodo will write, decided by pure code
   (tasks phase 3, 2026-09-13; TASKS_BY_AI_PLAN §2–3).

   The model extracts; this decides. Given the arguments a well-instructed
   model sends for what the user said, the people the tenant actually has,
   the caller's zone and whether they are an admin, it returns either the
   draft the tool will preview and write — times resolved in the zone, the
   reminder defaulted, people by name, the department as its colleagues
   spell it — or one named refusal with the sentence the model relays. No
   database, no clock beyond the timestamps given: the same input always
   gives the same draft, so thirty utterances in three languages can be
   proved in a suite (validate:ai-tasks) instead of asserted.
   --------------------------------------------------------------------------- */

import { resolveTaskTime, resolveTaskDay, describeWhen, hasClockTime, parseRecurrence } from "./task-time";

export type Person = { account_id: string; name: string; username: string; department: string | null };

export interface TaskDraftArgs {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  due_date?: unknown;
  remind_at?: unknown;
  start_date?: unknown;
  label?: unknown;
  recurrence?: unknown;
  recurrence_until?: unknown;
  is_private?: unknown;
  assign_to_account_ids?: unknown;
  assign_to_department?: unknown;
  assign_to_all?: unknown;
  observer_account_ids?: unknown;
  mention_account_ids?: unknown;
}

export interface TaskDraft {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  remind_at: string | null;
  start_date: string | null;
  label: string | null;
  recurrence: "daily" | "weekly" | "monthly" | null;
  recurrence_until: string | null;
  is_private: boolean;
}

export type DraftRefusal =
  | "no-title"
  | "bad-due"
  | "bad-remind"
  | "unknown-person"
  | "unknown-department"
  | "everyone-denied";

export type DraftResult =
  | {
      ok: true;
      draft: TaskDraft;
      assignees: Person[];
      observers: Person[];
      mentions: Person[];
      department: string | null;
      toAll: boolean;
      /** Who the task is for, in words; "" for the caller's own task. */
      who: string;
      when: { due: string; remind: string; start: string };
    }
  | { ok: false; refusal: DraftRefusal; permission: boolean; message: string };

/** Unique, trimmed ids from a model's array argument. Pure. */
export function idList(v: unknown): string[] {
  return Array.isArray(v) ? Array.from(new Set(v.map((x) => String(x).trim()).filter(Boolean))) : [];
}

export const UNKNOWN_PERSON_MESSAGE =
  "One or more people didn't match a real team member. Look each person up with findTeamMember and use the account_id it returns.";
export const EVERYONE_DENIED_MESSAGE =
  "You don't have permission to assign a task to everyone — that needs an admin account. I can assign it to named colleagues or to a department instead.";

/** The draft, or the one refusal. `people` is the tenant's assignable list
 *  by account id; `departments` the lower-cased department names those
 *  colleagues have. Pure. */
export function buildTaskDraft(
  args: TaskDraftArgs,
  opts: { tz: string; people: Map<string, Person>; departments: Set<string>; isAdmin: boolean },
): DraftResult {
  const title = String(args.title ?? "").trim();
  if (!title) return { ok: false, refusal: "no-title", permission: false, message: "What should the task be called? Give me a title." };
  const tz = opts.tz || "Asia/Dubai";
  const priority = (["low", "medium", "high"].includes(String(args.priority)) ? String(args.priority) : "medium") as TaskDraft["priority"];
  /* A due date alone means the end of that working day; a reminder alone,
     the start of it. */
  const dueIso = resolveTaskTime(args.due_date, tz, 17);
  if (args.due_date && !dueIso) {
    return { ok: false, refusal: "bad-due", permission: false, message: "I couldn't read that due date — give it as an ISO date or a local date and time." };
  }
  const remindIso = resolveTaskTime(args.remind_at, tz) ?? (dueIso && hasClockTime(args.due_date) ? dueIso : null);
  if (args.remind_at && !remindIso) {
    return { ok: false, refusal: "bad-remind", permission: false, message: "I couldn't read that reminder time — give it as a local date and time." };
  }
  const recurrence = parseRecurrence(args.recurrence);
  const draft: TaskDraft = {
    title,
    description: args.description ? String(args.description) : null,
    priority,
    due_date: dueIso,
    remind_at: remindIso,
    start_date: resolveTaskDay(args.start_date, tz),
    label: args.label ? String(args.label) : null,
    recurrence,
    recurrence_until: recurrence ? resolveTaskDay(args.recurrence_until, tz) : null,
    is_private: args.is_private === true,
  };

  const toAll = args.assign_to_all === true;
  if (toAll && !opts.isAdmin) return { ok: false, refusal: "everyone-denied", permission: true, message: EVERYONE_DENIED_MESSAGE };

  const assigneeIds = idList(args.assign_to_account_ids);
  const observerIds = idList(args.observer_account_ids);
  const mentionIds = idList(args.mention_account_ids);
  const everyone = [...assigneeIds, ...observerIds, ...mentionIds];
  if (everyone.some((id) => !opts.people.has(id))) {
    return { ok: false, refusal: "unknown-person", permission: false, message: UNKNOWN_PERSON_MESSAGE };
  }
  const department = typeof args.assign_to_department === "string" ? args.assign_to_department.trim() : "";
  let departmentName: string | null = null;
  if (department) {
    if (!opts.departments.has(department.toLowerCase())) {
      return {
        ok: false,
        refusal: "unknown-department",
        permission: false,
        message: `I don't know a department called "${department}". The departments I can assign to: ${Array.from(opts.departments).sort().join(", ") || "none"}.`,
      };
    }
    /* The department as its colleagues spell it. */
    departmentName =
      Array.from(opts.people.values()).find((p) => (p.department ?? "").trim().toLowerCase() === department.toLowerCase())?.department?.trim() ?? department;
  }
  const pick = (ids: string[]) => ids.map((id) => opts.people.get(id)!);
  const assignees = pick(assigneeIds);
  const observers = pick(observerIds);
  const mentions = pick(mentionIds);
  const names = (list: Person[]) => list.map((p) => p.name).join(", ");
  const who = toAll ? "everyone" : [names(assignees), departmentName ? `the ${departmentName} team` : ""].filter(Boolean).join(" and ");
  return {
    ok: true,
    draft,
    assignees,
    observers,
    mentions,
    department: departmentName,
    toAll,
    who,
    when: { due: describeWhen(draft.due_date, tz), remind: describeWhen(draft.remind_at, tz), start: draft.start_date ?? "" },
  };
}

/** The day's bounds in the caller's zone, as ISO instants — for "due
 *  today", "this week", "reminders today". Pure given `now`. */
export function dayRangeISO(tz: string, now: Date = new Date()): { startOfToday: string; endOfToday: string; endOfWeek: string } {
  const zone = tz || "Asia/Dubai";
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
  const start = resolveTaskTime(ymd, zone, 0)!;
  const startMs = Date.parse(start);
  const dayMs = 24 * 60 * 60_000;
  return {
    startOfToday: start,
    endOfToday: new Date(startMs + dayMs - 1).toISOString(),
    endOfWeek: new Date(startMs + 8 * dayMs - 1).toISOString(),
  };
}
