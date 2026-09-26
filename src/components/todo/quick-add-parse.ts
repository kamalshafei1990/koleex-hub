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
   Priority: !high !med !low, !1 !2 !3, p1 p2 p3, !高 !中 !低
   Label: #name — only when a label with that name already exists.
   --------------------------------------------------------------------------- */

import type { TodoPriority } from "@/types/supabase";
import { isoDay } from "./todo-dates";

export interface QuickParse {
  title: string;
  due: string | null;
  priority: TodoPriority | null;
  label: string | null;
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

export function parseQuickAdd(
  input: string,
  labels: string[],
  opts: { dates?: boolean; priority?: boolean } = {},
  now = new Date(),
): QuickParse {
  let text = ` ${input.trim()} `;
  let due: string | null = null;
  let priority: TodoPriority | null = null;
  let label: string | null = null;

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

  return { title: text.replace(/\s+/g, " ").trim(), due, priority, label };
}
