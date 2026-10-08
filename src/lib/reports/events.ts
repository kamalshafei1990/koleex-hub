/* ---------------------------------------------------------------------------
   Reports — the reports that events ask for (Phase 3D, owner's picks
   25 Sep 2026: all four, each owed like the daily).

     leave_handover    approved leave of 3+ days → a handover, due at the end
                       of the last working day before it starts (not asked
                       when that is under 2 hours away — too late to matter)
     leave_return      the same leave → a return plan, due at the end of the
                       first working day back
     crm_meeting       a CRM meeting marked done → a customer visit report,
                       due at the end of the next working day
     invitation_visit  an issued invitation's visitors have left → a visit
                       report by whoever issued it, same deadline
     attendance        a late or absent day, as HR's sheet reads it → a short
                       note, due at the end of that working day (the next one
                       when less than an hour is left, or the day is past)
     probation         two weeks before a probation ends → the manager's
                       confidential review, due a week before it ends

   Every deadline is on the WRITER's own calendar (their weekend, holidays,
   leave, end of day, timezone) — the obligation clock. Never due in less
   than an hour from when it is asked. Nothing before tracking starts (the
   server only scans then).

   Pure: the server gathers the facts (src/lib/server/reports/events.ts),
   validate:reports proves the rules.
   --------------------------------------------------------------------------- */

import { addDays, dayKind, escalationAt, localDayOf, type Clock, type NudgeKind, type PersonClock } from "./obligations";

export type EventRuleKey = "leave_handover" | "leave_return" | "crm_meeting" | "invitation_visit" | "attendance" | "probation";
export const EVENT_RULE_KEYS: readonly EventRuleKey[] = ["leave_handover", "leave_return", "crm_meeting", "invitation_visit", "attendance", "probation"];

/** The report each event asks for. */
export const EVENT_TEMPLATE: Record<EventRuleKey, string> = {
  leave_handover: "handover",
  leave_return: "return_plan",
  crm_meeting: "customer_visit",
  invitation_visit: "customer_visit",
  attendance: "attendance_note",
  probation: "probation_review",
};

export const EVENT_LIMITS = {
  /** Leave shorter than this asks for nothing. */
  leaveMinDays: 3,
  /** How far back a finished meeting, visit or leave is still picked up. */
  lookbackDays: 7,
  attendanceLookbackDays: 3,
  /** A probation review is asked for this many days before the end… */
  probationLeadDays: 14,
  /** …and due this many days before it. */
  probationDueBeforeDays: 7,
  /** Never due in less than this, from the moment it is asked. */
  minLeadMin: 60,
  /** A handover asked for later than this before its deadline is dropped. */
  handoverMinLeadMin: 120,
  /** Shown in "Due from you" this many days ahead of its deadline. */
  soonDays: 3,
  /** A missing one stays in "Due from you" this long. */
  missingDays: 14,
} as const;

/** What a request knows about its event — language-free facts; the words
 *  are put on when a report starts, in the writer's language. */
export type RequestFacts =
  | { rule: "leave_handover" | "leave_return"; from: string; to: string; days: number }
  | { rule: "crm_meeting"; customer: string; contact?: string; title?: string; day: string }
  | { rule: "invitation_visit"; customer: string; visitor?: string; from: string; to: string; exhibition?: string }
  | { rule: "attendance"; kind: "late" | "absent"; day: string; clockIn?: string; lateMin?: number }
  | { rule: "probation"; employee: string; endDay: string };

const ms = (iso: string) => Date.parse(iso);
const isWork = (c: PersonClock, day: string) => dayKind(c, day) === "work";
/** "25/09" — the owner's D/M. */
export const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

export interface EventDue { day: string; at: string }

/** The end of a working day on the person's clock. */
const endOf = (c: PersonClock, day: string, clock: Clock): EventDue | null => {
  const at = clock(day, c.workEnd, c.tz);
  return at ? { day, at } : null;
};
const lead = (d: EventDue | null, now: string, min: number) => !!d && ms(d.at) - ms(now) >= min * 60_000;

/** The first working day on or after `day` whose end is at least `min`
 *  minutes away. */
export function firstWorkdayFrom(c: PersonClock, day: string, now: string, clock: Clock, min: number = EVENT_LIMITS.minLeadMin): EventDue | null {
  for (let d = day, i = 0; i < 45; i++, d = addDays(d, 1)) {
    if (!isWork(c, d)) continue;
    const due = endOf(c, d, clock);
    if (lead(due, now, min)) return due;
  }
  return null;
}
export function nextWorkdayAfter(c: PersonClock, day: string): string | null {
  for (let d = addDays(day, 1), i = 0; i < 45; i++, d = addDays(d, 1)) if (isWork(c, d)) return d;
  return null;
}
export function lastWorkdayBefore(c: PersonClock, day: string): string | null {
  for (let d = addDays(day, -1), i = 0; i < 45; i++, d = addDays(d, -1)) if (isWork(c, d)) return d;
  return null;
}

/** The day a request is about (stored as its event_day). */
export function eventDayOf(f: RequestFacts): string {
  switch (f.rule) {
    case "leave_handover": return f.from;
    case "leave_return": return f.to;
    case "crm_meeting": return f.day;
    case "invitation_visit": return f.to;
    case "attendance": return f.day;
    case "probation": return f.endDay;
  }
}

/** When the report an event asks for is due on the writer's clock — or null
 *  when it is too late to ask (a handover the day the leave starts). */
export function eventDue(f: RequestFacts, c: PersonClock, now: string, clock: Clock): EventDue | null {
  const today = localDayOf(now, c.tz);
  const soonest = () => firstWorkdayFrom(c, today, now, clock);
  switch (f.rule) {
    case "leave_handover": {
      const d = lastWorkdayBefore(c, f.from);
      const due = d ? endOf(c, d, clock) : null;
      return lead(due, now, EVENT_LIMITS.handoverMinLeadMin) ? due : null;
    }
    case "leave_return": {
      const d = nextWorkdayAfter(c, f.to);
      const due = d ? endOf(c, d, clock) : null;
      return lead(due, now, EVENT_LIMITS.minLeadMin) ? due : soonest();
    }
    case "crm_meeting":
    case "invitation_visit": {
      const d = nextWorkdayAfter(c, eventDayOf(f));
      const due = d ? endOf(c, d, clock) : null;
      return lead(due, now, EVENT_LIMITS.minLeadMin) ? due : soonest();
    }
    case "attendance":
      return firstWorkdayFrom(c, f.day > today ? f.day : today, now, clock);
    case "probation": {
      const target = lastWorkdayBefore(c, addDays(f.endDay, 1 - EVENT_LIMITS.probationDueBeforeDays));
      const due = target ? endOf(c, target, clock) : null;
      if (lead(due, now, 24 * 60)) return due;
      /* Asked late (the end date was set late): the soonest working day,
         never after the probation has ended. */
      const next = soonest();
      return next && next.day <= f.endDay ? next : null;
    }
  }
}

/** A short, language-free line for lists: a name or the dates. */
export function requestSubject(f: RequestFacts): string {
  switch (f.rule) {
    case "leave_handover":
    case "leave_return": return `${dm(f.from)}–${dm(f.to)}`;
    case "crm_meeting": return f.customer;
    case "invitation_visit": return f.customer;
    case "attendance": return dm(f.day);
    case "probation": return f.employee;
  }
}

/** The sections a new report starts with, worded by `word` (the writer's
 *  dictionary). Facts only; the writer does the rest. */
export function prefillSections(f: RequestFacts, word: (key: string) => string): Record<string, string> {
  const fill = (key: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), word(key));
  switch (f.rule) {
    case "leave_handover": return { notes: fill("req.leave", { from: dm(f.from), to: dm(f.to), days: f.days }) };
    case "leave_return": return { away: fill("req.leave", { from: dm(f.from), to: dm(f.to), days: f.days }) };
    case "crm_meeting": return {
      who: f.contact ? `${f.customer} — ${f.contact}` : f.customer,
      purpose: f.title ? `${f.title} (${dm(f.day)})` : dm(f.day),
    };
    case "invitation_visit": return {
      who: f.visitor ? `${f.customer} — ${f.visitor}` : f.customer,
      purpose: `${fill("req.visit", { from: dm(f.from), to: dm(f.to) })}${f.exhibition ? ` · ${f.exhibition}` : ""}`,
    };
    case "attendance": return {
      what: f.kind === "late"
        ? fill("req.late", { day: dm(f.day), time: f.clockIn ?? "—", min: f.lateMin ?? 0 })
        : fill("req.absent", { day: dm(f.day) }),
    };
    case "probation": return { employee: fill("req.probation", { name: f.employee, day: dm(f.endDay) }) };
  }
}

/* ── A request's life after it is asked ─────────────────────────────── */

/** A report written for a request carries this in period_key — the field a
 *  daily uses for its day — so every later version stays linked. */
export const requestPeriodKey = (id: string) => `req:${id}`;
export const requestIdOf = (periodKey: string | null | undefined): string | null =>
  periodKey && /^req:[0-9a-f-]{36}$/i.test(periodKey) ? periodKey.slice(4) : null;

export const REQUEST_COLS = "id, template_key, rule_key, subject, event_day, due_day, due_at, status, sent_at, report_id, reminded_at, escalated_at, created_at";

export interface RequestRow {
  id: string;
  template_key: string;
  rule_key: EventRuleKey;
  subject: string;
  event_day: string;
  due_day: string;
  due_at: string;
  status: "open" | "cancelled";
  sent_at: string | null;
  report_id: string | null;
  reminded_at: string | null;
  escalated_at: string | null;
  created_at: string;
}

export type RequestState = "sent" | "late" | "missing" | "due" | "cancelled";
export function requestState(r: Pick<RequestRow, "status" | "sent_at" | "due_at">, now: string): RequestState {
  if (r.sent_at) return ms(r.sent_at) > ms(r.due_at) ? "late" : "sent";
  if (r.status === "cancelled") return "cancelled";
  return ms(now) > ms(r.due_at) ? "missing" : "due";
}

/** Whether "Due from you" lists it: due within `soonDays`, or missing for
 *  less than `missingDays`. */
export function requestIsOwed(r: Pick<RequestRow, "status" | "sent_at" | "due_at">, now: string): boolean {
  const s = requestState(r, now);
  const gap = ms(r.due_at) - ms(now);
  if (s === "due") return gap <= EVENT_LIMITS.soonDays * 86_400_000;
  if (s === "missing") return -gap <= EVENT_LIMITS.missingDays * 86_400_000;
  return false;
}

/** The reminder (an hour before the deadline, unless it was asked less than
 *  90 minutes before it — the ask itself said so) and the escalation (the
 *  end of the next working day, like a weekly), each only inside its window
 *  and only if not yet claimed. */
export function requestNudges(r: RequestRow, c: PersonClock, now: string, clock: Clock): Array<{ kind: NudgeKind; at: string }> {
  if (r.sent_at || r.status === "cancelled") return [];
  const t = ms(now);
  const out: Array<{ kind: NudgeKind; at: string }> = [];
  const remindAt = ms(r.due_at) - 60 * 60_000;
  if (!r.reminded_at && t >= remindAt && t < ms(r.due_at) && ms(r.created_at) < remindAt - 30 * 60_000) {
    out.push({ kind: "reminder", at: new Date(remindAt).toISOString() });
  }
  const esc = escalationAt(c, "weekly", { day: r.due_day, at: r.due_at }, clock);
  if (!r.escalated_at && esc && t >= ms(esc) && t < ms(esc) + 6 * 60 * 60_000) out.push({ kind: "escalation", at: esc });
  return out;
}
