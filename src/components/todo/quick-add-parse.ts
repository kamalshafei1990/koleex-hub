/* ---------------------------------------------------------------------------
   Quick-add parsing — "Call the supplier tomorrow !high #Sales" becomes a
   title, a due day, a priority and a label, so capturing a task is one line
   and Enter instead of a form.

   Deliberately small and predictable: only a handful of unambiguous words
   are recognised, each is removed from the title, and the screen shows what
   was understood before the task is saved. Dates are DAY-FIRST (the Hub's
   D/M/Y rule): "5/10" is the 5th of October.

   Words understood (English, 中文, العربية):
     today · tomorrow · day after tomorrow · monday…sunday (next occurrence;
     "next monday" = Monday of next week; mon…sun only after "on" / "next") · next week (Monday) · in 3 days / 2 weeks ·
     5/10 · 5/10/2026 · 5 oct · 今天 明天 后天 周一…周日 下周 · اليوم غدا بعد غد
   Times: 3pm · 3:30pm · 15:30 · at 3 · 下午3点 · 上午10点半 · 3 مساء · 10 صباحا
     (a time without a day is today, or tomorrow once that hour has passed)
   Priority: !high !med !low, !1 !2 !3, p1 p2 p3, !高 !中 !低
   Label: #name — only when a label with that name already exists.
   People: @name — only when exactly one colleague answers to it (their
     username, first name or full name without spaces).
   --------------------------------------------------------------------------- */

import type { TodoPriority } from "@/types/supabase";
import { isoDay } from "./todo-dates";

export interface QuickParse {
  title: string;
  /** "YYYY-MM-DD" — the day. */
  due: string | null;
  /** "HH:MM" (24 h) when a time was written. */
  time: string | null;
  priority: TodoPriority | null;
  label: string | null;
  /** account ids of the colleagues named with @. */
  people: string[];
}

/** Who can be named with @ in the quick line. */
export interface QuickPerson {
  account_id: string;
  username: string;
  full_name: string | null;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const ZH_WEEKDAYS: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const PRIORITY: Record<string, TodoPriority> = {
  "!high": "high", "!h": "high", "!1": "high", p1: "high", "!高": "high", "!urgent": "high",
  "!medium": "medium", "!med": "medium", "!m": "medium", "!2": "medium", p2: "medium", "!中": "medium",
  "!low": "low", "!l": "low", "!3": "low", p3: "low", "!低": "low",
};

function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}
/* "friday" = the coming Friday (a week on if today is Friday).
   "next friday" = Friday of NEXT calendar week (weeks start Monday). */
function nextWeekday(base: Date, dow: number, nextWeek: boolean): Date {
  if (nextWeek) {
    const monday = addDays(base, -((base.getDay() + 6) % 7));
    return addDays(monday, 7 + ((dow + 6) % 7));
  }
  let diff = (dow - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(base, diff);
}
/** A day/month without a year: this year, or next year once it has passed. */
function dayMonth(base: Date, day: number, month: number, year?: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  let y = year ?? base.getFullYear();
  if (y < 100) y += 2000;
  let d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // 31/02
  if (year === undefined && d < addDays(base, 0)) d = new Date(y + 1, month, day);
  return d;
}

/* Each rule: a pattern over the whole text and how to turn the match into a day. */
type Rule = { re: RegExp; day: (m: RegExpMatchArray, now: Date) => Date | null };
const DATE_RULES: Rule[] = [
  { re: /(^|\s)(day after tomorrow|后天|بعد غد)(?=\s|$)/i, day: (_m, n) => addDays(n, 2) },
  { re: /(^|\s)(today|今天|今日|اليوم)(?=\s|$)/i, day: (_m, n) => addDays(n, 0) },
  { re: /(^|\s)(tomorrow|tmrw|tmr|明天|明日|غدا|غدًا|غداً)(?=\s|$)/i, day: (_m, n) => addDays(n, 1) },
  { re: /(^|\s)(next week|下周|下星期|الأسبوع القادم)(?=\s|$)/i, day: (_m, n) => nextWeekday(n, 1, false) },
  { re: /(^|\s)in (\d{1,3}) (day|days|week|weeks)(?=\s|$)/i,
    day: (m, n) => addDays(n, Number(m[2]) * (m[3].toLowerCase().startsWith("week") ? 7 : 1)) },
  /* Full weekday names alone; the short forms only after "on" / "next", so a
     title about the sun or a person called Sat is left alone. */
  { re: /(^|\s)(next |on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?=\s|$)/i,
    day: (m, n) => nextWeekday(n, WEEKDAYS[m[3].toLowerCase()], /next/i.test(m[2] ?? "")) },
  { re: /(^|\s)(next |on )(mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun)(?=\s|$)/i,
    day: (m, n) => nextWeekday(n, WEEKDAYS[m[3].toLowerCase()], /next/i.test(m[2])) },
  { re: /(^|\s)(下)?(?:周|星期)([一二三四五六日天])(?=\s|$)/, day: (m, n) => nextWeekday(n, ZH_WEEKDAYS[m[3]], !!m[2]) },
  { re: /(^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/,
    day: (m, n) => dayMonth(n, Number(m[2]), Number(m[3]) - 1, m[4] ? Number(m[4]) : undefined) },
  { re: /(^|\s)(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*(?=\s|$)/i,
    day: (m, n) => dayMonth(n, Number(m[2]), MONTHS[m[3].toLowerCase()]) },
];

/* Times — hour/minute, 24 h. Each returns null for an impossible time. */
const hm = (h: number, m: number): [number, number] | null => (h >= 0 && h < 24 && m >= 0 && m < 60 ? [h, m] : null);
const pm = (h: number) => (h < 12 ? h + 12 : h);
const am = (h: number) => (h === 12 ? 0 : h);
type TimeRule = { re: RegExp; time: (m: RegExpMatchArray) => [number, number] | null };
const TIME_RULES: TimeRule[] = [
  /* 下午3点 · 上午10点半 · 晚上8点30分 · 3点 — no spaces needed around it in Chinese. */
  { re: /(上午|早上|中午|下午|晚上)?(\d{1,2})[点點时時](半|(\d{1,2})分?)?/,
    time: (m) => {
      let h = Number(m[2]);
      if (m[1] && /下午|晚上/.test(m[1])) h = pm(h);
      if (m[1] === "中午" && h < 11) h = pm(h);
      return hm(h, m[3] === "半" ? 30 : Number(m[4] ?? 0));
    } },
  /* 3pm · 3:30 pm · at 11am */
  { re: /(^|\s)(?:at\s)?(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)(?=\s|$)/i,
    time: (m) => { const h = Number(m[2]); if (h < 1 || h > 12) return null; return hm(/^p/i.test(m[4]) ? pm(h) : am(h), Number(m[3] ?? 0)); } },
  /* 3 مساء · 10:30 صباحا */
  { re: /(^|\s)(\d{1,2})(?:[:.](\d{2}))?\s?(مساء|مساءً|مساءا|صباحا|صباحًا|صباحاً)(?=\s|$)/,
    time: (m) => { const h = Number(m[2]); return hm(/^م/.test(m[4]) ? pm(h) : am(h), Number(m[3] ?? 0)); } },
  /* 15:30 · at 9:05 */
  { re: /(^|\s)(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/i, time: (m) => hm(Number(m[2]), Number(m[3])) },
  /* at 3 — a bare hour only after "at"; 1–7 read as the afternoon. */
  { re: /(^|\s)at\s(\d{1,2})(?=\s|$)/i,
    time: (m) => { const h = Number(m[2]); return h >= 1 && h <= 7 ? hm(h + 12, 0) : hm(h, 0); } },
];

const squash = (v: string) => v.toLowerCase().replace(/\s+/g, "");

export function parseQuickAdd(
  input: string,
  labels: string[],
  opts: { dates?: boolean; priority?: boolean; people?: QuickPerson[] } = {},
  now = new Date(),
): QuickParse {
  let text = ` ${input.trim()} `;
  let due: string | null = null;
  let time: string | null = null;
  let priority: TodoPriority | null = null;
  let label: string | null = null;
  const people: string[] = [];

  /* The time first: "明天下午3点" has no space between the day and the time,
     and taking the time out leaves "明天" for the day rules. */
  for (const rule of opts.dates === false ? [] : TIME_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const v = rule.time(m);
    if (!v) continue;
    time = `${String(v[0]).padStart(2, "0")}:${String(v[1]).padStart(2, "0")}`;
    text = text.replace(m[0], " ");
    break;
  }

  for (const rule of opts.dates === false ? [] : DATE_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    const d = rule.day(m, now);
    if (!d) continue;
    due = isoDay(d);
    text = text.replace(m[0], " ");
    break;
  }

  text = text.replace(/(^|\s)(![^\s]+|p[123])(?=\s|$)/gi, (whole, lead: string, tok: string) => {
    const p = PRIORITY[tok.toLowerCase()];
    if (!p || priority || opts.priority === false) return whole;
    priority = p;
    return lead;
  });

  if (labels.length > 0) {
    text = text.replace(/(^|\s)#([^\s#]+)(?=\s|$)/g, (whole, lead: string, name: string) => {
      if (label) return whole;
      const hit = labels.find((l) => l.toLowerCase() === name.toLowerCase());
      if (!hit) return whole;
      label = hit;
      return lead;
    });
  }

  /* A time alone means today — or tomorrow once that hour has gone. */
  if (time && !due) {
    const [h, m] = time.split(":").map(Number);
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    due = isoDay(at.getTime() > now.getTime() ? at : addDays(now, 1));
  }

  const roster = opts.people ?? [];
  if (roster.length > 0) {
    text = text.replace(/(^|\s)@([^\s@]+)(?=\s|$)/g, (whole, lead: string, name: string) => {
      const q = name.toLowerCase();
      const hits = roster.filter((p) =>
        p.username.toLowerCase() === q ||
        squash(p.full_name ?? "") === q ||
        (p.full_name ?? "").toLowerCase().split(/\s+/)[0] === q);
      if (hits.length !== 1) return whole;
      if (!people.includes(hits[0].account_id)) people.push(hits[0].account_id);
      return lead;
    });
  }

  return { title: text.replace(/\s+/g, " ").trim(), due, time, priority, label, people };
}

/** The stored due for a day + optional "HH:MM": a bare day stays a bare day
 *  (the form's own format); with a time it is that local instant. */
export function dueValue(day: string | null, time: string | null): string | null {
  if (!day) return null;
  if (!time) return day;
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const at = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(at.getTime()) ? day : at.toISOString();
}
