/* ---------------------------------------------------------------------------
   discuss-time — the date/time labels Discuss shows, in the APP language.

   · "Yesterday" / weekday are decided by CALENDAR day in local time. The old
     helpers subtracted timestamps and floored by 24h, so a message from
     23:50 yesterday read as "today"-ish at 00:10 and 25h-old messages from
     two calendar days ago still said "Yesterday".
   · Dates are D/M/Y (the Hub's standing format), never the browser's
     month-first default.
   · Weekday names and clock times follow the app language (en / zh / ar)
     rather than the browser locale; digits stay Latin so times line up.
   --------------------------------------------------------------------------- */

export type DiscussLang = "en" | "zh" | "ar" | string;

function locale(lang: DiscussLang): string {
  const base = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar" : "en-GB";
  return `${base}-u-nu-latn`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between `d` and today (0 = today, 1 = yesterday). */
export function calendarDaysAgo(d: Date, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** D/M/Y — with the year omitted when `omitYearIfCurrent` and it is this year. */
export function dmy(d: Date, omitYearIfCurrent = false, now = new Date()): string {
  const base = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return omitYearIfCurrent && d.getFullYear() === now.getFullYear() ? base : `${base}/${d.getFullYear()}`;
}

/** Clock time (HH:MM) in the app language. */
export function discussTime(iso: string, lang: DiscussLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit" });
  } catch {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function weekday(d: Date, lang: DiscussLang, style: "short" | "long"): string {
  try {
    return d.toLocaleDateString(locale(lang), { weekday: style });
  } catch {
    return dmy(d);
  }
}

/** Sidebar / search-hit stamp: time today, "Yesterday", weekday this week,
 *  otherwise D/M (this year) or D/M/Y. */
export function discussListStamp(iso: string, lang: DiscussLang, yesterdayText: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = calendarDaysAgo(d);
  if (days <= 0) return discussTime(iso, lang);
  if (days === 1) return yesterdayText;
  if (days < 7) return weekday(d, lang, "short");
  return dmy(d, true);
}

/** Day separator inside a thread: Today / Yesterday / weekday / D/M/Y. */
export function discussDayLabel(
  iso: string,
  lang: DiscussLang,
  todayText: string,
  yesterdayText: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = calendarDaysAgo(d);
  if (days <= 0) return todayText;
  if (days === 1) return yesterdayText;
  if (days < 7) return weekday(d, lang, "long");
  return dmy(d);
}
