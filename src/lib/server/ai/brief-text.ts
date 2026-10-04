import "server-only";

/* The pure half of lib/server/ai/brief.ts — the words and the clock — kept
   apart so a suite can prove them without a database. */

export type BriefLang = "en" | "zh" | "ar";

export interface BriefCounts {
  meetings: number;
  dueToday: number;
  overdue: number;
  reminders: number;
  /** The first thing of the day, in words: "09:30 Delta call" — or "". */
  first: string;
}

/** The counts, worded for a notification. Pure. */
export function briefText(c: BriefCounts, lang: BriefLang): { title: string; body: string } {
  const parts: string[] = [];
  if (lang === "ar") {
    if (c.meetings) parts.push(`${c.meetings} ${c.meetings === 1 ? "اجتماع" : "اجتماعات"}`);
    if (c.dueToday) parts.push(`${c.dueToday} ${c.dueToday === 1 ? "مهمة موعدها النهاردة" : "مهام موعدها النهاردة"}`);
    if (c.overdue) parts.push(`${c.overdue} ${c.overdue === 1 ? "مهمة متأخرة" : "مهام متأخرة"}`);
    if (c.reminders) parts.push(`${c.reminders} ${c.reminders === 1 ? "تذكير" : "تذكيرات"}`);
    const body = parts.length ? `${parts.join(" · ")}${c.first ? ` — الأول: ${c.first}` : ""}` : "مفيش حاجة على جدولك النهاردة. يوم هادي.";
    return { title: "☀️ بريف اليوم", body };
  }
  if (lang === "zh") {
    if (c.meetings) parts.push(`${c.meetings} 个会议`);
    if (c.dueToday) parts.push(`${c.dueToday} 个今天到期`);
    if (c.overdue) parts.push(`${c.overdue} 个已逾期`);
    if (c.reminders) parts.push(`${c.reminders} 个提醒`);
    const body = parts.length ? `${parts.join(" · ")}${c.first ? ` — 首先：${c.first}` : ""}` : "今天日程为空，轻松的一天。";
    return { title: "☀️ 今日简报", body };
  }
  if (c.meetings) parts.push(`${c.meetings} meeting${c.meetings === 1 ? "" : "s"}`);
  if (c.dueToday) parts.push(`${c.dueToday} due today`);
  if (c.overdue) parts.push(`${c.overdue} overdue`);
  if (c.reminders) parts.push(`${c.reminders} reminder${c.reminders === 1 ? "" : "s"}`);
  const body = parts.length ? `${parts.join(" · ")}${c.first ? ` — first: ${c.first}` : ""}` : "Nothing on your plate today. A quiet one.";
  return { title: "☀️ Your brief for today", body };
}

/** The hour of the day in a zone. Pure. */
export function hourIn(tz: string, now: Date): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
  } catch {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", hour: "2-digit", hourCycle: "h23" }).format(now));
  }
}

/** The calendar day (YYYY-MM-DD) in a zone. Pure. */
export function dayIn(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
}
