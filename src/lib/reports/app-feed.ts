/* ---------------------------------------------------------------------------
   Reports — fill from the apps (Phase 2B, owner's pick 25 Sep 2026).

   A report also starts from what its author DID in the Hub during its
   period: the meetings in their calendar, the to-dos and project tasks they
   finished or still have open, the quotations, invoices and orders they
   made, their customer calls and visits. Like the carry-over, these come
   back as SUGGESTIONS the author taps into place; nothing is written into a
   report by itself.

   Split in two on purpose:
   · the SERVER reads raw facts (AppRecord) for the author only, over a
     generous UTC window around the period (src/lib/server/reports/app-feed.ts);
   · the BROWSER decides what falls on the author's own calendar day and
     words each fact in the author's language (formatAppRecord) — the day a
     10 pm Shanghai meeting belongs to is only known where the clock is, and
     "Quotation QU-26-0012 to Nour Textiles" must read in Arabic for an
     Arabic writer.
   Pure; validate:reports checks every rule and every scenario below.
   --------------------------------------------------------------------------- */

import { periodFor, reportTemplate, type ReportCadence, type ReportPeriod } from "./templates";
import type { CarryGroup, CarryItem } from "./carry";

export type AppSource = "calendar" | "todos" | "tasks" | "planning" | "quotations" | "invoices" | "orders" | "crm";
export const APP_SOURCES: AppSource[] = ["calendar", "todos", "tasks", "planning", "quotations", "invoices", "orders", "crm"];

/** One fact from an app, as the server hands it over. */
export interface AppRecord {
  source: AppSource;
  id: string;
  /** scheduled = a meeting / an activity in the diary · done = finished or
   *  issued · open = still to do. */
  state: "scheduled" | "done" | "open";
  /** When it counts: an ISO instant (a meeting's start, when a task was
   *  finished, when a quotation was made) or a calendar date (a due date). */
  at: string;
  /** A meeting's end (ISO), when known. */
  end?: string | null;
  allDay?: boolean;
  /** The title, the task, or the document's number. */
  title: string;
  /** The customer, the project, or who else was there. */
  who?: string | null;
  /** A CRM activity's type ("call", "meeting", "visit"…). */
  kind?: string | null;
}

export interface AppRule {
  /** Which list this is, for its heading (feed.g.<group>). */
  group: "meetings" | "done" | "open" | "tomorrow" | "due" | "next";
  sources: AppSource[];
  state: Array<AppRecord["state"]>;
  /** period = inside the report's period (an open item: due by its end,
   *  overdue included) · next = the period right after it (tomorrow, next
   *  week). */
  when: "period" | "next";
  /** Where an item may go in the report, the likeliest first. */
  to: string[];
}

export const APP_RULES: Record<string, AppRule[]> = {
  daily: [
    { group: "meetings", sources: ["calendar", "crm"], state: ["scheduled"], when: "period", to: ["meetings"] },
    { group: "done", sources: ["todos", "tasks", "quotations", "invoices", "orders", "crm"], state: ["done"], when: "period", to: ["done"] },
    { group: "open", sources: ["todos", "tasks"], state: ["open"], when: "period", to: ["pending"] },
    { group: "tomorrow", sources: ["calendar", "todos", "tasks"], state: ["scheduled", "open"], when: "next", to: ["tomorrow"] },
  ],
  weekly_plan: [
    { group: "meetings", sources: ["calendar", "crm"], state: ["scheduled"], when: "period", to: ["meetings"] },
    { group: "due", sources: ["todos", "tasks", "planning"], state: ["open"], when: "period", to: ["deadlines", "goals"] },
  ],
  weekly: [
    { group: "meetings", sources: ["calendar", "crm"], state: ["scheduled"], when: "period", to: ["meetings"] },
    { group: "done", sources: ["todos", "tasks", "quotations", "invoices", "orders", "crm"], state: ["done"], when: "period", to: ["summary", "projects"] },
    { group: "next", sources: ["calendar", "todos", "tasks", "planning"], state: ["scheduled", "open"], when: "next", to: ["next_week"] },
  ],
  monthly: [
    { group: "done", sources: ["tasks", "quotations", "invoices", "orders"], state: ["done"], when: "period", to: ["summary", "projects"] },
  ],
};

/** The sources a report type reads at all — the server skips the rest. */
export function feedSources(templateKey: string): AppSource[] {
  const set = new Set<AppSource>();
  for (const r of APP_RULES[templateKey] ?? []) for (const s of r.sources) set.add(s);
  return APP_SOURCES.filter((s) => set.has(s));
}

const pad = (n: number) => String(n).padStart(2, "0");
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The period right after this one (tomorrow; next week; next month). */
export function nextPeriod(cadence: ReportCadence, period: ReportPeriod): ReportPeriod {
  return periodFor(cadence, addDays(period.end, 1));
}

/** The UTC instants the server reads between: the period and the one after
 *  it, widened by a day each side so every timezone's calendar day is in. */
export function feedWindow(cadence: ReportCadence, period: ReportPeriod): { from: string; to: string } {
  const next = nextPeriod(cadence, period);
  return { from: `${addDays(period.start, -1)}T00:00:00.000Z`, to: `${addDays(next.end, 2)}T00:00:00.000Z` };
}

/** The author's own calendar day of a fact. A bare date is already a day;
 *  an instant is read on the author's clock (`tzOffsetMin` = minutes EAST of
 *  UTC, i.e. -new Date().getTimezoneOffset()). */
export function localDay(at: string, tzOffsetMin: number): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return at;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + tzOffsetMin * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Day first, then the day-long items (a due date, an all-day event), then
 *  the timed ones by their clock. */
const orderKey = (r: AppRecord, tzOffsetMin: number) =>
  `${localDay(r.at, tzOffsetMin)}${/^\d{4}-\d{2}-\d{2}$/.test(r.at) || r.allDay ? " " : `T${new Date(Date.parse(r.at)).toISOString()}`}`;

/** Which records a rule takes, in the order of the author's days. `period` =
 *  inside it; an OPEN item counts when it was due by the period's end
 *  (overdue included); `next` = inside the following period. */
export function recordsFor(rule: AppRule, records: AppRecord[], window: { period: ReportPeriod; next: ReportPeriod }, tzOffsetMin: number): AppRecord[] {
  const out = records.filter((r) => {
    if (!rule.sources.includes(r.source) || !rule.state.includes(r.state)) return false;
    const day = localDay(r.at, tzOffsetMin);
    if (!day) return false;
    if (rule.when === "next") return day >= window.next.start && day <= window.next.end;
    if (r.state === "open") return day <= window.period.end;
    return day >= window.period.start && day <= window.period.end;
  });
  return out
    .map((r) => ({ r, k: orderKey(r, tzOffsetMin) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.r);
}

/** Words a record in the author's language, with a short tag for the card
 *  (which app, and the time or day). `fmt` supplies the dictionary and the
 *  clock. */
export interface FeedFormatter {
  t: (key: string) => string;
  /** "10:00" on the author's clock. */
  time: (iso: string) => string;
  /** "25/09" for a day. */
  day: (ymd: string) => string;
  tzOffsetMin: number;
}

export function formatAppRecord(r: AppRecord, f: FeedFormatter): { text: string; tag: string } {
  const fill = (key: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), f.t(key)).replace(/\s+·\s+$/, "").trim();
  const who = (r.who ?? "").trim();
  const timed = !/^\d{4}-\d{2}-\d{2}$/.test(r.at) && !r.allDay;
  const when = timed ? (r.end ? `${f.time(r.at)}–${f.time(r.end)}` : f.time(r.at)) : f.day(localDay(r.at, f.tzOffsetMin));
  switch (r.source) {
    case "calendar":
      return { text: timed ? `${when} ${r.title}` : r.title, tag: `${f.t("feed.src.calendar")} · ${when}` };
    case "crm": {
      const kind = r.kind && f.t(`feed.crm.${r.kind}`) !== `feed.crm.${r.kind}` ? f.t(`feed.crm.${r.kind}`) : f.t("feed.crm.other");
      const text = who ? fill("feed.fmt.crm", { kind, who, title: r.title }) : `${kind}: ${r.title}`;
      return { text: text.replace(/:\s*$/, ""), tag: `${f.t("feed.src.crm")} · ${when}` };
    }
    case "tasks":
      return { text: who ? `${who}: ${r.title}` : r.title, tag: f.t("feed.src.tasks") };
    case "todos":
      return { text: r.title, tag: f.t("feed.src.todos") };
    case "planning":
      return { text: r.title, tag: `${f.t("feed.src.planning")} · ${when}` };
    case "quotations":
    case "invoices":
    case "orders":
      return { text: who ? fill(`feed.fmt.${r.source}`, { number: r.title, who }) : fill(`feed.fmt.${r.source}.bare`, { number: r.title }), tag: f.t(`feed.src.${r.source}`) };
  }
}

/** The card's groups for a draft: every rule of its type, the records that
 *  fall on the author's days, each worded, each line offered once. */
export function buildFeedGroups(templateKey: string, period: ReportPeriod, records: AppRecord[], f: FeedFormatter): CarryGroup[] {
  const tpl = reportTemplate(templateKey);
  const rules = APP_RULES[templateKey];
  if (!tpl || !rules?.length) return [];
  const window = { period, next: nextPeriod(tpl.cadence, period) };
  const seen = new Set<string>();
  const out: CarryGroup[] = [];
  for (const rule of rules) {
    const to = rule.to.filter((sid) => tpl.sections.some((s) => s.id === sid));
    if (!to.length) continue;
    const items: CarryItem[] = [];
    for (const r of recordsFor(rule, records, window, f.tzOffsetMin)) {
      const key = `${r.source}:${r.id}:${rule.group}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { text, tag } = formatAppRecord(r, f);
      if (!text.trim()) continue;
      items.push({ text, paragraph: false, date: null, tag });
      if (items.length >= 40) break;
    }
    if (items.length) out.push({ from: "apps", section: rule.group, to, sources: [], items, app: true });
  }
  return out;
}
